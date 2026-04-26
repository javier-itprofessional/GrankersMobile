// §6.4 — Device-ID migration: new UUID from crypto.randomUUID() replaces old hash format

jest.mock('@/database', () => ({
  Q: {
    where: jest.fn((col: string, val: unknown) => ({ col, val })),
    eq: jest.fn((v: unknown) => v),
  },
  database: {
    get: jest.fn(),
    write: jest.fn(),
  },
  AppConfig: class {},
}));

import { database } from '@/database';
import { generateDeviceId } from '../lib/offline-sync';

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function setupNoStoredId() {
  (database.get as jest.Mock).mockReturnValue({
    query: jest.fn().mockReturnValue({ fetch: jest.fn().mockResolvedValue([]) }),
    create: jest.fn().mockImplementation(async (fn: (r: Record<string, string>) => void) => {
      const record: Record<string, string> = {};
      fn(record);
      return record;
    }),
  });
  (database.write as jest.Mock).mockImplementation(async (fn: () => Promise<void>) => fn());
}

function setupStoredId(id: string) {
  (database.get as jest.Mock).mockReturnValue({
    query: jest.fn().mockReturnValue({
      fetch: jest.fn().mockResolvedValue([{ configValue: id }]),
    }),
  });
  (database.write as jest.Mock).mockImplementation(async (fn: () => Promise<void>) => fn());
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('§6.4: Device-ID generation uses crypto.randomUUID()', () => {
  it('generates a UUID v4 when no device ID is stored (fresh install / reinstall)', async () => {
    setupNoStoredId();

    const id = await generateDeviceId();

    expect(id).toMatch(UUID_V4_RE);
  });

  it('does NOT use the old device_TIMESTAMP_RANDOM hash format', async () => {
    setupNoStoredId();

    const id = await generateDeviceId();

    expect(id).not.toMatch(/^device_\d+_/);
  });

  it('returns the existing ID when one is already stored (device persists across sessions)', async () => {
    const existing = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    setupStoredId(existing);

    const id = await generateDeviceId();

    expect(id).toBe(existing);
  });

  it('new UUID format is accepted by the X-Device-ID regex (36 hex chars + hyphens)', async () => {
    setupNoStoredId();

    const id = await generateDeviceId();

    // Backend validation regex: 36-char UUID
    expect(id).toHaveLength(36);
    expect(id.split('-')).toHaveLength(5);
  });
});
