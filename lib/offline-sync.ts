import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import type { Competition, PlayerScores } from '@/types/game';

const STORAGE_KEYS = {
  COMPETITION: 'current_competition',
  SCORES: 'player_scores',
  CURRENT_HOLE: 'current_hole',
  HOLE_PARS: 'hole_pars',
  IS_COMPETITION: 'is_competition',
  PENDING_SYNC: 'pending_sync',
  DEVICE_ID: 'device_id',
  CURRENT_SCREEN: 'current_screen',
};

export interface GameData {
  competition: Competition | null;
  playerScoresMap: Map<string, PlayerScores>;
  currentHole: number;
  holePars: number[];
  isCompetition: boolean;
  currentScreen?: string;
}

export interface PendingSync {
  id: string;
  timestamp: number;
  type: 'competition_result' | 'player_scores' | 'hole_score';
  data: any;
}

export const saveGameDataLocally = async (data: GameData): Promise<void> => {
  try {
    console.log('Saving game data locally...');
    
    const itemsToSave: [string, string][] = [
      [STORAGE_KEYS.COMPETITION, JSON.stringify(data.competition)],
      [STORAGE_KEYS.SCORES, JSON.stringify(Array.from(data.playerScoresMap.entries()))],
      [STORAGE_KEYS.CURRENT_HOLE, data.currentHole.toString()],
      [STORAGE_KEYS.HOLE_PARS, JSON.stringify(data.holePars)],
      [STORAGE_KEYS.IS_COMPETITION, data.isCompetition.toString()],
    ];
    
    if (data.currentScreen) {
      itemsToSave.push([STORAGE_KEYS.CURRENT_SCREEN, data.currentScreen]);
    }
    
    await AsyncStorage.multiSet(itemsToSave);
    
    console.log('Game data saved locally');
  } catch (error) {
    console.error('Error saving game data locally:', error);
    throw error;
  }
};

export const loadGameDataLocally = async (): Promise<GameData | null> => {
  try {
    console.log('Loading game data from local storage...');
    
    const keys = [
      STORAGE_KEYS.COMPETITION,
      STORAGE_KEYS.SCORES,
      STORAGE_KEYS.CURRENT_HOLE,
      STORAGE_KEYS.HOLE_PARS,
      STORAGE_KEYS.IS_COMPETITION,
      STORAGE_KEYS.CURRENT_SCREEN,
    ];
    
    const values = await AsyncStorage.multiGet(keys);
    const dataMap = new Map(values);
    
    const competitionStr = dataMap.get(STORAGE_KEYS.COMPETITION);
    if (!competitionStr) {
      console.log('No local game data found');
      return null;
    }
    
    const competition = JSON.parse(competitionStr);
    const scoresArray = JSON.parse(dataMap.get(STORAGE_KEYS.SCORES) || '[]');
    const playerScoresMap = new Map<string, PlayerScores>(scoresArray);
    const currentHole = parseInt(dataMap.get(STORAGE_KEYS.CURRENT_HOLE) || '1');
    const holePars = JSON.parse(dataMap.get(STORAGE_KEYS.HOLE_PARS) || '[]');
    const isCompetition = dataMap.get(STORAGE_KEYS.IS_COMPETITION) === 'true';
    const currentScreen = dataMap.get(STORAGE_KEYS.CURRENT_SCREEN) || undefined;
    
    console.log('Game data loaded from local storage');
    
    return {
      competition,
      playerScoresMap,
      currentHole,
      holePars,
      isCompetition,
      currentScreen,
    };
  } catch (error) {
    console.error('Error loading game data locally:', error);
    return null;
  }
};

export const clearLocalGameData = async (): Promise<void> => {
  try {
    console.log('Clearing local game data...');
    await AsyncStorage.multiRemove([
      STORAGE_KEYS.COMPETITION,
      STORAGE_KEYS.SCORES,
      STORAGE_KEYS.CURRENT_HOLE,
      STORAGE_KEYS.HOLE_PARS,
      STORAGE_KEYS.IS_COMPETITION,
      STORAGE_KEYS.CURRENT_SCREEN,
    ]);
    console.log('Local game data cleared');
  } catch (error) {
    console.error('Error clearing local game data:', error);
  }
};

export const addPendingSync = async (syncData: Omit<PendingSync, 'id' | 'timestamp'>): Promise<void> => {
  try {
    console.log('Adding pending sync item:', syncData.type);
    
    const existingStr = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNC);
    const existing: PendingSync[] = existingStr ? JSON.parse(existingStr) : [];
    
    const newSync: PendingSync = {
      id: Date.now().toString() + Math.random(),
      timestamp: Date.now(),
      ...syncData,
    };
    
    existing.push(newSync);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(existing));
    
    console.log('Pending sync item added');
  } catch (error) {
    console.error('Error adding pending sync:', error);
  }
};

export const getPendingSync = async (): Promise<PendingSync[]> => {
  try {
    const existingStr = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNC);
    return existingStr ? JSON.parse(existingStr) : [];
  } catch (error) {
    console.error('Error getting pending sync:', error);
    return [];
  }
};

export const removePendingSync = async (id: string): Promise<void> => {
  try {
    const existing = await getPendingSync();
    const filtered = existing.filter((item) => item.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SYNC, JSON.stringify(filtered));
    console.log('Pending sync item removed:', id);
  } catch (error) {
    console.error('Error removing pending sync:', error);
  }
};

export const checkConnection = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable === true;
};

export const subscribeToConnectionChanges = (
  callback: (isConnected: boolean) => void
): (() => void) => {
  const unsubscribe = NetInfo.addEventListener((state) => {
    const isConnected = state.isConnected === true && state.isInternetReachable === true;
    callback(isConnected);
  });
  
  return unsubscribe;
};

export const generateDeviceId = async (): Promise<string> => {
  try {
    let deviceId = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
    
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
      console.log('Generated new device ID:', deviceId);
    } else {
      console.log('Using existing device ID:', deviceId);
    }
    
    return deviceId;
  } catch (error) {
    console.error('Error generating device ID:', error);
    return `device_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
};

export const getDeviceId = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  } catch (error) {
    console.error('Error getting device ID:', error);
    return null;
  }
};
