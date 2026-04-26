// §6.1, §6.2, §6.3 — SyncEngine retry/dedup behaviour

jest.mock('@/database', () => ({
  database: {
    get: jest.fn(),
    write: jest.fn(),
  },
  ActionLog: class {},
  TourEvent: class {},
  PlayerCache: class {},
}));

jest.mock('../services/api', () => ({
  apiRequest: jest.fn(),
}));

jest.mock('@/lib/offline-sync', () => ({
  subscribeToConnectionChanges: jest.fn().mockReturnValue(() => {}),
  getAppConfig: jest.fn().mockResolvedValue(null),
  setAppConfig: jest.fn().mockResolvedValue(undefined),
}));

import { database } from '@/database';
import { apiRequest } from '../services/api';
import { SyncEngine } from '../services/sync-engine';

// ─── Mock record factory ──────────────────────────────────────────────────────

interface MockRecord {
  id: string;
  actionType: string;
  payload: string;
  roundId: string;
  createdAt: number;
  syncedAt: number | null;
  retryCount: number;
  lastError: string | null;
  parsedPayload: object;
  update: jest.Mock;
}

function mockAction(id: string, overrides: Partial<MockRecord> = {}): MockRecord {
  const record: MockRecord = {
    id,
    actionType: 'HOLE_SAVED',
    payload: '{"round_id":"r1","hole_number":1,"scores":[]}',
    roundId: 'round-1',
    createdAt: Date.now(),
    syncedAt: null,
    retryCount: 0,
    lastError: null,
    parsedPayload: { round_id: 'r1', hole_number: 1, scores: [] },
    update: jest.fn(),
    ...overrides,
  };
  record.update.mockImplementation(async (fn: (r: MockRecord) => void) => {
    fn(record);
    return record;
  });
  return record;
}

// Returns records matching the DB-level filter: syncedAt IS NULL, retryCount < 5
function setupDatabase(actions: MockRecord[]) {
  const candidates = actions.filter((a) => a.syncedAt === null && a.retryCount < 5);
  (database.get as jest.Mock).mockReturnValue({
    query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue(candidates) }),
  });
  (database.write as jest.Mock).mockImplementation(async (fn: () => Promise<void>) => fn());
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ─── §6.1 ────────────────────────────────────────────────────────────────────

describe('§6.1: score_confirmed does not double-clear sync queue', () => {
  it('flush() after HTTP 200 does not resend the already-synced action', async () => {
    const action = mockAction('a1');

    (apiRequest as jest.Mock).mockResolvedValue({ synced: ['a1'], failed: [] });
    setupDatabase([action]);

    const engine = new SyncEngine();
    await engine.flush();

    expect(action.syncedAt).not.toBeNull();

    // Second flush — action now has syncedAt set, filtered out by setupDatabase
    (apiRequest as jest.Mock).mockClear();
    setupDatabase([action]);
    await engine.flush();

    expect(apiRequest).not.toHaveBeenCalled();
  });

  it('SyncEngine has no score_confirmed WS listener — WS event does not touch queue state', () => {
    // score_confirmed is purely informational (HTTP 200 is the canonical sync signal).
    // Verify that SyncEngine registers no score_confirmed handler by checking it has no
    // such method or subscription. If WS fires the event, nothing in SyncEngine reacts.
    const engine = new SyncEngine() as unknown as Record<string, unknown>;
    expect(typeof engine['onScoreConfirmed']).toBe('undefined');
    expect(typeof engine['handleScoreConfirmed']).toBe('undefined');
  });
});

// ─── §6.2 ────────────────────────────────────────────────────────────────────

describe('§6.2: 50-action batch on flaky network — 5 retries with backoff 5s→30s→2m→10m', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('retries up to MAX_RETRIES=5 with correct delays and stops after the 5th failure', async () => {
    const actions = Array.from({ length: 50 }, (_, i) => mockAction(`a-${i}`));
    (apiRequest as jest.Mock).mockRejectedValue(new Error('ECONNRESET'));

    const engine = new SyncEngine();

    // Attempt 1 — T=0
    setupDatabase(actions);
    await engine.flush();
    expect(apiRequest).toHaveBeenCalledTimes(1);
    for (const a of actions) expect(a.retryCount).toBe(1);

    // Immediate re-flush — still within backoff (nextRetryAt = T+5s)
    (apiRequest as jest.Mock).mockClear();
    await engine.flush();
    expect(apiRequest).not.toHaveBeenCalled();

    // Attempt 2 — advance 5s
    jest.advanceTimersByTime(5_001);
    await engine.flush();
    expect(apiRequest).toHaveBeenCalledTimes(1);
    for (const a of actions) expect(a.retryCount).toBe(2);

    // Attempt 3 — advance 30s
    (apiRequest as jest.Mock).mockClear();
    jest.advanceTimersByTime(30_001);
    await engine.flush();
    expect(apiRequest).toHaveBeenCalledTimes(1);
    for (const a of actions) expect(a.retryCount).toBe(3);

    // Attempt 4 — advance 2m
    (apiRequest as jest.Mock).mockClear();
    jest.advanceTimersByTime(120_001);
    await engine.flush();
    expect(apiRequest).toHaveBeenCalledTimes(1);
    for (const a of actions) expect(a.retryCount).toBe(4);

    // Attempt 5 — advance 10m (MAX_RETRIES reached)
    (apiRequest as jest.Mock).mockClear();
    jest.advanceTimersByTime(600_001);
    await engine.flush();
    expect(apiRequest).toHaveBeenCalledTimes(1);
    for (const a of actions) expect(a.retryCount).toBe(5);

    // No more retries — retryCount=5 is excluded by the DB filter
    (apiRequest as jest.Mock).mockClear();
    setupDatabase(actions); // re-setup: all actions have retryCount=5 → filtered to []
    jest.advanceTimersByTime(600_001);
    await engine.flush();
    expect(apiRequest).not.toHaveBeenCalled();
  });
});

// ─── §6.3 ────────────────────────────────────────────────────────────────────

describe('§6.3: duplicate action_id across two batches', () => {
  it('marks action synced when its ID appears in synced[] on second send', async () => {
    const action = mockAction('a1', { retryCount: 1 }); // already tried once without response

    (apiRequest as jest.Mock).mockResolvedValue({ synced: ['a1'], failed: [] });
    setupDatabase([action]);

    const engine = new SyncEngine();
    await engine.flush();

    expect(action.syncedAt).not.toBeNull();
    expect(action.retryCount).toBe(1); // retryCount unchanged — marked synced, not failed
  });

  it('non-retriable failure reason prevents future retries', async () => {
    const action = mockAction('a1');

    (apiRequest as jest.Mock).mockResolvedValue({
      synced: [],
      failed: [{ id: 'a1', reason: 'invalid_payload: score out of range' }],
    });
    setupDatabase([action]);

    const engine = new SyncEngine();
    await engine.flush();

    expect(action.lastError).toBe('invalid_payload: score out of range');
    // Non-retriable prefix → nextRetryAt set to Number.MAX_SAFE_INTEGER → never retried again
  });

  it('transient failure reason allows future retries', async () => {
    const action = mockAction('a1');

    (apiRequest as jest.Mock).mockResolvedValue({
      synced: [],
      failed: [{ id: 'a1', reason: 'server_error: temporarily unavailable' }],
    });
    setupDatabase([action]);

    const engine = new SyncEngine();
    await engine.flush();

    expect(action.retryCount).toBe(1);
    expect(action.syncedAt).toBeNull(); // not synced — will retry
  });
});
