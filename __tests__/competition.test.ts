// §6.6 — effective_scoring_entry_mode wire field maps to Competition.scoringMode

jest.mock('../services/api', () => ({
  apiRequest: jest.fn(),
}));

jest.mock('../services/websocket', () => ({
  wsClient: {
    on: jest.fn().mockReturnValue(() => {}),
    connect: jest.fn(),
    disconnect: jest.fn(),
    isConnected: false,
  },
}));

import { apiRequest } from '../services/api';
import { findCompetitionByDeviceId, fetchCompetitionData } from '../services/game-service';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('§6.6: effective_scoring_entry_mode → Competition.scoringMode', () => {
  it("wire value 'partial' maps to scoringMode 'partial'", async () => {
    // active session endpoint
    (apiRequest as jest.Mock)
      .mockResolvedValueOnce({
        uuid: 'sess-1',
        status: 'in_progress',
        group_code: 'GRP1',
        competition_name: 'Spring Open',
        event_name: 'Round 1',
      })
      // competition detail endpoint
      .mockResolvedValueOnce({
        group_code: 'GRP1',
        competition_name: 'Spring Open',
        event_name: 'Round 1',
        players: [],
        effective_scoring_entry_mode: 'partial',
      });

    const result = await findCompetitionByDeviceId('device-abc');

    expect(result?.scoringMode).toBe('partial');
  });

  it("wire value 'all' maps to scoringMode 'all'", async () => {
    (apiRequest as jest.Mock)
      .mockResolvedValueOnce({ uuid: 'sess-2', group_code: 'GRP2' })
      .mockResolvedValueOnce({
        group_code: 'GRP2',
        competition_name: 'Test',
        event_name: 'R1',
        players: [],
        effective_scoring_entry_mode: 'all',
      });

    const result = await findCompetitionByDeviceId('device-abc');

    expect(result?.scoringMode).toBe('all');
  });

  it('missing wire field defaults to scoringMode all', async () => {
    (apiRequest as jest.Mock)
      .mockResolvedValueOnce({ uuid: 'sess-3', group_code: 'GRP3' })
      .mockResolvedValueOnce({
        group_code: 'GRP3',
        competition_name: 'Test',
        event_name: 'R1',
        players: [],
        // effective_scoring_entry_mode omitted
      });

    const result = await findCompetitionByDeviceId('device-abc');

    expect(result?.scoringMode).toBe('all');
  });

  it('fetchCompetitionData returns effective_scoring_entry_mode from the wire', async () => {
    (apiRequest as jest.Mock).mockResolvedValueOnce({
      group_code: 'GRP4',
      competition_name: 'Open',
      event_name: 'R1',
      players: [],
      effective_scoring_entry_mode: 'partial',
      session_uuid: 'uuid-xyz',
    });

    const data = await fetchCompetitionData('GRP4');

    expect(data?.effective_scoring_entry_mode).toBe('partial');
    expect(data?.session_uuid).toBe('uuid-xyz');
  });
});
