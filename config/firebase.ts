import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, get, child, set, onValue } from 'firebase/database';
import type { FirebaseCompetitionData } from '@/types/game';
import { checkConnection } from '@/lib/offline-sync';

const firebaseConfig = {
  apiKey: "AIzaSyCWhLmt00tQu6nuYQ70yc1se_pbwn_jBBY",
  authDomain: "grankers--mobile.firebaseapp.com",
  databaseURL: "https://grankers--mobile-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "grankers--mobile",
  storageBucket: "grankers--mobile.firebasestorage.app",
  messagingSenderId: "688854162748",
  appId: "1:688854162748:web:483e91507d2d305b075239",
  measurementId: "G-C22Y9JBMPE"
};

let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

const database = getDatabase(app);

export const fetchCompetitionData = async (
  codigoGrupo: string
): Promise<FirebaseCompetitionData | null> => {
  try {
    console.log('=== FETCHING COMPETITION DATA ===');
    console.log('Code:', codigoGrupo);
    console.log('Database URL:', firebaseConfig.databaseURL);
    
    const isConnected = await checkConnection();
    console.log('Connection status:', isConnected);
    
    if (!isConnected) {
      throw new Error('No hay conexión a internet');
    }
    
    const dbRef = ref(database);
    const normalizedSearchCode = codigoGrupo.trim().toUpperCase();
    console.log('Normalized search code (case-insensitive):', normalizedSearchCode);
    
    const competitionPath = `pruebas_activas/codigo_grupo/${normalizedSearchCode}`;
    console.log('Checking competition path:', competitionPath);
    
    const competitionSnapshot = await get(child(dbRef, competitionPath));
    
    if (!competitionSnapshot.exists()) {
      console.log('No competition found at path:', competitionPath);
      throw new Error(`No se encontró ninguna competición con el código ${codigoGrupo}`);
    }
    
    console.log('✅ Competition found! Loading data...');
    
    const competitionData = competitionSnapshot.val();
    console.log('Competition data keys:', Object.keys(competitionData || {}));
    
    const jugadoresPath = `pruebas_activas/codigo_grupo/${normalizedSearchCode}/jugadores`;
    console.log('Fetching players from path:', jugadoresPath);
    
    const jugadoresSnapshot = await get(child(dbRef, jugadoresPath));
    
    if (!jugadoresSnapshot.exists()) {
      console.error('No jugadores found at path:', jugadoresPath);
      throw new Error('No se encontraron jugadores en la competición');
    }
    
    const jugadoresObj = jugadoresSnapshot.val();
    console.log('Players data retrieved:', Object.keys(jugadoresObj || {}));
    
    const jugadoresArray = Object.entries(jugadoresObj)
      .filter(([key]) => key.startsWith('Jugador_'))
      .map(([key, value]: [string, any]) => ({
        id: key,
        nombre: value.nombre || '',
        apellido: value.apellido || '',
        licencia: value.licencia || '',
      }));
    
    console.log('Parsed players:', jugadoresArray);
    
    if (jugadoresArray.length === 0) {
      throw new Error('No se encontraron jugadores en la competición');
    }
    
    const result: FirebaseCompetitionData = {
      codigo_grupo: codigoGrupo,
      nombre_competicion: competitionData.nombre_competicion || 'Competición',
      nombre_prueba: competitionData.nombre_prueba || 'Prueba',
      jugadores: jugadoresArray,
      campo: competitionData.campo || '',
      recorrido: competitionData.recorrido || '',
    };
    
    console.log('Final parsed competition data:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('=== ERROR FETCHING COMPETITION ===');
    console.error('Error details:', error);
    throw error;
  }
};

export interface LicensePlayer {
  licencia: string;
  nombre: string;
  apellido: string;
  handicap?: number;
}

export const searchPlayerLicenses = async (
  searchParams: { licencia?: string; nombre?: string; apellido?: string; codigoGrupo?: string }
): Promise<LicensePlayer[]> => {
  try {
    console.log('Searching player licenses with params:', searchParams);
    
    const isConnected = await checkConnection();
    if (!isConnected) {
      console.log('No internet connection available');
      throw new Error('No hay conexión a internet');
    }
    
    const dbRef = ref(database);
    let playersPath: string;
    
    if (searchParams.codigoGrupo && searchParams.codigoGrupo !== 'GLOBAL') {
      const normalizedCode = searchParams.codigoGrupo.trim().toUpperCase();
      playersPath = `pruebas_activas/codigo_grupo/${normalizedCode}/jugadores`;
      console.log('Searching players in competition at path:', playersPath);
    } else {
      playersPath = 'licencias_jugadores';
      console.log('Searching players in licenses database at path:', playersPath);
    }
    
    const snapshot = await get(child(dbRef, playersPath));
    
    if (!snapshot.exists()) {
      console.log('No players data found at path:', playersPath);
      return [];
    }
    
    const data = snapshot.val();
    let allPlayers: LicensePlayer[] = [];
    
    if (searchParams.codigoGrupo && searchParams.codigoGrupo !== 'GLOBAL') {
      allPlayers = Object.entries(data)
        .filter(([key]) => key.startsWith('Jugador_'))
        .map(([_, value]: [string, any]) => ({
          licencia: value.licencia || '',
          nombre: value.nombre || '',
          apellido: value.apellido || '',
          handicap: value.handicap,
        }));
    } else {
      allPlayers = Object.entries(data).map(([licencia, value]: [string, any]) => ({
        licencia: licencia,
        nombre: value.nombre || '',
        apellido: value.apellido || '',
        handicap: value.handicap,
      }));
    }
    
    const results = allPlayers.filter((player) => {
      let matches = true;
      
      if (searchParams.licencia && searchParams.licencia.trim()) {
        matches = matches && player.licencia?.toLowerCase().includes(searchParams.licencia.toLowerCase());
      }
      
      if (searchParams.nombre && searchParams.nombre.trim()) {
        matches = matches && player.nombre?.toLowerCase().includes(searchParams.nombre.toLowerCase());
      }
      
      if (searchParams.apellido && searchParams.apellido.trim()) {
        matches = matches && player.apellido?.toLowerCase().includes(searchParams.apellido.toLowerCase());
      }
      
      return matches;
    });
    
    console.log('Found players:', results.length);
    return results;
  } catch (error) {
    console.error('Error searching player licenses:', error);
    throw error;
  }
};

export const saveHoleScoreToFirebase = async (
  codigoGrupo: string,
  playerId: string,
  holeNumber: number,
  score: number,
  options?: { isOwnScore?: boolean; markerLicencia?: string }
): Promise<{ hasConflict: boolean; existingScore?: number }> => {
  try {
    console.log('=== SAVING HOLE SCORE TO FIREBASE ===');
    console.log('Código grupo:', codigoGrupo);
    console.log('Player ID:', playerId);
    console.log('Hole number:', holeNumber);
    console.log('Score:', score);
    console.log('Options:', options);
    
    const isConnected = await checkConnection();
    if (!isConnected) {
      console.log('No internet connection, score will be saved locally');
      throw new Error('No hay conexión a internet');
    }
    
    const normalizedCode = codigoGrupo.trim().toUpperCase();
    const fullPath = `pruebas_activas/codigo_grupo/${normalizedCode}/jugadores/${playerId}/hoyo_${holeNumber}`;
    console.log('Full Firebase path:', fullPath);
    
    const holeRef = ref(database, fullPath);
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, fullPath));
    
    const existingData = snapshot.exists() ? snapshot.val() : {};
    
    const scoreFieldName = options?.isOwnScore
      ? 'golpes_jugador'
      : options?.markerLicencia
        ? `golpes_${options.markerLicencia}`
        : 'golpes';
    
    console.log('Score field name:', scoreFieldName);
    
    let hasConflict = false;
    let existingScore: number | undefined;
    
    if (existingData[scoreFieldName] !== undefined) {
      existingScore = existingData[scoreFieldName];
      
      if (existingScore !== score) {
        console.log('⚠️ Score conflict detected:', existingScore, 'vs', score);
        hasConflict = true;
        return { hasConflict, existingScore };
      }
    }
    
    const updatedData = {
      ...existingData,
      [scoreFieldName]: score,
      timestamp: Date.now(),
    };
    
    await set(holeRef, updatedData);
    
    console.log('✅ Hole score saved to Firebase successfully at path:', fullPath, 'field:', scoreFieldName);
    return { hasConflict: false };
  } catch (error) {
    console.error('❌ Error saving hole score to Firebase:', error);
    throw error;
  }
};

export const syncCompetitionResults = async (
  codigoGrupo: string,
  playerScores: any[]
): Promise<void> => {
  try {
    console.log('Syncing competition results for code:', codigoGrupo);
    
    const isConnected = await checkConnection();
    if (!isConnected) {
      console.log('No internet connection, sync will happen later');
      return;
    }
    
    const resultsRef = ref(database, `resultados_competiciones/${codigoGrupo}`);
    await set(resultsRef, {
      scores: playerScores,
      timestamp: Date.now(),
      synced: true,
    });
    
    console.log('Competition results synced successfully');
  } catch (error) {
    console.error('Error syncing competition results:', error);
    throw error;
  }
};

export const updatePlayerReadyStatus = async (
  codigoGrupo: string,
  playerId: string,
  estado: 'preparado' | 'no_presentado' | 'no_preparado' | null
): Promise<void> => {
  try {
    console.log('=== UPDATING PLAYER READY STATUS ===');
    console.log('Código grupo:', codigoGrupo);
    console.log('Player ID:', playerId);
    console.log('Estado:', estado);
    
    const isConnected = await checkConnection();
    if (!isConnected) {
      throw new Error('No hay conexión a internet');
    }
    
    const normalizedCode = codigoGrupo.trim().toUpperCase();
    const fullPath = `pruebas_activas/codigo_grupo/${normalizedCode}/jugadores/${playerId}/estado`;
    console.log('Full Firebase path:', fullPath);
    
    const statusRef = ref(database, fullPath);
    const estadoToSave = estado === null ? 'no_preparado' : estado;
    await set(statusRef, estadoToSave);
    
    console.log('✅ Player ready status updated successfully with value:', estadoToSave);
  } catch (error) {
    console.error('❌ Error updating player ready status:', error);
    throw error;
  }
};

export const subscribeToPlayerStatuses = (
  codigoGrupo: string,
  callback: (players: { [key: string]: { estado?: 'preparado' | 'no_presentado' | 'no_preparado' | null } }) => void
): (() => void) => {
  const normalizedCode = codigoGrupo.trim().toUpperCase();
  const playersPath = `pruebas_activas/codigo_grupo/${normalizedCode}/jugadores`;
  const playersRef = ref(database, playersPath);
  
  const unsubscribe = onValue(playersRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      callback(data);
    }
  });
  
  return unsubscribe;
};

export const createFreePlayGame = async (
  courseName: string,
  routeName: string,
  gameName: string,
  groupName: string,
  password?: string
): Promise<void> => {
  try {
    console.log('=== CREATING FREE PLAY GAME IN FIREBASE ===');
    console.log('Course:', courseName);
    console.log('Route:', routeName);
    console.log('Game:', gameName);
    console.log('Group:', groupName);
    console.log('Has password:', !!password);
    
    const isConnected = await checkConnection();
    if (!isConnected) {
      throw new Error('No hay conexión a internet');
    }
    
    const gamePath = `pachangas_activas/${courseName}/${routeName}/${gameName}`;
    console.log('Game Firebase path:', gamePath);
    
    const gameRef = ref(database, gamePath);
    const gameSnapshot = await get(child(ref(database), gamePath));
    
    if (!gameSnapshot.exists()) {
      const gameData: any = {
        created_at: Date.now(),
        courseName,
        routeName,
      };
      
      if (password) {
        gameData.password = password;
      }
      
      await set(gameRef, gameData);
      console.log('✅ Game created at path:', gamePath);
    }
    
    const groupPath = `pachangas_activas/${courseName}/${routeName}/${gameName}/${groupName}`;
    console.log('Group Firebase path:', groupPath);
    
    const groupRef = ref(database, groupPath);
    
    const groupData: any = {
      created_at: Date.now(),
      groupName,
    };
    
    await set(groupRef, groupData);
    
    console.log('✅ Free play game created successfully in Firebase');
  } catch (error) {
    console.error('❌ Error creating free play game:', error);
    throw error;
  }
};

export const addGroupToExistingGame = async (
  courseName: string,
  routeName: string,
  gameName: string,
  groupName: string
): Promise<void> => {
  try {
    console.log('=== ADDING GROUP TO EXISTING GAME IN FIREBASE ===');
    console.log('Course:', courseName);
    console.log('Route:', routeName);
    console.log('Game:', gameName);
    console.log('Group:', groupName);
    
    const isConnected = await checkConnection();
    if (!isConnected) {
      throw new Error('No hay conexión a internet');
    }
    
    const groupPath = `pachangas_activas/${courseName}/${routeName}/${gameName}/${groupName}`;
    console.log('Group Firebase path:', groupPath);
    
    const groupRef = ref(database, groupPath);
    
    const groupData: any = {
      created_at: Date.now(),
      groupName,
    };
    
    await set(groupRef, groupData);
    
    console.log('✅ Group added to existing game successfully');
  } catch (error) {
    console.error('❌ Error adding group to existing game:', error);
    throw error;
  }
};

export const saveFreePlayPlayers = async (
  courseName: string,
  routeName: string,
  gameName: string,
  groupName: string,
  players: { nombre: string; apellido: string; handicap: string; licencia?: string }[]
): Promise<void> => {
  try {
    console.log('=== SAVING FREE PLAY PLAYERS TO FIREBASE ===');
    console.log('Course:', courseName);
    console.log('Route:', routeName);
    console.log('Group:', groupName);
    console.log('Players:', players);
    
    const isConnected = await checkConnection();
    if (!isConnected) {
      throw new Error('No hay conexión a internet');
    }
    
    const basePath = `pachangas_activas/${courseName}/${routeName}/${gameName}/${groupName}/jugadores`;
    console.log('Players Firebase path:', basePath);
    
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const playerPath = `${basePath}/jugador_${String(i + 1).padStart(2, '0')}`;
      
      const playerRef = ref(database, playerPath);
      
      const playerData: any = {
        nombre: player.nombre,
        apellido: player.apellido,
        handicap: player.handicap,
      };
      
      if (player.licencia) {
        playerData.licencia = player.licencia;
      }
      
      await set(playerRef, playerData);
      console.log(`✅ Player ${i + 1} saved at path:`, playerPath);
    }
    
    console.log('✅ All players saved successfully to Firebase');
  } catch (error) {
    console.error('❌ Error saving free play players:', error);
    throw error;
  }
};

export const linkDeviceToPlayer = async (
  courseName: string,
  routeName: string,
  gameName: string,
  groupName: string,
  playerKey: string,
  deviceId: string
): Promise<void> => {
  try {
    console.log('=== LINKING DEVICE TO PLAYER IN FIREBASE ===');
    console.log('Course:', courseName);
    console.log('Route:', routeName);
    console.log('Game:', gameName);
    console.log('Group:', groupName);
    console.log('Player Key:', playerKey);
    console.log('Device ID:', deviceId);
    
    const isConnected = await checkConnection();
    if (!isConnected) {
      throw new Error('No hay conexión a internet');
    }
    
    const devicePath = `pachangas_activas/${courseName}/${routeName}/${gameName}/${groupName}/jugadores/${playerKey}/deviceId`;
    console.log('Device link Firebase path:', devicePath);
    
    const deviceRef = ref(database, devicePath);
    
    await set(deviceRef, deviceId);
    
    console.log('✅ Device linked to player successfully in Firebase');
  } catch (error) {
    console.error('❌ Error linking device to player:', error);
    throw error;
  }
};

export const unlinkDeviceAndRemovePlayer = async (
  courseName: string,
  routeName: string,
  gameName: string,
  groupName: string,
  playerKey: string
): Promise<{ shouldDeleteGame: boolean }> => {
  try {
    console.log('=== UNLINKING DEVICE AND REMOVING PLAYER ===');
    console.log('Course:', courseName);
    console.log('Route:', routeName);
    console.log('Game:', gameName);
    console.log('Group:', groupName);
    console.log('Player Key:', playerKey);
    
    const isConnected = await checkConnection();
    if (!isConnected) {
      throw new Error('No hay conexión a internet');
    }
    
    const playerPath = `pachangas_activas/${courseName}/${routeName}/${gameName}/${groupName}/jugadores/${playerKey}`;
    console.log('Player Firebase path:', playerPath);
    
    const playerRef = ref(database, playerPath);
    await set(playerRef, null);
    
    console.log('✅ Player removed from Firebase');
    
    const groupPlayersPath = `pachangas_activas/${courseName}/${routeName}/${gameName}/${groupName}/jugadores`;
    const groupPlayersSnapshot = await get(child(ref(database), groupPlayersPath));
    
    let hasLinkedDevices = false;
    
    if (groupPlayersSnapshot.exists()) {
      const players = groupPlayersSnapshot.val();
      
      for (const key of Object.keys(players)) {
        const player = players[key];
        if (player && player.deviceId) {
          hasLinkedDevices = true;
          break;
        }
      }
    }
    
    console.log('Has linked devices in group:', hasLinkedDevices);
    
    if (!hasLinkedDevices) {
      console.log('No linked devices remaining, checking other groups...');
      
      const gameGroupsPath = `pachangas_activas/${courseName}/${routeName}/${gameName}`;
      const gameSnapshot = await get(child(ref(database), gameGroupsPath));
      
      let hasAnyLinkedDevices = false;
      
      if (gameSnapshot.exists()) {
        const gameData = gameSnapshot.val();
        
        for (const key of Object.keys(gameData)) {
          if (key === 'created_at' || key === 'courseName' || key === 'routeName' || key === 'password') {
            continue;
          }
          
          const groupData = gameData[key];
          if (groupData && groupData.jugadores) {
            for (const playerKey of Object.keys(groupData.jugadores)) {
              const player = groupData.jugadores[playerKey];
              if (player && player.deviceId) {
                hasAnyLinkedDevices = true;
                break;
              }
            }
          }
          
          if (hasAnyLinkedDevices) {
            break;
          }
        }
      }
      
      console.log('Has linked devices in any group:', hasAnyLinkedDevices);
      
      if (!hasAnyLinkedDevices) {
        console.log('No linked devices in entire game, deleting game...');
        
        const gameRef = ref(database, `pachangas_activas/${courseName}/${routeName}/${gameName}`);
        await set(gameRef, null);
        
        console.log('✅ Game deleted from Firebase');
        return { shouldDeleteGame: true };
      }
    }
    
    console.log('✅ Device unlinked and player removed successfully');
    return { shouldDeleteGame: false };
  } catch (error) {
    console.error('❌ Error unlinking device and removing player:', error);
    throw error;
  }
};

export const getActiveGamePlayers = async (
  courseName: string,
  routeName: string,
  gameName: string,
  groupName: string
): Promise<any> => {
  try {
    console.log('=== FETCHING ACTIVE GAME PLAYERS ===');
    console.log('Course:', courseName);
    console.log('Route:', routeName);
    console.log('Game:', gameName);
    console.log('Group:', groupName);
    
    const isConnected = await checkConnection();
    if (!isConnected) {
      throw new Error('No hay conexión a internet');
    }
    
    const groupPlayersPath = `pachangas_activas/${courseName}/${routeName}/${gameName}/${groupName}/jugadores`;
    console.log('Players Firebase path:', groupPlayersPath);
    
    const snapshot = await get(child(ref(database), groupPlayersPath));
    
    if (!snapshot.exists()) {
      console.log('No players found in Firebase');
      return null;
    }
    
    const players = snapshot.val();
    console.log('✅ Active game players fetched successfully');
    return players;
  } catch (error) {
    console.error('❌ Error fetching active game players:', error);
    throw error;
  }
};

export const forceUpdateHoleScore = async (
  codigoGrupo: string,
  playerId: string,
  holeNumber: number,
  score: number,
  oldScore: number
): Promise<void> => {
  try {
    console.log('=== FORCE UPDATING HOLE SCORE ===');
    console.log('Código grupo:', codigoGrupo);
    console.log('Player ID:', playerId);
    console.log('Hole number:', holeNumber);
    console.log('Old score:', oldScore);
    console.log('New score:', score);
    
    const isConnected = await checkConnection();
    if (!isConnected) {
      throw new Error('No hay conexión a internet');
    }
    
    const normalizedCode = codigoGrupo.trim().toUpperCase();
    const fullPath = `pruebas_activas/codigo_grupo/${normalizedCode}/jugadores/${playerId}/hoyo_${holeNumber}`;
    console.log('Full Firebase path:', fullPath);
    
    const holeRef = ref(database, fullPath);
    
    await set(holeRef, {
      golpes: score,
      timestamp: Date.now(),
      updated: true,
      oldScore,
    });
    
    const notificationPath = `pruebas_activas/codigo_grupo/${normalizedCode}/notificaciones/${Date.now()}`;
    const notificationRef = ref(database, notificationPath);
    
    await set(notificationRef, {
      type: 'score_change',
      playerId,
      holeNumber,
      oldScore,
      newScore: score,
      timestamp: Date.now(),
    });
    
    console.log('✅ Hole score force updated and notification sent');
  } catch (error) {
    console.error('❌ Error force updating hole score:', error);
    throw error;
  }
};

export const linkDeviceToCompetitionPlayer = async (
  codigoGrupo: string,
  playerId: string,
  deviceId: string
): Promise<void> => {
  try {
    console.log('=== LINKING DEVICE TO COMPETITION PLAYER ===');
    console.log('Código grupo:', codigoGrupo);
    console.log('Player ID:', playerId);
    console.log('Device ID:', deviceId);
    
    const isConnected = await checkConnection();
    if (!isConnected) {
      throw new Error('No hay conexión a internet');
    }
    
    const normalizedCode = codigoGrupo.trim().toUpperCase();
    const basePath = `pruebas_activas/codigo_grupo/${normalizedCode}/jugadores/${playerId}`;
    
    const devicePath = `${basePath}/deviceId`;
    console.log('Device link Firebase path:', devicePath);
    const deviceRef = ref(database, devicePath);
    await set(deviceRef, deviceId);
    
    const estadoPath = `${basePath}/estado`;
    console.log('Setting player status to conectado at:', estadoPath);
    const estadoRef = ref(database, estadoPath);
    await set(estadoRef, 'conectado');
    
    console.log('✅ Device linked and player status set to conectado');
  } catch (error) {
    console.error('❌ Error linking device to competition player:', error);
    throw error;
  }
};

export const updatePlayerConnectionStatus = async (
  codigoGrupo: string,
  playerId: string,
  status: 'conectado' | 'offline'
): Promise<void> => {
  try {
    console.log('=== UPDATING PLAYER CONNECTION STATUS ===');
    console.log('Código grupo:', codigoGrupo);
    console.log('Player ID:', playerId);
    console.log('Status:', status);
    
    const isConnected = await checkConnection();
    if (!isConnected) {
      throw new Error('No hay conexión a internet');
    }
    
    const normalizedCode = codigoGrupo.trim().toUpperCase();
    const estadoPath = `pruebas_activas/codigo_grupo/${normalizedCode}/jugadores/${playerId}/estado`;
    console.log('Status Firebase path:', estadoPath);
    
    const estadoRef = ref(database, estadoPath);
    await set(estadoRef, status);
    
    console.log(`✅ Player status updated to ${status}`);
  } catch (error) {
    console.error('❌ Error updating player connection status:', error);
    throw error;
  }
};

export const subscribeToCompetitionPlayers = (
  codigoGrupo: string,
  callback: (players: { [key: string]: { nombre?: string; apellido?: string; deviceId?: string; estado?: string } }) => void
): (() => void) => {
  const normalizedCode = codigoGrupo.trim().toUpperCase();
  const playersPath = `pruebas_activas/codigo_grupo/${normalizedCode}/jugadores`;
  console.log('[subscribeToCompetitionPlayers] Listening to path:', playersPath);
  
  const playersRef = ref(database, playersPath);
  
  const unsubscribe = onValue(playersRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      console.log('[subscribeToCompetitionPlayers] Data received:', Object.keys(data));
      callback(data);
    }
  });
  
  return unsubscribe;
};

export interface ProximaCompeticion {
  id_grupo: string;
  nombre_competicion: string;
  nombre_prueba: string;
  fecha: string;
  hora_salida: string;
  id_jugador?: string;
  numero_licencia?: string;
}

export const fetchProximaCompeticion = async (): Promise<ProximaCompeticion | null> => {
  try {
    console.log('=== FETCHING PROXIMA COMPETICION ===');
    
    const isConnected = await checkConnection();
    if (!isConnected) {
      throw new Error('No hay conexión a internet');
    }
    
    const dbRef = ref(database);
    const path = 'area_jugador/proxima_competicion';
    console.log('Fetching from path:', path);
    
    const snapshot = await get(child(dbRef, path));
    
    if (!snapshot.exists()) {
      console.log('No proxima competicion data found');
      return null;
    }
    
    const data = snapshot.val();
    console.log('Proxima competicion data:', data);
    
    const personalPath = 'area_jugador/personal';
    console.log('Fetching personal data from path:', personalPath);
    const personalSnapshot = await get(child(dbRef, personalPath));
    let numeroLicencia = '';
    if (personalSnapshot.exists()) {
      const personalData = personalSnapshot.val();
      numeroLicencia = personalData.numero_licencia || '';
      console.log('Numero licencia from personal:', numeroLicencia);
    } else {
      console.log('No personal data found, falling back to id_jugador');
    }
    
    return {
      id_grupo: data.id_grupo || '',
      nombre_competicion: data.nombre_competicion || '',
      nombre_prueba: data.nombre_prueba || '',
      fecha: data.fecha || '',
      hora_salida: data.hora_salida || '',
      id_jugador: data.id_jugador || '',
      numero_licencia: numeroLicencia,
    };
  } catch (error) {
    console.error('Error fetching proxima competicion:', error);
    throw error;
  }
};

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

export const findCompetitionByDeviceId = async (
  deviceId: string
): Promise<FoundCompetitionSession | null> => {
  try {
    console.log('=== SEARCHING COMPETITION BY DEVICE ID ===');
    console.log('Device ID:', deviceId);

    const isConnected = await checkConnection();
    if (!isConnected) {
      console.log('No internet connection');
      return null;
    }

    const dbRef = ref(database);
    const allCompetitionsPath = 'pruebas_activas/codigo_grupo';
    const snapshot = await get(child(dbRef, allCompetitionsPath));

    if (!snapshot.exists()) {
      console.log('No active competitions found');
      return null;
    }

    const allCompetitions = snapshot.val();

    for (const codigoGrupo of Object.keys(allCompetitions)) {
      const compData = allCompetitions[codigoGrupo];
      if (!compData || !compData.jugadores) continue;

      for (const jugadorKey of Object.keys(compData.jugadores)) {
        if (!jugadorKey.startsWith('Jugador_')) continue;
        const jugador = compData.jugadores[jugadorKey];

        if (jugador?.deviceId === deviceId) {
          console.log('✅ Found competition for device:', codigoGrupo, 'player:', jugadorKey);

          const jugadoresArray = Object.entries(compData.jugadores)
            .filter(([key]) => key.startsWith('Jugador_'))
            .map(([key, value]: [string, any]) => ({
              id: key,
              nombre: value.nombre || '',
              apellido: value.apellido || '',
              licencia: value.licencia || '',
            }));

          return {
            codigoGrupo,
            nombreCompeticion: compData.nombre_competicion || 'Competición',
            nombrePrueba: compData.nombre_prueba || 'Prueba',
            playerId: jugadorKey,
            playerNombre: jugador.nombre || '',
            playerApellido: jugador.apellido || '',
            jugadores: jugadoresArray,
            campo: compData.campo || '',
            recorrido: compData.recorrido || '',
          };
        }
      }
    }

    console.log('No competition found for this device');
    return null;
  } catch (error) {
    console.error('❌ Error searching competition by device ID:', error);
    return null;
  }
};

export const getPlayerHoleScores = async (
  codigoGrupo: string,
  playerId: string
): Promise<{ [key: string]: any }> => {
  try {
    console.log('=== FETCHING PLAYER HOLE SCORES ===');
    console.log('Código grupo:', codigoGrupo);
    console.log('Player ID:', playerId);

    const isConnected = await checkConnection();
    if (!isConnected) {
      return {};
    }

    const normalizedCode = codigoGrupo.trim().toUpperCase();
    const playerPath = `pruebas_activas/codigo_grupo/${normalizedCode}/jugadores/${playerId}`;
    const dbRef = ref(database);
    const snapshot = await get(child(dbRef, playerPath));

    if (!snapshot.exists()) {
      return {};
    }

    const data = snapshot.val();
    const holeScores: { [key: string]: any } = {};

    for (const key of Object.keys(data)) {
      if (key.startsWith('hoyo_')) {
        holeScores[key] = data[key];
      }
    }

    console.log('Player hole scores:', Object.keys(holeScores));
    return holeScores;
  } catch (error) {
    console.error('❌ Error fetching player hole scores:', error);
    return {};
  }
};

export const subscribeToCompetitionScores = (
  codigoGrupo: string,
  callback: (playersData: { [key: string]: any }) => void
): (() => void) => {
  const normalizedCode = codigoGrupo.trim().toUpperCase();
  const playersPath = `pruebas_activas/codigo_grupo/${normalizedCode}/jugadores`;
  console.log('[subscribeToCompetitionScores] Listening to path:', playersPath);

  const playersRef = ref(database, playersPath);

  const unsubscribe = onValue(playersRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      console.log('[subscribeToCompetitionScores] Data updated for:', normalizedCode);
      callback(data);
    }
  });

  return unsubscribe;
};

export const fetchCourseHoleHandicaps = async (
  courseName: string,
  routeName: string
): Promise<number[]> => {
  try {
    console.log('=== FETCHING COURSE HOLE HANDICAPS ===');
    console.log('Course:', courseName, 'Route:', routeName);

    if (!courseName || !routeName) {
      console.log('No course/route provided, returning defaults');
      return new Array(18).fill(0);
    }

    const dbRef = ref(database);
    const path = `recorridos/${courseName}/${routeName}`;
    console.log('Fetching from path:', path);

    const snapshot = await get(child(dbRef, path));

    if (!snapshot.exists()) {
      console.log('[fetchCourseHoleHandicaps] No course data found at path:', path);
      return new Array(18).fill(0);
    }

    const data = snapshot.val();
    const dataKeys = Object.keys(data);
    console.log('[fetchCourseHoleHandicaps] Raw data keys:', dataKeys);
    console.log('[fetchCourseHoleHandicaps] Full raw data:', JSON.stringify(data, null, 2));

    const handicaps: number[] = [];
    for (let _h = 0; _h < 18; _h++) {
      handicaps.push(0);
    }
    const hcpArr = handicaps as number[];

    const getHcpValue = (holeData: any): number => {
      if (!holeData || typeof holeData !== 'object') {
        if (typeof holeData === 'number') return holeData;
        return 0;
      }

      const directFields = [
        'handicap', 'hcp', 'Handicap', 'HCP', 'Hcp',
        'hdcp', 'HDCP', 'Hdcp', 'hándicap', 'Hándicap',
      ];
      for (const field of directFields) {
        if (holeData[field] !== undefined && holeData[field] !== null) {
          console.log(`[fetchCourseHoleHandicaps] Found handicap in field '${field}':`, holeData[field]);
          return typeof holeData[field] === 'number' ? holeData[field] : parseInt(holeData[field], 10) || 0;
        }
      }

      const keys = Object.keys(holeData);
      console.log(`[fetchCourseHoleHandicaps] Hole data fields:`, keys);
      const hcpKey = keys.find(k => {
        const lower = k.toLowerCase();
        return lower.includes('hcp') || lower.includes('handicap') || lower.includes('hdcp');
      });
      if (hcpKey && holeData[hcpKey] !== undefined && holeData[hcpKey] !== null) {
        console.log(`[fetchCourseHoleHandicaps] Found handicap via fuzzy match in field '${hcpKey}':`, holeData[hcpKey]);
        return typeof holeData[hcpKey] === 'number' ? holeData[hcpKey] : parseInt(holeData[hcpKey], 10) || 0;
      }

      console.log(`[fetchCourseHoleHandicaps] No handicap field found in:`, JSON.stringify(holeData));
      return 0;
    };

    for (let i = 1; i <= 18; i++) {
      const possibleKeys = [
        `hoyo_${i}`,
        `Hoyo_${i}`,
        `hoyo${i}`,
        `Hoyo${i}`,
        `hole_${i}`,
        `${i}`,
        String(i - 1),
      ];

      let found = false;
      for (const key of possibleKeys) {
        if (data[key] !== undefined) {
          const holeData = data[key];
          console.log(`[fetchCourseHoleHandicaps] Hole ${i} found with key '${key}':`, JSON.stringify(holeData));
          hcpArr[i - 1] = getHcpValue(holeData);
          found = true;
          break;
        }
      }

      if (!found) {
        console.log(`[fetchCourseHoleHandicaps] Hole ${i} NOT FOUND with any key format`);
      }
    }

    if (handicaps.every(h => h === 0) && dataKeys.length > 0) {
      console.log('[fetchCourseHoleHandicaps] All handicaps are 0, trying alternative structures...');

      if (Array.isArray(data)) {
        console.log('[fetchCourseHoleHandicaps] Data is an array with length:', data.length);
        for (let i = 0; i < Math.min(data.length, 18); i++) {
          hcpArr[i] = getHcpValue(data[i]);
        }
      } else {
        const sortedKeys = dataKeys.sort((a, b) => {
          const numA = parseInt(a.replace(/\D/g, ''), 10);
          const numB = parseInt(b.replace(/\D/g, ''), 10);
          return numA - numB;
        });
        console.log('[fetchCourseHoleHandicaps] Sorted keys:', sortedKeys);
        
        const firstKey = sortedKeys[0];
        const firstVal = data[firstKey];
        console.log('[fetchCourseHoleHandicaps] First entry key:', firstKey, 'value:', JSON.stringify(firstVal));
        if (typeof firstVal === 'object' && firstVal !== null) {
          console.log('[fetchCourseHoleHandicaps] First entry fields:', Object.keys(firstVal));
        }

        const holeKeys = sortedKeys.filter(k => {
          const num = parseInt(k.replace(/\D/g, ''), 10);
          return !isNaN(num) && num >= 1 && num <= 18;
        });

        if (holeKeys.length > 0) {
          console.log('[fetchCourseHoleHandicaps] Trying with filtered hole keys:', holeKeys);
          for (const key of holeKeys) {
            const num = parseInt(key.replace(/\D/g, ''), 10);
            if (num >= 1 && num <= 18) {
              hcpArr[num - 1] = getHcpValue(data[key]);
            }
          }
        }
      }
    }

    console.log('[fetchCourseHoleHandicaps] Final hole handicaps:', handicaps);
    return handicaps;
  } catch (error) {
    console.error('Error fetching course hole handicaps:', error);
    return new Array(18).fill(0);
  }
};

export { database };
