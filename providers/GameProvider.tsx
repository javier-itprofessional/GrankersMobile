import createContextHook from '@nkzw/create-context-hook';
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Competition, PlayerScores, HoleScore } from '../types/game';
import { subscribeToConnectionChanges, generateDeviceId } from '@/lib/offline-sync';
import { syncEngine } from '@/services/sync-engine';
import AsyncStorage from '@react-native-async-storage/async-storage';

const generateHolePars = (): number[] => {
  const pars: number[] = [];
  let totalPar = 0;
  
  for (let i = 0; i < 18; i++) {
    let par: number;
    const remaining = 18 - i;
    const maxAvg = Math.floor((72 - totalPar) / remaining);
    const minAvg = Math.ceil((72 - totalPar) / remaining);
    
    if (maxAvg >= 5) {
      par = Math.random() > 0.5 ? 5 : 4;
    } else if (minAvg <= 3) {
      par = Math.random() > 0.5 ? 3 : 4;
    } else {
      par = 4;
    }
    
    par = Math.max(3, Math.min(5, par));
    
    if (totalPar + par + (remaining - 1) * 3 > 72) {
      par = 3;
    }
    if (totalPar + par + (remaining - 1) * 5 < 72) {
      par = 5;
    }
    
    pars.push(par);
    totalPar += par;
  }
  
  const diff = 72 - totalPar;
  if (diff !== 0) {
    for (let i = 0; i < Math.abs(diff); i++) {
      const idx = Math.floor(Math.random() * 18);
      if (diff > 0 && pars[idx] < 5) {
        pars[idx]++;
      } else if (diff < 0 && pars[idx] > 3) {
        pars[idx]--;
      }
    }
  }
  
  return pars;
};

export const [GameProvider, useGame] = createContextHook(() => {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [currentHole, setCurrentHole] = useState<number>(1);
  const [isCompetition, setIsCompetition] = useState<boolean>(false);
  const [holePars, setHolePars] = useState<number[]>(generateHolePars());
  const [playerScoresMap, setPlayerScoresMap] = useState<Map<string, PlayerScores>>(new Map());
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [currentDevicePlayerId, setCurrentDevicePlayerId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<string | undefined>(undefined);

  const syncPendingData = useCallback(async () => {
    console.log('Syncing pending data...');
    await syncEngine.flush().catch((error) => {
      console.error('Error flushing sync engine:', error);
    });
  }, []);

  useEffect(() => {
    const loadSavedData = async () => {
      const generatedDeviceId = await generateDeviceId();
      setDeviceId(generatedDeviceId);
      console.log('Device ID initialized:', generatedDeviceId);
      
      // Legacy GameProvider: game state is now managed by CompetitionProvider via WatermelonDB

      
      const devicePlayerId = await AsyncStorage.getItem('currentDevicePlayerId');
      if (devicePlayerId) {
        console.log('Loading device player ID:', devicePlayerId);
        setCurrentDevicePlayerId(devicePlayerId);
      }
      
      setIsLoaded(true);
    };

    loadSavedData();

    const unsubscribe = subscribeToConnectionChanges((connected) => {
      console.log('Connection status changed:', connected);
      setIsOnline(connected);
      if (connected) {
        syncPendingData();
      }
    });

    return unsubscribe;
  }, [syncPendingData]);


  const startCompetition = useCallback((comp: Competition) => {
    console.log('Starting competition:', comp);
    console.log('Player IDs:', comp.players.map(p => p.id));
    setCompetition(comp);
    setIsCompetition(true);
    setCurrentHole(1);
    const pars = generateHolePars();
    setHolePars(pars);

    const scoresMap = new Map<string, PlayerScores>();
    comp.players.forEach((player) => {
      console.log(`Creating score map for player: ${player.id}`);
      const scores: HoleScore[] = [];
      for (let i = 1; i <= 18; i++) {
        scores.push({
          holeNumber: i,
          par: pars[i - 1],
          score: pars[i - 1],
          saved: false,
        });
      }
      scoresMap.set(player.id, {
        playerId: player.id,
        scores,
        totalScore: 0,
        totalPar: 72,
      });
    });
    console.log('Score map player IDs:', Array.from(scoresMap.keys()));
    setPlayerScoresMap(scoresMap);
  }, []);

  const startFreePlay = useCallback((players: { id: string; firstName: string; lastName: string }[]) => {
    console.log('Starting free play with players:', players);
    setIsCompetition(false);
    setCurrentHole(1);
    const pars = generateHolePars();
    setHolePars(pars);

    const comp: Competition = {
      groupCode: '',
      competitionName: 'Free Play',
      eventName: 'Free Play',
      players: players.map((p) => ({ ...p, handicap: 0 })),
    };
    setCompetition(comp);
    
    const scoresMap = new Map<string, PlayerScores>();
    players.forEach((player) => {
      const scores: HoleScore[] = [];
      for (let i = 1; i <= 18; i++) {
        scores.push({
          holeNumber: i,
          par: pars[i - 1],
          score: pars[i - 1],
          saved: false,
        });
      }
      scoresMap.set(player.id, {
        playerId: player.id,
        scores,
        totalScore: 0,
        totalPar: 72,
      });
    });
    setPlayerScoresMap(scoresMap);
  }, []);

  const updateScore = useCallback((playerId: string, holeNumber: number, newScore: number) => {
    console.log('Updating score:', { playerId, holeNumber, newScore });
    setPlayerScoresMap((prev) => {
      const newMap = new Map(prev);
      const playerScores = newMap.get(playerId);
      if (playerScores) {
        const updatedScores = playerScores.scores.map((score) =>
          score.holeNumber === holeNumber ? { ...score, score: newScore } : score
        );
        newMap.set(playerId, {
          ...playerScores,
          scores: updatedScores,
        });
      }
      return newMap;
    });
  }, []);

  const saveHole = useCallback(async (holeNumber: number): Promise<{ hasConflict: boolean; playerId?: string; existingScore?: number; newScore?: number; playerName?: string } | void> => {
    console.log('=== SAVING HOLE ===');
    console.log('Hole number:', holeNumber);
    console.log('Competition:', competition);
    console.log('Competition players:', competition?.players.map(p => ({ id: p.id, firstName: p.firstName })));
    console.log('PlayerScoresMap size:', playerScoresMap.size);
    console.log('PlayerScoresMap keys:', Array.from(playerScoresMap.keys()));
    
    const playersToSync: { playerId: string; score: number }[] = [];
    
    if (!competition) {
      console.error('No competition found');
      return;
    }

    competition.players.forEach((player) => {
      console.log(`Processing player from competition - ID: ${player.id}, Name: ${player.firstName}`);
      const playerScores = playerScoresMap.get(player.id);
      
      if (!playerScores) {
        console.error(`No scores found for player ${player.id}`);
        return;
      }
      
      const holeScore = playerScores.scores.find((s) => s.holeNumber === holeNumber);
      if (holeScore) {
        playersToSync.push({ playerId: player.id, score: holeScore.score });
        console.log(`✓ Will save - Player ID: ${player.id}, Hole: ${holeNumber}, Score: ${holeScore.score}`);
      } else {
        console.log(`✗ No hole score found for player ${player.id} at hole ${holeNumber}`);
      }
    });

    if (competition && competition.groupCode) {
      const roundId = competition.groupCode;
      const playerHoleScores = Array.from(playerScoresMap.values()).flatMap((ps) =>
        ps.scores.filter((s) => s.holeNumber === holeNumber)
      );
      for (const { playerId, score } of playersToSync) {
        const holeData = playerHoleScores.find((s) => s.holeNumber === holeNumber);
        await syncEngine.record(
          'HOLE_SAVED',
          { round_id: roundId, player_id: playerId, hole_number: holeNumber, strokes: score },
          roundId
        ).catch(() => {});
      }
    }
    
    setPlayerScoresMap((prev) => {
      const newMap = new Map(prev);
      newMap.forEach((playerScores, playerId) => {
        const updatedScores = playerScores.scores.map((score) =>
          score.holeNumber === holeNumber ? { ...score, saved: true } : score
        );
        const savedScores = updatedScores.filter((s) => s.saved);
        const total = savedScores.reduce((sum, s) => sum + s.score, 0);
        const totalParPlayed = savedScores.reduce((sum, s) => sum + s.par, 0);
        newMap.set(playerId, {
          ...playerScores,
          scores: updatedScores,
          totalScore: total,
          totalPar: totalParPlayed,
        });
      });
      return newMap;
    });
  }, [competition, playerScoresMap, isOnline]);

  const goToNextHole = useCallback(() => {
    if (currentHole < 18) {
      setCurrentHole((prev) => prev + 1);
    }
  }, [currentHole]);

  const goToPreviousHole = useCallback(() => {
    if (currentHole > 1) {
      setCurrentHole((prev) => prev - 1);
    }
  }, [currentHole]);

  const goToHole = useCallback((holeNumber: number) => {
    if (holeNumber >= 1 && holeNumber <= 18) {
      setCurrentHole(holeNumber);
    }
  }, []);

  const isHoleSaved = useCallback((holeNumber: number): boolean => {
    const firstPlayer = Array.from(playerScoresMap.values())[0];
    if (!firstPlayer) return false;
    const hole = firstPlayer.scores.find((s) => s.holeNumber === holeNumber);
    return hole?.saved || false;
  }, [playerScoresMap]);

  const allHolesSaved = useMemo(() => {
    if (playerScoresMap.size === 0) return false;
    const firstPlayer = Array.from(playerScoresMap.values())[0];
    return firstPlayer.scores.every((s) => s.saved);
  }, [playerScoresMap]);

  const leaderboard = useMemo(() => {
    const players = competition?.players || [];
    return players
      .map((player) => {
        const scores = playerScoresMap.get(player.id);
        return {
          player,
          totalScore: scores?.totalScore || 0,
          totalPar: scores?.totalPar || 72,
          score: (scores?.totalScore || 0) - (scores?.totalPar || 72),
          holesCompleted: scores?.scores.filter((s) => s.saved).length || 0,
        };
      })
      .sort((a, b) => a.totalScore - b.totalScore);
  }, [competition, playerScoresMap]);

  const resetGame = useCallback(() => {
    setCompetition(null);
    setCurrentHole(1);
    setIsCompetition(false);
    setHolePars(generateHolePars());
    setPlayerScoresMap(new Map());
    setCurrentScreen(undefined);
  }, []);

  const finishCompetition = useCallback(async () => {
    if (!competition) return;
    if (competition.groupCode) {
      await syncEngine.record('ROUND_FINISHED', { round_id: competition.groupCode }, competition.groupCode).catch(() => {});
      await syncEngine.flush().catch((error) => {
        console.error('Error syncing results:', error);
      });
      console.log('Competition finished, sync engine flushed');
    }
  }, [competition]);

  const setDevicePlayerId = useCallback(async (playerId: string) => {
    console.log('Setting device player ID:', playerId);
    await AsyncStorage.setItem('currentDevicePlayerId', playerId);
    setCurrentDevicePlayerId(playerId);
  }, []);

  const clearDevicePlayerId = useCallback(async () => {
    console.log('Clearing device player ID');
    await AsyncStorage.removeItem('currentDevicePlayerId');
    setCurrentDevicePlayerId(null);
  }, []);

  const updateCurrentScreen = useCallback((screenName: string) => {
    console.log('Updating current screen:', screenName);
    setCurrentScreen(screenName);
  }, []);

  return useMemo(() => ({
    competition,
    currentHole,
    isCompetition,
    holePars,
    playerScoresMap,
    isOnline,
    isLoaded,
    currentDevicePlayerId,
    deviceId,
    currentScreen,
    startCompetition,
    startFreePlay,
    updateScore,
    saveHole,
    goToNextHole,
    goToPreviousHole,
    goToHole,
    isHoleSaved,
    allHolesSaved,
    leaderboard,
    resetGame,
    finishCompetition,
    setDevicePlayerId,
    clearDevicePlayerId,
    updateCurrentScreen,
  }), [
    competition,
    currentHole,
    isCompetition,
    holePars,
    playerScoresMap,
    isOnline,
    isLoaded,
    currentDevicePlayerId,
    deviceId,
    currentScreen,
    startCompetition,
    startFreePlay,
    updateScore,
    saveHole,
    goToNextHole,
    goToPreviousHole,
    goToHole,
    isHoleSaved,
    allHolesSaved,
    leaderboard,
    resetGame,
    finishCompetition,
    setDevicePlayerId,
    clearDevicePlayerId,
    updateCurrentScreen,
  ]);
});
