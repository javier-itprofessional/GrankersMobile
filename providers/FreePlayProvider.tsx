import createContextHook from '@nkzw/create-context-hook';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Q } from '@nozbe/watermelondb';
import type { Player, PlayerScores, HoleScore } from '../types/game';
import { getCourseRouteData } from '@/services/course-service';
import { syncEngine } from '@/services/sync-engine';
import { wsClient } from '@/services/websocket';
import { database, Round, RoundPlayer, HoleScore as HoleScoreModel } from '@/database';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateHolePars = (): number[] => {
  const pars: number[] = [];
  let totalPar = 0;
  for (let i = 0; i < 18; i++) {
    let par: number;
    const remaining = 18 - i;
    const maxAvg = Math.floor((72 - totalPar) / remaining);
    const minAvg = Math.ceil((72 - totalPar) / remaining);
    if (maxAvg >= 5) par = Math.random() > 0.5 ? 5 : 4;
    else if (minAvg <= 3) par = Math.random() > 0.5 ? 3 : 4;
    else par = 4;
    par = Math.max(3, Math.min(5, par));
    if (totalPar + par + (remaining - 1) * 3 > 72) par = 3;
    if (totalPar + par + (remaining - 1) * 5 < 72) par = 5;
    pars.push(par);
    totalPar += par;
  }
  const diff = 72 - totalPar;
  if (diff !== 0) {
    for (let i = 0; i < Math.abs(diff); i++) {
      const idx = Math.floor(Math.random() * 18);
      if (diff > 0 && pars[idx] < 5) pars[idx]++;
      else if (diff < 0 && pars[idx] > 3) pars[idx]--;
    }
  }
  return pars;
};

// ─── Provider ─────────────────────────────────────────────────────────────────

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
  const [holeHandicaps, setHoleHandicaps] = useState<number[]>(new Array(18).fill(0));
  const [isLoaded, setIsLoaded] = useState<boolean>(false);
  const [currentScreen, setCurrentScreen] = useState<string>('/game/scoring');
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);

  // ─── Lifecycle: sync engine + websocket ───────────────────────────────────

  useEffect(() => {
    syncEngine.start();
    return () => {
      syncEngine.stop();
      wsClient.disconnect();
    };
  }, []);

  // ─── Carga inicial desde WatermelonDB ───────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      const activeRounds = await database
        .get<Round>('rounds')
        .query(Q.and(Q.where('mode', 'free-play'), Q.where('status', Q.notEq('finished'))))
        .fetch();

      if (activeRounds.length > 0) {
        const round = activeRounds[0];
        setActiveRoundId(round.id);

        const roundPlayerRecords = await database
          .get<RoundPlayer>('round_players')
          .query(Q.where('round_id', round.id))
          .fetch();

        const restoredPlayers: Player[] = roundPlayerRecords.map((p) => ({
          id: p.playerExternalId,
          firstName: p.firstName,
          lastName: p.lastName,
          license: p.license ?? undefined,
          handicap: p.handicap ?? undefined,
          isDevice: p.isLocalDevice,
        }));

        const localDevice = roundPlayerRecords.find((p) => p.isLocalDevice);

        const holeScores = await database
          .get<HoleScoreModel>('hole_scores')
          .query(Q.where('round_id', round.id))
          .fetch();

        const scoresMap = new Map<string, PlayerScores>();
        for (const player of restoredPlayers) {
          const playerHoles = holeScores
            .filter((h) => h.playerExternalId === player.id)
            .sort((a, b) => a.holeNumber - b.holeNumber);
          const scores: HoleScore[] = playerHoles.map((h) => ({
            holeNumber: h.holeNumber,
            par: h.par,
            score: h.score,
            saved: h.saved,
          }));
          const savedScores = scores.filter((s) => s.saved);
          scoresMap.set(player.id, {
            playerId: player.id,
            scores,
            totalScore: savedScores.reduce((sum, s) => sum + s.score, 0),
            totalPar: savedScores.reduce((sum, s) => sum + s.par, 0),
          });
        }

        setPlayers(restoredPlayers);
        setCurrentHole(round.currentHole);
        setHolePars(round.holeParsArray);
        setHoleHandicaps(round.holeHandicapsArray);
        setCourseName(round.courseName);
        setRouteName(round.routeName);
        setGameName(round.gameName ?? '');
        setGroupName(round.groupName ?? '');
        setDevicePlayerId(localDevice?.playerExternalId ?? '');
        setCurrentScreen(round.currentScreen ?? '/game/scoring');
        setPlayerScoresMap(scoresMap);
        setGameStarted(true);

        wsClient.connect(round.sessionUuid ?? round.id);
      }

      setIsLoaded(true);
    };

    load();
  }, []);

  // ─── Persistir currentHole y currentScreen cuando cambian ──────────────────

  useEffect(() => {
    if (!activeRoundId || !isLoaded || !gameStarted) return;
    database.write(async () => {
      const round = await database.get<Round>('rounds').find(activeRoundId);
      await round.update((r) => {
        r.currentHole = currentHole;
        r.currentScreen = currentScreen;
      });
    });
  }, [currentHole, currentScreen, activeRoundId, isLoaded, gameStarted]);

  // ─── Acciones ───────────────────────────────────────────────────────────────

  const setCourseInfo = useCallback((course: string, route: string) => {
    setCourseName(course);
    setRouteName(route);
    if (course && route) {
      getCourseRouteData(course, route)
        .then((data) => {
          if (data) setHoleHandicaps(data.holes.map((h) => h.handicap));
        })
        .catch(() => {});
    }
  }, []);

  const setGameInfo = useCallback((game: string, group: string) => {
    setGameName(game);
    setGroupName(group);
  }, []);

  const setDevicePlayer = useCallback((playerId: string) => {
    setDevicePlayerId(playerId);
  }, []);

  const startFreePlay = useCallback(async (playersList: Player[], sessionUuid?: string) => {
    // Obtener pars y handicaps reales del campo (o fallback aleatorio)
    let pars = generateHolePars();
    let hcps = holeHandicaps;
    if (courseName && routeName) {
      const courseData = await getCourseRouteData(courseName, routeName).catch(() => null);
      if (courseData) {
        pars = courseData.holes.map((h) => h.par);
        hcps = courseData.holes.map((h) => h.handicap);
        setHoleHandicaps(hcps);
      }
    }

    let roundId = '';
    await database.write(async () => {
      // Borrar partidas libres previas sin terminar
      const old = await database
        .get<Round>('rounds')
        .query(Q.and(Q.where('mode', 'free-play'), Q.where('status', Q.notEq('finished'))))
        .fetch();
      for (const r of old) {
        const oldScores = await database.get<HoleScoreModel>('hole_scores').query(Q.where('round_id', r.id)).fetch();
        for (const s of oldScores) await s.destroyPermanently();
        const oldPlayers = await database.get<RoundPlayer>('round_players').query(Q.where('round_id', r.id)).fetch();
        for (const p of oldPlayers) await p.destroyPermanently();
        await r.destroyPermanently();
      }

      const round = await database.get<Round>('rounds').create((r) => {
        r.mode = 'free-play';
        r.courseName = courseName;
        r.routeName = routeName;
        r.currentHole = 1;
        r.status = 'in_progress';
        r.scoringMode = 'all';
        r.visiblePlayerIds = '[]';
        r.holePars = JSON.stringify(pars);
        r.holeHandicaps = JSON.stringify(hcps);
        r.gameName = gameName;
        r.groupName = groupName;
        r.sessionUuid = sessionUuid ?? null;
        r.currentScreen = '/game/scoring';
        r.createdAt = Date.now();
      });
      roundId = round.id;

      for (const player of playersList) {
        await database.get<RoundPlayer>('round_players').create((rp) => {
          rp.roundId = round.id;
          rp.playerExternalId = player.id;
          rp.firstName = player.firstName;
          rp.lastName = player.lastName;
          rp.license = player.license ?? null;
          rp.handicap = typeof player.handicap === 'number' ? player.handicap : null;
          rp.isLocalDevice = player.isDevice ?? false;
          rp.status = 'not_started';
        });
      }

      for (const player of playersList) {
        for (let i = 1; i <= 18; i++) {
          await database.get<HoleScoreModel>('hole_scores').create((hs) => {
            hs.roundId = round.id;
            hs.playerExternalId = player.id;
            hs.holeNumber = i;
            hs.par = pars[i - 1];
            hs.handicap = hcps[i - 1] ?? 0;
            hs.score = pars[i - 1];
            hs.saved = false;
          });
        }
      }
    });

    const scoresMap = new Map<string, PlayerScores>();
    playersList.forEach((player) => {
      scoresMap.set(player.id, {
        playerId: player.id,
        scores: Array.from({ length: 18 }, (_, i) => ({
          holeNumber: i + 1,
          par: pars[i],
          score: pars[i],
          saved: false,
        })),
        totalScore: 0,
        totalPar: 72,
      });
    });

    setPlayers(playersList);
    setCurrentHole(1);
    setHolePars(pars);
    setPlayerScoresMap(scoresMap);
    setGameStarted(true);
    setActiveRoundId(roundId);

    syncEngine.record('ROUND_STARTED', { round_id: roundId, mode: 'free-play' }, roundId).catch(() => {});
    wsClient.connect(sessionUuid ?? roundId);
  }, [courseName, routeName, gameName, groupName, holeHandicaps]);

  const updateScore = useCallback((playerId: string, holeNumber: number, newScore: number) => {
    // Solo actualiza memoria — se persiste al guardar el hoyo
    setPlayerScoresMap((prev) => {
      const next = new Map(prev);
      const ps = next.get(playerId);
      if (ps) {
        next.set(playerId, {
          ...ps,
          scores: ps.scores.map((s) => s.holeNumber === holeNumber ? { ...s, score: newScore } : s),
        });
      }
      return next;
    });
  }, []);

  const saveHole = useCallback(async (holeNumber: number) => {
    if (!activeRoundId) return;

    const savedScores: Array<{ playerId: string; score: number; par: number; handicap: number }> = [];

    await database.write(async () => {
      const dbScores = await database
        .get<HoleScoreModel>('hole_scores')
        .query(Q.and(Q.where('round_id', activeRoundId), Q.where('hole_number', holeNumber)))
        .fetch();

      for (const dbScore of dbScores) {
        const inMemory = playerScoresMap.get(dbScore.playerExternalId)?.scores.find((s) => s.holeNumber === holeNumber);
        if (inMemory) {
          await dbScore.update((r) => {
            r.score = inMemory.score;
            r.saved = true;
            r.savedAt = Date.now();
          });
          savedScores.push({
            playerId: dbScore.playerExternalId,
            score: inMemory.score,
            par: dbScore.par,
            handicap: dbScore.handicap,
          });
        }
      }
    });

    // ONE event for the whole group (spec v2.4.0 §2.2)
    if (savedScores.length > 0) {
      syncEngine.record(
        'HOLE_SAVED',
        {
          round_id: activeRoundId,
          hole_number: holeNumber,
          scores: savedScores.map((s) => ({ player_id: s.playerId, score: s.score })),
        },
        activeRoundId
      ).catch(() => {});
    }

    setPlayerScoresMap((prev) => {
      const next = new Map(prev);
      next.forEach((ps, playerId) => {
        const updatedScores = ps.scores.map((s) => s.holeNumber === holeNumber ? { ...s, saved: true } : s);
        const saved = updatedScores.filter((s) => s.saved);
        next.set(playerId, {
          ...ps,
          scores: updatedScores,
          totalScore: saved.reduce((sum, s) => sum + s.score, 0),
          totalPar: saved.reduce((sum, s) => sum + s.par, 0),
        });
      });
      return next;
    });
  }, [activeRoundId, playerScoresMap]);

  const goToNextHole = useCallback(() => setCurrentHole((h) => Math.min(h + 1, 18)), []);
  const goToPreviousHole = useCallback(() => setCurrentHole((h) => Math.max(h - 1, 1)), []);
  const goToHole = useCallback((n: number) => { if (n >= 1 && n <= 18) setCurrentHole(n); }, []);

  const isHoleSaved = useCallback((holeNumber: number): boolean => {
    const first = Array.from(playerScoresMap.values())[0];
    return first?.scores.find((s) => s.holeNumber === holeNumber)?.saved ?? false;
  }, [playerScoresMap]);

  const allHolesSaved = useMemo(() => {
    const first = Array.from(playerScoresMap.values())[0];
    return !!first && first.scores.every((s) => s.saved);
  }, [playerScoresMap]);

  const leaderboard = useMemo(() => {
    return players
      .map((player) => {
        const scores = playerScoresMap.get(player.id);
        return {
          player,
          totalScore: scores?.totalScore ?? 0,
          totalPar: scores?.totalPar ?? 72,
          score: (scores?.totalScore ?? 0) - (scores?.totalPar ?? 72),
          holesCompleted: scores?.scores.filter((s) => s.saved).length ?? 0,
        };
      })
      .sort((a, b) => a.totalScore - b.totalScore);
  }, [players, playerScoresMap]);

  const resetFreePlay = useCallback(async () => {
    if (activeRoundId) {
      await syncEngine.record('ROUND_FINISHED', { round_id: activeRoundId }, activeRoundId).catch(() => {});
      await syncEngine.flush().catch(() => {});
    }

    // Limpiar WatermelonDB
    if (activeRoundId) {
      await database.write(async () => {
        const holeScores = await database.get<HoleScoreModel>('hole_scores').query(Q.where('round_id', activeRoundId)).fetch();
        for (const hs of holeScores) await hs.destroyPermanently();
        const roundPlayers = await database.get<RoundPlayer>('round_players').query(Q.where('round_id', activeRoundId)).fetch();
        for (const rp of roundPlayers) await rp.destroyPermanently();
        const round = await database.get<Round>('rounds').find(activeRoundId);
        await round.destroyPermanently();
      });
    }

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
    setActiveRoundId(null);
  }, [courseName, routeName, gameName, groupName, devicePlayerId, activeRoundId]);

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
    activeRoundId,
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
