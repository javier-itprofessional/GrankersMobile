import createContextHook from '@nkzw/create-context-hook';
import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Player, PlayerScores, HoleScore } from '../types/game';
import { unlinkDeviceAndRemovePlayer, fetchCourseHoleHandicaps } from '@/config/firebase';
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

export const [FreePlayProvider, useFreePlay] = createContextHook(() => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentHole, setCurrentHole] = useState<number>(1);
  const [holePars, setHolePars] = useState<number[]>(generateHolePars());
  const [playerScoresMap, setPlayerScoresMap] = useState<Map<string, PlayerScores>>(new Map());
  const [gameStarted, setGameStarted] = useState<boolean>(false);
  const [courseName, setCourseName] = useState<string>('');
  const [routeName, setRouteName] = useState<string>('');
  const [gameName, setGameName] = useState<string>('');
  const [groupName, setGroupName] = useState<string>('');
  const [devicePlayerId, setDevicePlayerId] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [currentScreen, setCurrentScreen] = useState<string>('/game/scoring');
  const [holeHandicaps, setHoleHandicaps] = useState<number[]>(new Array(18).fill(0));

  useEffect(() => {
    restoreSession();
  }, []);

  const restoreSession = async () => {
    try {
      console.log('[FreePlay] Attempting to restore session...');
      const sessionData = await AsyncStorage.getItem('freePlaySession');
      
      if (sessionData) {
        const session = JSON.parse(sessionData);
        console.log('[FreePlay] Session found:', session);
        
        setPlayers(session.players || []);
        setCurrentHole(session.currentHole || 1);
        setHolePars(session.holePars || generateHolePars());
        setGameStarted(session.gameStarted || false);
        setCourseName(session.courseName || '');
        setRouteName(session.routeName || '');
        setGameName(session.gameName || '');
        setGroupName(session.groupName || '');
        setDevicePlayerId(session.devicePlayerId || '');
        setCurrentScreen(session.currentScreen || '/game/scoring');

        if (session.holeHandicaps && Array.isArray(session.holeHandicaps)) {
          console.log('[FreePlay] Restoring hole handicaps from session:', session.holeHandicaps);
          setHoleHandicaps(session.holeHandicaps);
        } else if (session.courseName && session.routeName) {
          console.log('[FreePlay] Re-fetching hole handicaps on restore:', session.courseName, session.routeName);
          fetchCourseHoleHandicaps(session.courseName, session.routeName).then((hcps) => {
            console.log('[FreePlay] Hole handicaps restored:', hcps);
            setHoleHandicaps(hcps);
          }).catch((err) => console.error('[FreePlay] Error restoring handicaps:', err));
        }

        if (session.playerScoresMap) {
          const scoresMap = new Map<string, PlayerScores>();
          Object.entries(session.playerScoresMap).forEach(([key, value]) => {
            scoresMap.set(key, value as PlayerScores);
          });
          setPlayerScoresMap(scoresMap);
        }
        
        console.log('[FreePlay] ✅ Session restored successfully');
      } else {
        console.log('[FreePlay] No session found');
      }
    } catch (error) {
      console.error('[FreePlay] ❌ Error restoring session:', error);
    } finally {
      setIsLoaded(true);
    }
  };

  const saveSession = useCallback(async (data: any) => {
    try {
      console.log('[FreePlay] Saving session...');
      await AsyncStorage.setItem('freePlaySession', JSON.stringify(data));
      console.log('[FreePlay] ✅ Session saved successfully');
    } catch (error) {
      console.error('[FreePlay] ❌ Error saving session:', error);
    }
  }, []);

  const clearSession = useCallback(async () => {
    try {
      console.log('[FreePlay] Clearing session...');
      await AsyncStorage.removeItem('freePlaySession');
      console.log('[FreePlay] ✅ Session cleared successfully');
    } catch (error) {
      console.error('[FreePlay] ❌ Error clearing session:', error);
    }
  }, []);

  const setCourseInfo = useCallback((course: string, route: string) => {
    console.log('[FreePlay] Setting course info:', { course, route });
    setCourseName(course);
    setRouteName(route);

    if (course && route) {
      fetchCourseHoleHandicaps(course, route).then((hcps) => {
        console.log('[FreePlay] Hole handicaps loaded:', hcps);
        setHoleHandicaps(hcps);
      }).catch((err) => console.error('[FreePlay] Error fetching handicaps:', err));
    }
  }, []);

  const setGameInfo = useCallback((game: string, group: string) => {
    console.log('[FreePlay] Setting game info:', { game, group });
    setGameName(game);
    setGroupName(group);
  }, []);

  const setDevicePlayer = useCallback((playerId: string) => {
    console.log('[FreePlay] Setting device player ID:', playerId);
    setDevicePlayerId(playerId);
  }, []);

  const startFreePlay = useCallback((playersList: Player[]) => {
    console.log('[FreePlay] Starting free play with players:', playersList);
    setPlayers(playersList);
    setGameStarted(true);
    setCurrentHole(1);
    const pars = generateHolePars();
    setHolePars(pars);
    
    const scoresMap = new Map<string, PlayerScores>();
    playersList.forEach((player) => {
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
    console.log('[FreePlay] Score map created for players:', Array.from(scoresMap.keys()));
    setPlayerScoresMap(scoresMap);
  }, []);

  useEffect(() => {
    if (gameStarted && isLoaded) {
      const scoresMapObject: { [key: string]: PlayerScores } = {};
      playerScoresMap.forEach((value, key) => {
        scoresMapObject[key] = value;
      });
      
      const sessionData = {
        players,
        currentHole,
        holePars,
        holeHandicaps,
        playerScoresMap: scoresMapObject,
        gameStarted,
        courseName,
        routeName,
        gameName,
        groupName,
        devicePlayerId,
        currentScreen,
      };
      
      saveSession(sessionData);
    }
  }, [players, currentHole, holePars, holeHandicaps, playerScoresMap, gameStarted, courseName, routeName, gameName, groupName, devicePlayerId, currentScreen, isLoaded, saveSession]);

  const updateScore = useCallback((playerId: string, holeNumber: number, newScore: number) => {
    console.log('[FreePlay] Updating score:', { playerId, holeNumber, newScore });
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

  const saveHole = useCallback((holeNumber: number) => {
    console.log('[FreePlay] Saving hole:', holeNumber);
    
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
  }, []);

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
  }, [players, playerScoresMap]);

  const resetFreePlay = useCallback(async () => {
    console.log('[FreePlay] Resetting free play...');
    
    try {
      if (courseName && routeName && gameName && groupName && devicePlayerId) {
        console.log('[FreePlay] Attempting to unlink device and remove player from Firebase...');
        console.log('[FreePlay] Course:', courseName);
        console.log('[FreePlay] Route:', routeName);
        console.log('[FreePlay] Game:', gameName);
        console.log('[FreePlay] Group:', groupName);
        console.log('[FreePlay] Device Player ID:', devicePlayerId);
        
        const playerKey = `jugador_${String(devicePlayerId).padStart(2, '0')}`;
        console.log('[FreePlay] Player Key to remove:', playerKey);
        
        const result = await unlinkDeviceAndRemovePlayer(
          courseName,
          routeName,
          gameName,
          groupName,
          playerKey
        );
        
        if (result.shouldDeleteGame) {
          console.log('[FreePlay] ✅ Game was deleted from Firebase (no more linked devices)');
        } else {
          console.log('[FreePlay] ✅ Player removed from Firebase (other players still in game)');
        }
      } else {
        console.log('[FreePlay] ⚠️ Missing game info, skipping Firebase cleanup');
        console.log('[FreePlay] courseName:', courseName);
        console.log('[FreePlay] routeName:', routeName);
        console.log('[FreePlay] gameName:', gameName);
        console.log('[FreePlay] groupName:', groupName);
        console.log('[FreePlay] devicePlayerId:', devicePlayerId);
      }
    } catch (error) {
      console.error('[FreePlay] ❌ Error removing player from Firebase:', error);
    }
    
    await clearSession();
    
    setPlayers([]);
    setCurrentHole(1);
    setHolePars(generateHolePars());
    setPlayerScoresMap(new Map());
    setGameStarted(false);
    setCourseName('');
    setRouteName('');
    setGameName('');
    setGroupName('');
    setDevicePlayerId('');
    setCurrentScreen('/game/scoring');
  }, [courseName, routeName, gameName, groupName, devicePlayerId, clearSession]);

  const updateCurrentScreen = useCallback((screen: string) => {
    setCurrentScreen(screen);
  }, []);

  return {
    players,
    currentHole,
    holePars,
    holeHandicaps,
    playerScoresMap,
    gameStarted,
    courseName,
    routeName,
    gameName,
    groupName,
    devicePlayerId,
    isLoaded,
    currentScreen,
    setCourseInfo,
    setGameInfo,
    setDevicePlayer,
    startFreePlay,
    updateScore,
    saveHole,
    goToNextHole,
    goToPreviousHole,
    goToHole,
    isHoleSaved,
    allHolesSaved,
    leaderboard,
    resetFreePlay,
    updateCurrentScreen,
  };
});
