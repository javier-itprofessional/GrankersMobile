import { apiRequest } from './api';
import { wsClient } from './websocket';
import type { PlayerStatusEvent } from './websocket';

// ─── Tipos públicos (antes en config/firebase.ts) ─────────────────────────────

export interface FirebaseCompetitionData {
  codigo_grupo: string;
  nombre_competicion: string;
  nombre_prueba: string;
  jugadores: { id: string; nombre: string; apellido: string; licencia: string }[];
  campo?: string;
  recorrido?: string;
}

export interface LicensePlayer {
  licencia: string;
  nombre: string;
  apellido: string;
  handicap?: number;
}

export interface ProximaCompeticion {
  id_grupo: string;
  nombre_competicion: string;
  nombre_prueba: string;
  fecha: string;
  hora_salida: string;
  id_jugador?: string;
  numero_licencia?: string;
}

export interface FoundCompetitionSession {
  codigoGrupo: string;
  nombreCompeticion: string;
  nombrePrueba: string;
  playerId: string;
  playerNombre: string;
  playerApellido: string;
  jugadores: { id: string; nombre: string; apellido: string; licencia: string }[];
  campo?: string;
  recorrido?: string;
}

export interface PlayerStatus {
  id: string;
  nombre: string;
  apellido: string;
  deviceId?: string;
  estado?: string;
}

export interface FreePlayGame {
  id: string;
  gameName: string;
  groupName: string;
  players?: { nombre: string; apellido: string; handicap: string; licencia?: string; deviceId?: string }[];
}

// ─── Competición ──────────────────────────────────────────────────────────────

export async function fetchCompetitionData(
  codigoGrupo: string
): Promise<FirebaseCompetitionData | null> {
  try {
    return await apiRequest<FirebaseCompetitionData>(
      `/api/v1/competitions/${encodeURIComponent(codigoGrupo)}/`
    );
  } catch {
    return null;
  }
}

export async function findCompetitionByDeviceId(
  deviceId: string
): Promise<FoundCompetitionSession | null> {
  try {
    return await apiRequest<FoundCompetitionSession>(
      `/api/v1/competitions/active/?device_id=${encodeURIComponent(deviceId)}`
    );
  } catch {
    return null;
  }
}

export async function getPlayerHoleScores(
  codigoGrupo: string,
  playerId: string
): Promise<{ [key: string]: any }> {
  try {
    return await apiRequest<{ [key: string]: any }>(
      `/api/v1/competitions/${encodeURIComponent(codigoGrupo)}/players/${encodeURIComponent(playerId)}/scores/`
    );
  } catch {
    return {};
  }
}

export async function fetchProximaCompeticion(): Promise<ProximaCompeticion | null> {
  try {
    return await apiRequest<ProximaCompeticion>('/api/v1/player-area/next-competition/');
  } catch {
    return null;
  }
}

export async function linkDeviceToCompetitionPlayer(
  codigoGrupo: string,
  playerId: string,
  deviceId: string
): Promise<void> {
  await apiRequest<void>(
    `/api/v1/competitions/${encodeURIComponent(codigoGrupo)}/players/${encodeURIComponent(playerId)}/link-device/`,
    { method: 'POST', body: JSON.stringify({ device_id: deviceId }) }
  );
}

export async function updatePlayerConnectionStatus(
  codigoGrupo: string,
  playerId: string,
  status: 'conectado' | 'offline'
): Promise<void> {
  await apiRequest<void>(
    `/api/v1/competitions/${encodeURIComponent(codigoGrupo)}/players/${encodeURIComponent(playerId)}/status/`,
    { method: 'PATCH', body: JSON.stringify({ status }) }
  );
}

// Subscribe to player status updates via WebSocket.
// roundId must be the identifier the backend uses for this competition room.
export function subscribeToCompetitionPlayers(
  roundId: string,
  knownPlayers: { id: string; nombre: string; apellido: string }[],
  callback: (players: PlayerStatus[]) => void
): () => void {
  const playerMap = new Map(
    knownPlayers.map((p) => [p.id, { ...p, deviceId: undefined as string | undefined, estado: undefined as string | undefined }])
  );

  const unsubscribe = wsClient.on('player_status_changed', (payload) => {
    const entry = playerMap.get(payload.player_id);
    if (entry) {
      entry.estado = payload.status;
      if (payload.status === 'conectado') {
        entry.deviceId = payload.player_id;
      }
    }
    callback(Array.from(playerMap.values()));
  });

  return unsubscribe;
}

// ─── Jugadores / licencias ────────────────────────────────────────────────────

export async function searchPlayerLicenses(
  searchParams: { licencia?: string; nombre?: string; apellido?: string; codigoGrupo?: string }
): Promise<LicensePlayer[]> {
  const params = new URLSearchParams();
  if (searchParams.licencia) params.set('licencia', searchParams.licencia);
  if (searchParams.nombre) params.set('nombre', searchParams.nombre);
  if (searchParams.apellido) params.set('apellido', searchParams.apellido);
  if (searchParams.codigoGrupo) params.set('codigo_grupo', searchParams.codigoGrupo);

  try {
    return await apiRequest<LicensePlayer[]>(`/api/v1/players/search/?${params.toString()}`);
  } catch {
    return [];
  }
}

// ─── Partidas libres (pachangas) ──────────────────────────────────────────────

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
  players: { nombre: string; apellido: string; handicap: string; licencia?: string }[]
): Promise<void> {
  await apiRequest<void>(`/api/v1/free-play/games/${encodeURIComponent(gameName)}/groups/${encodeURIComponent(groupName)}/players/`, {
    method: 'POST',
    body: JSON.stringify({ course_name: courseName, route_name: routeName, players }),
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

export async function getActiveGamePlayers(
  courseName: string,
  routeName: string,
  gameName: string,
  groupName: string
): Promise<any> {
  try {
    return await apiRequest<any>(
      `/api/v1/free-play/games/${encodeURIComponent(gameName)}/groups/${encodeURIComponent(groupName)}/players/?course=${encodeURIComponent(courseName)}&route=${encodeURIComponent(routeName)}`
    );
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
      `/api/v1/free-play/games/?course=${encodeURIComponent(courseName)}&route=${encodeURIComponent(routeName)}`
    );
  } catch {
    return [];
  }
}
