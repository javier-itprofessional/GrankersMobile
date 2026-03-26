import createContextHook from '@nkzw/create-context-hook';
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Competition, PlayerScores, HoleScore } from '../types/game';
import {
  saveGameDataLocally,
  loadGameDataLocally,
  clearLocalGameData,
  addPendingSync,
  getPendingSync,
  removePendingSync,
  subscribeToConnectionChanges,
  generateDeviceId,
} from '@/lib/offline-sync';
import { syncCompetitionResults, saveHoleScoreToFirebase, subscribeToCompetitionScores, fetchCourseHoleHandicaps } from '@/config/firebase';
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

export const [CompetitionProvider, useCompetition] = createContextHook(() => {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [currentHole, setCurrentHole] = useState<number>(1);
  const [holePars, setHolePars] = useState<number[]>(generateHolePars());
  const [playerScoresMap, setPlayerScoresMap] = useState<Map<string, PlayerScores>>(new Map());
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [currentDevicePlayerId, setCurrentDevicePlayerId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<string | undefined>(undefined);
  const [scoringMode, setScoringMode] = useState<'all' | 'partial'>('all');
  const [visiblePlayerIds, setVisiblePlayerIds] = useState<string[]>([]);
  const [holeHandicaps, setHoleHandicaps] = useState<number[]>(new Array(18).fill(0));

  const syncPendingData = useCallback(async () => {
    console.log('[Competition] Syncing pending data...');
    const pending = await getPendingSync();
    
    for (const item of pending) {
      try {
        if (item.type === 'competition_result') {
          await syncCompetitionResults(item.data.codigoGrupo, item.data.scores);
          await removePendingSync(item.id);
          console.log('[Competition] Synced item:', item.id);
        } else if (item.type === 'hole_score') {
          await saveHoleScoreToFirebase(
            item.data.codigoGrupo,
            item.data.playerId,
            item.data.holeNumber,
            item.data.score,
            { isOwnScore: item.data.isOwnScore, markerLicencia: item.data.markerLicencia }
          );
          await removePendingSync(item.id);
          console.log('[Competition] Synced hole score:', item.id);
        }
      } catch (error) {
        console.error('[Competition] Error syncing item:', item.id, error);
      }
    }
  }, []);

  useEffect(() => {
    const loadSavedData = async () => {
      const generatedDeviceId = await generateDeviceId();
      setDeviceId(generatedDeviceId);
      console.log('[Competition] Device ID initialized:', generatedDeviceId);
      
      const savedData = await loadGameDataLocally();
      if (savedData && savedData.isCompetition) {
        console.log('[Competition] Loading saved competition data...');
        setCompetition(savedData.competition);
        setPlayerScoresMap(savedData.playerScoresMap);
        setCurrentHole(savedData.currentHole);
        setHolePars(savedData.holePars);
        setCurrentScreen(savedData.currentScreen);

        if (savedData.competition?.campo && savedData.competition?.recorrido) {
          console.log('[Competition] Re-fetching hole handicaps on restore:', savedData.competition.campo, savedData.competition.recorrido);
          fetchCourseHoleHandicaps(savedData.competition.campo, savedData.competition.recorrido).then((hcps) => {
            console.log('[Competition] Hole handicaps restored:', hcps);
            setHoleHandicaps(hcps);
          }).catch((err) => console.error('[Competition] Error restoring handicaps:', err));
        }
      }
      
      const devicePlayerId = await AsyncStorage.getItem('currentDevicePlayerId');
      if (devicePlayerId) {
        console.log('[Competition] Loading device player ID:', devicePlayerId);
        setCurrentDevicePlayerId(devicePlayerId);
      }
      
      setIsLoaded(true);
    };

    loadSavedData();

    const unsubscribe = subscribeToConnectionChanges((connected) => {
      console.log('[Competition] Connection status changed:', connected);
      setIsOnline(connected);
      if (connected) {
        syncPendingData();
      }
    });

    return unsubscribe;
  }, [syncPendingData]);

  useEffect(() => {
    if (isLoaded && competition) {
      saveGameDataLocally({
        competition,
        playerScoresMap,
        currentHole,
        holePars,
        isCompetition: true,
        currentScreen,
      }).catch((error) => {
        console.error('[Competition] Error saving game data:', error);
      });
    }
  }, [competition, playerScoresMap, currentHole, holePars, currentScreen, isLoaded]);

  const startCompetition = useCallback((comp: Competition) => {
    console.log('[Competition] Starting competition:', JSON.stringify(comp));
    console.log('[Competition] Player IDs:', comp.jugadores.map(p => p.id));
    console.log('[Competition] campo:', JSON.stringify(comp.campo), 'recorrido:', JSON.stringify(comp.recorrido));
    setCompetition(comp);
    setCurrentHole(1);
    const pars = generateHolePars();
    setHolePars(pars);

    const campoVal = (comp.campo || '').trim();
    const recorridoVal = (comp.recorrido || '').trim();
    console.log('[Competition] campoVal:', JSON.stringify(campoVal), 'recorridoVal:', JSON.stringify(recorridoVal));

    if (campoVal && recorridoVal) {
      console.log('[Competition] Fetching hole handicaps for:', campoVal, recorridoVal);
      fetchCourseHoleHandicaps(campoVal, recorridoVal).then((hcps) => {
        console.log('[Competition] Hole handicaps loaded:', JSON.stringify(hcps));
        setHoleHandicaps(hcps);
      }).catch((err) => console.error('[Competition] Error fetching handicaps:', err));
    } else {
      console.log('[Competition] WARNING: No campo/recorrido available, handicaps will be 0');
    }

    const scoresMap = new Map<string, PlayerScores>();
    comp.jugadores.forEach((player) => {
      console.log(`[Competition] Creating score map for player: ${player.id}`);
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
    console.log('[Competition] Score map player IDs:', Array.from(scoresMap.keys()));
    setPlayerScoresMap(scoresMap);
  }, []);

  const updateScore = useCallback((playerId: string, holeNumber: number, newScore: number) => {
    console.log('[Competition] Updating score:', { playerId, holeNumber, newScore });
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
    console.log('[Competition] === SAVING HOLE ===');
    console.log('[Competition] Hole number:', holeNumber);
    console.log('[Competition] Current device player ID:', currentDevicePlayerId);
    
    const playersToSync: { playerId: string; score: number; isOwnScore: boolean; markerLicencia?: string }[] = [];
    
    if (!competition) {
      console.error('[Competition] No competition found');
      return;
    }

    const currentDevicePlayer = competition.jugadores.find(p => p.id === currentDevicePlayerId);
    const currentDeviceLicencia = currentDevicePlayer?.licencia || '';
    console.log('[Competition] Current device player licencia:', currentDeviceLicencia);

    const myIndex = competition.jugadores.findIndex(p => p.id === currentDevicePlayerId);
    const marcandoIndex = myIndex !== -1 ? (myIndex + 1) % competition.jugadores.length : -1;
    const marcandoId = marcandoIndex !== -1 ? competition.jugadores[marcandoIndex].id : null;
    console.log('[Competition] Marcando player ID:', marcandoId);

    competition.jugadores.forEach((player) => {
      const isVisible = scoringMode === 'all' || visiblePlayerIds.includes(player.id);
      if (!isVisible) return;

      console.log(`[Competition] Processing player - ID: ${player.id}, Name: ${player.nombre}`);
      const playerScores = playerScoresMap.get(player.id);
      
      if (!playerScores) {
        console.error(`[Competition] No scores found for player ${player.id}`);
        return;
      }
      
      const holeScore = playerScores.scores.find((s) => s.holeNumber === holeNumber);
      if (holeScore) {
        const isOwnScore = player.id === currentDevicePlayerId;
        const markerLicencia = !isOwnScore ? currentDeviceLicencia : undefined;
        playersToSync.push({ playerId: player.id, score: holeScore.score, isOwnScore, markerLicencia });
        console.log(`[Competition] ✓ Will save - Player ID: ${player.id}, Hole: ${holeNumber}, Score: ${holeScore.score}, isOwn: ${isOwnScore}, markerLicencia: ${markerLicencia}`);
      }
    });
    
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

    if (competition && competition.codigo_grupo) {
      for (const { playerId, score, isOwnScore, markerLicencia } of playersToSync) {
        console.log(`[Competition] Syncing player ${playerId} - hole ${holeNumber} - score ${score} - isOwn: ${isOwnScore} - markerLicencia: ${markerLicencia}`);
        try {
          if (isOnline) {
            const result = await saveHoleScoreToFirebase(
              competition.codigo_grupo,
              playerId,
              holeNumber,
              score,
              { isOwnScore, markerLicencia }
            );
            
            if (result.hasConflict) {
              console.log('[Competition] ⚠️ Conflict detected for player:', playerId);
              const player = competition.jugadores.find(p => p.id === playerId);
              return {
                hasConflict: true,
                playerId,
                existingScore: result.existingScore,
                newScore: score,
                playerName: player ? `${player.nombre} ${player.apellido}` : 'Jugador',
              };
            }
            
            console.log(`[Competition] ✅ Hole ${holeNumber} score saved to Firebase for player ${playerId}`);
          } else {
            throw new Error('No hay conexión a internet');
          }
        } catch (error: any) {
          if (error.message !== 'No hay conexión a internet') {
            throw error;
          }
          console.log(`[Competition] 💾 Saving hole ${holeNumber} score offline for player ${playerId}`);
          await addPendingSync({
            type: 'hole_score',
            data: {
              codigoGrupo: competition.codigo_grupo,
              playerId,
              holeNumber,
              score,
              isOwnScore,
              markerLicencia,
            },
          });
        }
      }
    }
  }, [competition, playerScoresMap, isOnline, currentDevicePlayerId, scoringMode, visiblePlayerIds]);

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

  const [firebaseScoresData, setFirebaseScoresData] = useState<{ [key: string]: any } | null>(null);

  useEffect(() => {
    if (!competition || !competition.codigo_grupo) return;

    console.log('[Competition] Subscribing to real-time competition scores...');
    const unsubscribe = subscribeToCompetitionScores(
      competition.codigo_grupo,
      (playersData) => {
        console.log('[Competition] Real-time scores updated from Firebase');
        setFirebaseScoresData(playersData);
      }
    );

    return () => {
      console.log('[Competition] Unsubscribing from competition scores');
      unsubscribe();
    };
  }, [competition?.codigo_grupo]);

  const leaderboard = useMemo(() => {
    const players = competition?.jugadores || [];
    if (!players.length) return [];

    const getMarkerForPlayer = (playerId: string): { markerId: string; markerLicencia: string } | null => {
      const playerIndex = players.findIndex(p => p.id === playerId);
      if (playerIndex === -1) return null;
      const markerIndex = (playerIndex - 1 + players.length) % players.length;
      const marker = players[markerIndex];
      return { markerId: marker.id, markerLicencia: marker.licencia || '' };
    };

    return players
      .map((player) => {
        const localScores = playerScoresMap.get(player.id);
        const marker = getMarkerForPlayer(player.id);
        const markerLicencia = marker?.markerLicencia || '';

        let markerTotalScore = 0;
        let markerHolesCompleted = 0;
        let markerTotalPar = 0;

        if (firebaseScoresData && firebaseScoresData[player.id] && markerLicencia) {
          const playerFirebaseData = firebaseScoresData[player.id];
          const markerField = `golpes_${markerLicencia}`;
          console.log(`[Competition] Leaderboard calc for ${player.nombre}: marker field = ${markerField}`);

          for (let h = 1; h <= 18; h++) {
            const holeData = playerFirebaseData[`hoyo_${h}`];
            if (holeData && holeData[markerField] !== undefined) {
              markerTotalScore += holeData[markerField];
              markerHolesCompleted++;
              markerTotalPar += holePars[h - 1] || 4;
            }
          }
        }

        const useFirebaseScore = markerHolesCompleted > 0;
        const totalScore = useFirebaseScore ? markerTotalScore : (localScores?.totalScore || 0);
        const totalPar = useFirebaseScore ? markerTotalPar : (localScores?.totalPar || 72);
        const holesCompleted = useFirebaseScore
          ? markerHolesCompleted
          : (localScores?.scores.filter((s) => s.saved).length || 0);

        return {
          player,
          totalScore,
          totalPar,
          score: holesCompleted > 0 ? totalScore - totalPar : 0,
          holesCompleted,
        };
      })
      .sort((a, b) => {
        if (a.holesCompleted === 0 && b.holesCompleted === 0) return 0;
        if (a.holesCompleted === 0) return 1;
        if (b.holesCompleted === 0) return -1;
        return a.score - b.score;
      });
  }, [competition, playerScoresMap, firebaseScoresData, holePars]);

  const resetCompetition = useCallback(() => {
    console.log('[Competition] Resetting competition...');
    setCompetition(null);
    setCurrentHole(1);
    setHolePars(generateHolePars());
    setPlayerScoresMap(new Map());
    setCurrentScreen(undefined);
    clearLocalGameData();
  }, []);

  const finishCompetition = useCallback(async () => {
    if (!competition) return;
    
    const scores = Array.from(playerScoresMap.values());
    
    if (isOnline && competition.codigo_grupo) {
      try {
        await syncCompetitionResults(competition.codigo_grupo, scores);
        console.log('[Competition] Competition results synced immediately');
      } catch (error) {
        console.error('[Competition] Error syncing results, will retry later:', error);
        await addPendingSync({
          type: 'competition_result',
          data: {
            codigoGrupo: competition.codigo_grupo,
            scores,
          },
        });
      }
    } else if (competition.codigo_grupo) {
      await addPendingSync({
        type: 'competition_result',
        data: {
          codigoGrupo: competition.codigo_grupo,
          scores,
        },
      });
      console.log('[Competition] Competition results queued for sync');
    }
  }, [competition, playerScoresMap, isOnline]);

  const setDevicePlayerId = useCallback(async (playerId: string) => {
    console.log('[Competition] Setting device player ID:', playerId);
    await AsyncStorage.setItem('currentDevicePlayerId', playerId);
    setCurrentDevicePlayerId(playerId);
  }, []);

  const setScoringModeAndPlayers = useCallback((mode: 'all' | 'partial', playerIds?: string[]) => {
    console.log('[Competition] Setting scoring mode:', mode, 'playerIds:', playerIds);
    setScoringMode(mode);
    if (playerIds) {
      setVisiblePlayerIds(playerIds);
    }
  }, []);

  const clearDevicePlayerId = useCallback(async () => {
    console.log('[Competition] Clearing device player ID');
    await AsyncStorage.removeItem('currentDevicePlayerId');
    setCurrentDevicePlayerId(null);
  }, []);

  const updateCurrentScreen = useCallback((screenName: string) => {
    console.log('[Competition] Updating current screen:', screenName);
    setCurrentScreen(screenName);
  }, []);

  return useMemo(() => ({
    competition,
    currentHole,
    holePars,
    holeHandicaps,
    playerScoresMap,
    isOnline,
    isLoaded,
    currentDevicePlayerId,
    deviceId,
    currentScreen,
    scoringMode,
    visiblePlayerIds,
    firebaseScoresData,
    startCompetition,
    updateScore,
    saveHole,
    goToNextHole,
    goToPreviousHole,
    goToHole,
    isHoleSaved,
    allHolesSaved,
    leaderboard,
    resetCompetition,
    finishCompetition,
    setDevicePlayerId,
    clearDevicePlayerId,
    updateCurrentScreen,
    setScoringModeAndPlayers,
  }), [
    competition,
    currentHole,
    holePars,
    holeHandicaps,
    playerScoresMap,
    isOnline,
    isLoaded,
    currentDevicePlayerId,
    deviceId,
    currentScreen,
    scoringMode,
    visiblePlayerIds,
    firebaseScoresData,
    startCompetition,
    updateScore,
    saveHole,
    goToNextHole,
    goToPreviousHole,
    goToHole,
    isHoleSaved,
    allHolesSaved,
    leaderboard,
    resetCompetition,
    finishCompetition,
    setDevicePlayerId,
    clearDevicePlayerId,
    updateCurrentScreen,
    setScoringModeAndPlayers,
  ]);
});
