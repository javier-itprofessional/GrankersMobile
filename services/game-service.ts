import { apiRequest } from './api';
import { wsClient } from './websocket';
import type { PlayerStatusEvent } from './websocket';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface FirebaseCompetitionData {
  group_code: string;
  competition_name: string;
  event_name: string;
  players: { id: string; first_name: string; last_name: string; license: string; handicap?: number }[];
  course_name?: string;
  route_name?: string;
}

export interface LicensePlayer {
  license: string;
  firstName: string;
  lastName: string;
  handicap?: number;
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
}

export interface PlayerStatus {
  id: string;
  firstName: string;
  lastName: string;
  deviceId?: string;
  status?: string;
}

export interface FreePlayGame {
  id: string;
  gameName: string;
  groupName: string;
  players?: { firstName: string; lastName: string; handicap: string; license?: string; deviceId?: string }[];
}

// ─── Wire types (backend returns Spanish JSON) ────────────────────────────────

interface WirePlayer {
  id: string;
  nombre: string;
  apellido: string;
  licencia: string;
  handicap?: number;
}

interface WireCompetitionData {
  codigo_grupo: string;
  nombre_competicion: string;
  nombre_prueba: string;
  jugadores: WirePlayer[];
  campo?: string;
  recorrido?: string;
}

interface WireActiveCompetition extends WireCompetitionData {
  player_id: string;
  player_nombre: string;
  player_apellido: string;
}

interface WireLicensePlayer {
  licencia: string;
  nombre: string;
  apellido: string;
  handicap?: number;
}

// ─── Competition ──────────────────────────────────────────────────────────────

export async function fetchCompetitionData(
  groupCode: string
): Promise<FirebaseCompetitionData | null> {
  try {
    const wire = await apiRequest<WireCompetitionData>(
      `/api/v1/competitions/${encodeURIComponent(groupCode)}/`
    );
    return {
      group_code: wire.codigo_grupo,
      competition_name: wire.nombre_competicion,
      event_name: wire.nombre_prueba,
      players: wire.jugadores.map((j) => ({
        id: j.id, first_name: j.nombre, last_name: j.apellido, license: j.licencia, handicap: j.handicap,
      })),
      course_name: wire.campo,
      route_name: wire.recorrido,
    };
  } catch {
    return null;
  }
}

export async function findCompetitionByDeviceId(
  deviceId: string
): Promise<FoundCompetitionSession | null> {
  try {
    const wire = await apiRequest<WireActiveCompetition>(
      `/api/v1/competitions/active/?device_id=${encodeURIComponent(deviceId)}`
    );
    return {
      groupCode: wire.codigo_grupo,
      competitionName: wire.nombre_competicion,
      eventName: wire.nombre_prueba,
      playerId: wire.player_id,
      playerFirstName: wire.player_nombre,
      playerLastName: wire.player_apellido,
      players: wire.jugadores.map((j) => ({
        id: j.id, first_name: j.nombre, last_name: j.apellido, license: j.licencia,
      })),
      courseName: wire.campo,
      routeName: wire.recorrido,
    };
  } catch {
    return null;
  }
}

export async function getPlayerHoleScores(
  groupCode: string,
  playerId: string
): Promise<{ [key: string]: any }> {
  try {
    return await apiRequest<{ [key: string]: any }>(
      `/api/v1/competitions/${encodeURIComponent(groupCode)}/players/${encodeURIComponent(playerId)}/scores/`
    );
  } catch {
    return {};
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
  status: 'connected' | 'offline'
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
      if (payload.status === 'connected') {
        entry.deviceId = payload.player_id;
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
  if (searchParams.license) params.set('licencia', searchParams.license);
  if (searchParams.firstName) params.set('nombre', searchParams.firstName);
  if (searchParams.lastName) params.set('apellido', searchParams.lastName);
  if (searchParams.groupCode) params.set('codigo_grupo', searchParams.groupCode);

  try {
    const wire = await apiRequest<WireLicensePlayer[]>(`/api/v1/players/search/?${params.toString()}`);
    return wire.map((w) => ({ license: w.licencia, firstName: w.nombre, lastName: w.apellido, handicap: w.handicap }));
  } catch {
    return [];
  }
}

// ─── Free-play games ──────────────────────────────────────────────────────────

export async function createFreePlayGame(
  courseName: string,
  routeName: string,
  gameName: string,
  groupName: string,
  password?: string
): Promise<void> {
  await apiRequest<void>('/api/v1/free-play/games/', {
    method: 'POST',
    body: JSON.stringify({ course_name: courseName, route_name: routeName, game_name: gameName, group_name: groupName, password }),
  });
}

export async function addGroupToExistingGame(
  courseName: string,
  routeName: string,
  gameName: string,
  groupName: string
): Promise<void> {
  await apiRequest<void>(`/api/v1/free-play/games/${encodeURIComponent(gameName)}/groups/`, {
    method: 'POST',
    body: JSON.stringify({ course_name: courseName, route_name: routeName, group_name: groupName }),
  });
}

export async function saveFreePlayPlayers(
  courseName: string,
  routeName: string,
  gameName: string,
  groupName: string,
  players: { firstName: string; lastName: string; handicap: string; license?: string }[]
): Promise<void> {
  const wirePlayers = players.map((p) => ({
    nombre: p.firstName, apellido: p.lastName, handicap: p.handicap, licencia: p.license,
  }));
  await apiRequest<void>(`/api/v1/free-play/games/${encodeURIComponent(gameName)}/groups/${encodeURIComponent(groupName)}/players/`, {
    method: 'POST',
    body: JSON.stringify({ course_name: courseName, route_name: routeName, players: wirePlayers }),
  });
}

export async function linkDeviceToPlayer(
  courseName: string,
  routeName: string,
  gameName: string,
  groupName: string,
  playerKey: string,
  deviceId: string
): Promise<void> {
  await apiRequest<void>(
    `/api/v1/free-play/games/${encodeURIComponent(gameName)}/groups/${encodeURIComponent(groupName)}/players/${encodeURIComponent(playerKey)}/link-device/`,
    { method: 'POST', body: JSON.stringify({ course_name: courseName, route_name: routeName, device_id: deviceId }) }
  );
}

interface WireActivePlayer {
  nombre?: string;
  firstName?: string;
  apellido?: string;
  lastName?: string;
  handicap?: string | number;
  licencia?: string;
  license?: string;
}

export async function getActiveGamePlayers(
  courseName: string,
  routeName: string,
  gameName: string,
  groupName: string
): Promise<{ id: string; firstName: string; lastName: string; handicap: string; license?: string }[] | null> {
  try {
    const wire = await apiRequest<Record<string, WireActivePlayer>>(
      `/api/v1/free-play/games/${encodeURIComponent(gameName)}/groups/${encodeURIComponent(groupName)}/players/?course=${encodeURIComponent(courseName)}&route=${encodeURIComponent(routeName)}`
    );
    return Object.entries(wire).map(([key, value]) => ({
      id: key,
      firstName: value.nombre || value.firstName || '',
      lastName: value.apellido || value.lastName || '',
      handicap: String(value.handicap ?? '0'),
      license: value.licencia || value.license,
    }));
  } catch {
    return null;
  }
}

export async function listFreePlayGames(
  courseName: string,
  routeName: string
): Promise<{ gameName: string; groups: string[] }[]> {
  try {
    return await apiRequest<{ gameName: string; groups: string[] }[]>(
      `/api/v1/free-play/games/?course=${encodeURIComponent(courseName)}`
    );
  } catch {
    return [];
  }
}
