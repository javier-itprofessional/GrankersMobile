import { apiRequest } from './api';
import { wsClient } from './websocket';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FirebaseCompetitionData {
  group_code: string;
  competition_name: string;
  event_name: string;
  players: { id: string; first_name: string; last_name: string; license: string; handicap?: number }[];
  course_name?: string;
  route_name?: string;
  session_uuid?: string;
  effective_scoring_entry_mode?: string;
  scoring_entry_mode?: string;  // backend pre-rename alias — remove once §v2-wire.1 ships
}

export interface LicensePlayer {
  license: string;
  firstName: string;
  lastName: string;
  handicap?: number;
  avatarUrl?: string | null;
}

export interface UpcomingCompetition {
  group_id: string;
  competition_name: string;
  event_name: string;
  date: string;
  tee_time: string;
  player_id?: string;
  player_license?: string;
}

export interface FoundCompetitionSession {
  groupCode: string;
  competitionName: string;
  eventName: string;
  playerId: string;
  playerFirstName: string;
  playerLastName: string;
  players: { id: string; first_name: string; last_name: string; license: string }[];
  courseName?: string;
  routeName?: string;
  sessionUuid?: string;
  scoringMode?: 'all' | 'partial';
}

export interface PlayerStatus {
  id: string;
  firstName: string;
  lastName: string;
  deviceId?: string;
  status?: string;
}

export interface ScoringSession {
  uuid: string;
  mode: string;
  status: string;
  courseUuid?: string;
  courseName?: string;
  routeUuid?: string;
  routeName?: string;
  teeColor?: string;
  gameName?: string;
  startedAt?: string;
  players: {
    playerExternalId: string;
    firstName: string;
    lastName: string;
    handicapIndex?: number;
    status?: string;
  }[];
  invitedPartners?: {
    playerExternalId: string;
    firstName: string;
    lastName: string;
    handicap?: number;
    teeColor?: string;
  }[];
}

// ─── Wire types ───────────────────────────────────────────────────────────────

interface WireActiveSession {
  uuid: string;
  status: string;
  mode: string;
  group_code: string;
  competition_name?: string;
  event_name?: string;
  course_name?: string;
  route_name?: string;
  player_id?: string;
  player_first_name?: string;
  player_last_name?: string;
}

interface WireLicensePlayer {
  external_id?: string;
  license: string;
  first_name: string;
  last_name: string;
  handicap_index?: number;
  avatar_url?: string | null;
}

interface WireScoringSession {
  uuid: string;
  mode: string;
  status: string;
  course_uuid?: string;
  course_name?: string;
  route_uuid?: string;
  route_name?: string;
  tee_color?: string;
  game_name?: string;
  started_at?: string;
  players: { player_external_id: string; first_name: string; last_name: string; handicap_index?: number; status?: string }[];
  invited_partners?: { player_external_id: string; first_name: string; last_name: string; handicap?: number; tee_color?: string }[];
}

// ─── Competition ──────────────────────────────────────────────────────────────

export async function fetchCompetitionData(
  groupCode: string
): Promise<FirebaseCompetitionData | null> {
  try {
    return await apiRequest<FirebaseCompetitionData>(
      `/api/v1/competitions/${encodeURIComponent(groupCode)}/`
    );
  } catch {
    return null;
  }
}

export async function findCompetitionByDeviceId(
  deviceId: string
): Promise<FoundCompetitionSession | null> {
  try {
    const active = await apiRequest<WireActiveSession>(
      `/api/v1/competitions/active/?device_id=${encodeURIComponent(deviceId)}`
    );
    const comp = await apiRequest<FirebaseCompetitionData>(
      `/api/v1/competitions/${encodeURIComponent(active.group_code)}/`
    );
    return {
      groupCode: active.group_code,
      competitionName: active.competition_name ?? comp.competition_name,
      eventName: active.event_name ?? comp.event_name,
      playerId: active.player_id ?? '',
      playerFirstName: active.player_first_name ?? '',
      playerLastName: active.player_last_name ?? '',
      players: comp.players,
      courseName: comp.course_name,
      routeName: comp.route_name,
      sessionUuid: comp.session_uuid,
      scoringMode: (comp.effective_scoring_entry_mode ?? comp.scoring_entry_mode) === 'partial' ? 'partial' : 'all',
    };
  } catch {
    return null;
  }
}

export async function getPlayerHoleScores(
  groupCode: string,
  playerId: string
): Promise<{ holes: { hole_number: number; par: number; strokes?: number; putts?: number; penalties?: number }[]; totals?: Record<string, number> }> {
  try {
    return await apiRequest<{ holes: { hole_number: number; par: number; strokes?: number; putts?: number; penalties?: number }[]; totals?: Record<string, number> }>(
      `/api/v1/competitions/${encodeURIComponent(groupCode)}/players/${encodeURIComponent(playerId)}/scores/`
    );
  } catch {
    return { holes: [] };
  }
}

export async function fetchUpcomingCompetition(): Promise<UpcomingCompetition | null> {
  try {
    return await apiRequest<UpcomingCompetition>('/api/v1/player-area/next-competition/');
  } catch {
    return null;
  }
}

export async function linkDeviceToCompetitionPlayer(
  groupCode: string,
  playerId: string,
  deviceId: string
): Promise<void> {
  await apiRequest<void>(
    `/api/v1/competitions/${encodeURIComponent(groupCode)}/players/${encodeURIComponent(playerId)}/link-device/`,
    { method: 'POST', body: JSON.stringify({ device_id: deviceId }) }
  );
}

export async function updatePlayerConnectionStatus(
  groupCode: string,
  playerId: string,
  status: 'not_started' | 'ready' | 'playing' | 'finished' | 'withdrawn'
): Promise<void> {
  await apiRequest<void>(
    `/api/v1/competitions/${encodeURIComponent(groupCode)}/players/${encodeURIComponent(playerId)}/status/`,
    { method: 'PATCH', body: JSON.stringify({ status }) }
  );
}

export function subscribeToCompetitionPlayers(
  roundId: string,
  knownPlayers: { id: string; firstName: string; lastName: string }[],
  callback: (players: PlayerStatus[]) => void
): () => void {
  const playerMap = new Map(
    knownPlayers.map((p) => [p.id, { ...p, deviceId: undefined as string | undefined, status: undefined as string | undefined }])
  );

  const unsubscribe = wsClient.on('player_status_changed', (payload) => {
    const entry = playerMap.get(payload.player_id);
    if (entry) {
      entry.status = payload.status;
      if (payload.status === 'ready' || payload.status === 'playing') {
        entry.deviceId = payload.player_id;
      } else {
        entry.deviceId = undefined;
      }
    }
    callback(Array.from(playerMap.values()));
  });

  return unsubscribe;
}

// ─── Players / licenses ───────────────────────────────────────────────────────

export async function searchPlayerLicenses(
  searchParams: { license?: string; firstName?: string; lastName?: string; groupCode?: string }
): Promise<LicensePlayer[]> {
  const params = new URLSearchParams();
  if (searchParams.license) params.set('license', searchParams.license);
  if (searchParams.firstName) params.set('first_name', searchParams.firstName);
  if (searchParams.lastName) params.set('last_name', searchParams.lastName);
  if (searchParams.groupCode) params.set('group_code', searchParams.groupCode);

  try {
    const wire = await apiRequest<WireLicensePlayer[]>(`/api/v1/players/search/?${params.toString()}`);
    return wire.map((w) => ({
      license: w.license,
      firstName: w.first_name,
      lastName: w.last_name,
      handicap: w.handicap_index,
      avatarUrl: w.avatar_url,
    }));
  } catch {
    return [];
  }
}

// ─── Free-play games ──────────────────────────────────────────────────────────

function transformScoringSession(wire: WireScoringSession): ScoringSession {
  return {
    uuid: wire.uuid,
    mode: wire.mode,
    status: wire.status,
    courseUuid: wire.course_uuid,
    courseName: wire.course_name,
    routeUuid: wire.route_uuid,
    routeName: wire.route_name,
    teeColor: wire.tee_color,
    gameName: wire.game_name,
    startedAt: wire.started_at,
    players: wire.players.map((p) => ({
      playerExternalId: p.player_external_id,
      firstName: p.first_name,
      lastName: p.last_name,
      handicapIndex: p.handicap_index,
      status: p.status,
    })),
    invitedPartners: wire.invited_partners?.map((p) => ({
      playerExternalId: p.player_external_id,
      firstName: p.first_name,
      lastName: p.last_name,
      handicap: p.handicap,
      teeColor: p.tee_color,
    })),
  };
}

export async function createFreePlayGame(
  courseUuid: string,
  players: { playerExternalId?: string; handicap?: number; teeColor?: string }[],
  options?: { routeUuid?: string; gameName?: string; teeColor?: string }
): Promise<ScoringSession> {
  const wire = await apiRequest<WireScoringSession>('/api/v1/free-play/games/', {
    method: 'POST',
    body: JSON.stringify({
      course_uuid: courseUuid,
      route_uuid: options?.routeUuid,
      game_name: options?.gameName,
      tee_color: options?.teeColor,
      players: players.map((p) => ({
        player_external_id: p.playerExternalId,
        handicap: p.handicap,
        tee_color: p.teeColor,
      })),
    }),
  });
  return transformScoringSession(wire);
}

export async function listFreePlayGames(
  courseUuid: string,
  routeUuid?: string
): Promise<ScoringSession[]> {
  try {
    const url = routeUuid
      ? `/api/v1/free-play/games/?course=${encodeURIComponent(courseUuid)}&route=${encodeURIComponent(routeUuid)}`
      : `/api/v1/free-play/games/?course=${encodeURIComponent(courseUuid)}`;
    const wire = await apiRequest<WireScoringSession[]>(url);
    return wire.map(transformScoringSession);
  } catch {
    return [];
  }
}

export async function getActiveGamePlayers(
  courseUuid: string,
  routeUuid?: string,
  gameName?: string
): Promise<{ id: string; firstName: string; lastName: string; handicap: string }[] | null> {
  try {
    const sessions = await listFreePlayGames(courseUuid, routeUuid);
    const session = gameName ? sessions.find((s) => s.gameName === gameName) : sessions[0];
    if (!session) return null;
    return session.players.map((p) => ({
      id: p.playerExternalId,
      firstName: p.firstName,
      lastName: p.lastName,
      handicap: String(p.handicapIndex ?? 0),
    }));
  } catch {
    return null;
  }
}
