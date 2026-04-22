import createContextHook from '@nkzw/create-context-hook';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { Q } from '@nozbe/watermelondb';
import type { Competition, PlayerScores, HoleScore } from '../types/game';
import {
  subscribeToConnectionChanges,
  generateDeviceId,
  getAppConfig,
  setAppConfig,
  removeAppConfig,
} from '@/lib/offline-sync';
import { getCourseRouteData } from '@/services/course-service';
import { syncEngine } from '@/services/sync-engine';
import { wsClient } from '@/services/websocket';
import type { LeaderboardEntry } from '@/services/websocket';
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

export const [CompetitionProvider, useCompetition] = createContextHook(() => {
  const [competition, setCompetition] = useState<Competition | null>(null);
  const [currentHole, setCurrentHole] = useState(1);
  const [holePars, setHolePars] = useState<number[]>(generateHolePars());
  const [holeHandicaps, setHoleHandicaps] = useState<number[]>(new Array(18).fill(0));
  const [playerScoresMap, setPlayerScoresMap] = useState<Map<string, PlayerScores>>(new Map());
  const [isOnline, setIsOnline] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentDevicePlayerId, setCurrentDevicePlayerId] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<string | undefined>(undefined);
  const [scoringMode, setScoringMode] = useState<'all' | 'partial'>('all');
  const [visiblePlayerIds, setVisiblePlayerIds] = useState<string[]>([]);
  const [activeRoundId, setActiveRoundId] = useState<string | null>(null);
  const [wsLeaderboard, setWsLeaderboard] = useState<LeaderboardEntry[] | null>(null);

  // ─── Carga inicial ──────────────────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      const generatedDeviceId = await generateDeviceId();
      setDeviceId(generatedDeviceId);

      const activeRounds = await database
        .get<Round>('rounds')
        .query(Q.and(Q.where('mode', 'competition'), Q.where('status', Q.notEq('finished'))))
        .fetch();

      if (activeRounds.length > 0) {
        const round = activeRounds[0];
        setActiveRoundId(round.id);

        const players = await database
          .get<RoundPlayer>('round_players')
          .query(Q.where('round_id', round.id))
          .fetch();

        const comp: Competition = {
          codigo_grupo: round.codigoGrupo ?? '',
          nombre_competicion: round.nombreCompeticion ?? '',
          nombre_prueba: round.nombrePrueba ?? '',
          campo: round.courseName,
          recorrido: round.routeName,
          fecha: round.fecha ?? undefined,
          jugadores: players.map((p) => ({
            id: p.playerExternalId,
            nombre: p.nombre,
            apellido: p.apellido,
            licencia: p.licencia ?? undefined,
            handicap: p.handicap ?? undefined,
          })),
        };
        setCompetition(comp);
        setCurrentHole(round.currentHole);
        setHolePars(round.holeParsArray);
        setHoleHandicaps(round.holeHandicapsArray);
        setCurrentScreen(round.currentScreen ?? undefined);
        setScoringMode((round.scoringMode as 'all' | 'partial') ?? 'all');
        setVisiblePlayerIds(round.visiblePlayerIdsArray);

        const holeScores = await database
          .get<HoleScoreModel>('hole_scores')
          .query(Q.where('round_id', round.id))
          .fetch();

        const scoresMap = new Map<string, PlayerScores>();
        for (const player of comp.jugadores) {
          const playerHoles = holeScores
            .filter((h) => h.playerExternalId === player.id)
            .sort((a, b) => a.holeNumber - b.holeNumber);
          const scores: HoleScore[] = playerHoles.map((h) => ({
            holeNumber: h.holeNumber, par: h.par, score: h.score, saved: h.saved,
          }));
          const saved = scores.filter((s) => s.saved);
          scoresMap.set(player.id, {
            playerId: player.id, scores,
            totalScore: saved.reduce((sum, s) => sum + s.score, 0),
            totalPar: saved.reduce((sum, s) => sum + s.par, 0),
          });
        }
        setPlayerScoresMap(scoresMap);

        // Conectar WebSocket para esta ronda
        wsClient.connect(round.id);
      }

      const savedDevicePlayerId = await getAppConfig('currentDevicePlayerId');
      if (savedDevicePlayerId) setCurrentDevicePlayerId(savedDevicePlayerId);

      setIsLoaded(true);
    };

    load();
    syncEngine.start();

    const unsubscribe = subscribeToConnectionChanges((connected) => {
      setIsOnline(connected);
      if (connected) syncEngine.flush();
    });

    return () => {
      unsubscribe();
      syncEngine.stop();
      wsClient.disconnect();
    };
  }, []);

  // ─── Suscripción WebSocket: leaderboard en tiempo real ──────────────────────

  useEffect(() => {
    if (!activeRoundId) return;

    const unsub = wsClient.on('leaderboard_updated', (payload) => {
      if (payload.round_id === activeRoundId) {
        setWsLeaderboard(payload.leaderboard);
      }
    });

    return unsub;
  }, [activeRoundId]);

  // ─── Persistir currentHole y currentScreen ──────────────────────────────────

  useEffect(() => {
    if (!activeRoundId || !isLoaded) return;
    database.write(async () => {
      const round = await database.get<Round>('rounds').find(activeRoundId);
      await round.update((r) => {
        r.currentHole = currentHole;
        r.currentScreen = currentScreen ?? null;
      });
    });
  }, [currentHole, currentScreen, activeRoundId, isLoaded]);

  // ─── Acciones ───────────────────────────────────────────────────────────────

  const startCompetition = useCallback(async (comp: Competition) => {
    let pars = generateHolePars();
    let hcps = new Array(18).fill(0);
    if (comp.campo?.trim() && comp.recorrido?.trim()) {
      const courseData = await getCourseRouteData(comp.campo.trim(), comp.recorrido.trim()).catch(() => null);
      if (courseData) {
        pars = courseData.holes.map((h) => h.par);
        hcps = courseData.holes.map((h) => h.handicap);
      }
    }

    let roundId = '';
    await database.write(async () => {
      const old = await database
        .get<Round>('rounds')
        .query(Q.and(Q.where('mode', 'competition'), Q.where('status', Q.notEq('finished'))))
        .fetch();
      for (const r of old) await r.destroyPermanently();

      const round = await database.get<Round>('rounds').create((r) => {
        r.mode = 'competition';
        r.courseName = comp.campo ?? '';
        r.routeName = comp.recorrido ?? '';
        r.currentHole = 1;
        r.status = 'in_progress';
        r.scoringMode = 'all';
        r.visiblePlayerIds = '[]';
        r.holePars = JSON.stringify(pars);
        r.holeHandicaps = JSON.stringify(hcps);
        r.codigoGrupo = comp.codigo_grupo;
        r.nombreCompeticion = comp.nombre_competicion;
        r.nombrePrueba = comp.nombre_prueba;
        r.fecha = comp.fecha ?? null;
        r.createdAt = Date.now();
      });
      roundId = round.id;

      for (const player of comp.jugadores) {
        await database.get<RoundPlayer>('round_players').create((rp) => {
          rp.roundId = round.id;
          rp.playerExternalId = player.id;
          rp.nombre = player.nombre;
          rp.apellido = player.apellido;
          rp.licencia = player.licencia ?? null;
          rp.handicap = player.handicap ?? null;
          rp.isLocalDevice = false;
          rp.estado = 'pendiente';
        });
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
    comp.jugadores.forEach((player) => {
      scoresMap.set(player.id, {
        playerId: player.id,
        scores: Array.from({ length: 18 }, (_, i) => ({
          holeNumber: i + 1, par: pars[i], score: pars[i], saved: false,
        })),
        totalScore: 0, totalPar: 72,
      });
    });

    setCompetition(comp);
    setCurrentHole(1);
    setHolePars(pars);
    setHoleHandicaps(hcps);
    setPlayerScoresMap(scoresMap);
    setActiveRoundId(roundId);
    setCurrentScreen(undefined);
    setScoringMode('all');
    setVisiblePlayerIds([]);
    setWsLeaderboard(null);

    // Registrar acción + conectar WebSocket
    await syncEngine.record('ROUND_STARTED', {
      round_id: roundId,
      mode: 'competition',
    }, roundId);
    wsClient.connect(roundId);
  }, []);

  const updateScore = useCallback((playerId: string, holeNumber: number, newScore: number) => {
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

  const saveHole = useCallback(async (holeNumber: number): Promise<void> => {
    if (!competition || !activeRoundId) return;

    const visiblePlayers = competition.jugadores.filter(
      (p) => scoringMode === 'all' || visiblePlayerIds.includes(p.id)
    );

    // Persistir en DB local
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
        }
      }
    });

    setPlayerScoresMap((prev) => {
      const next = new Map(prev);
      next.forEach((ps, id) => {
        const updated = ps.scores.map((s) => s.holeNumber === holeNumber ? { ...s, saved: true } : s);
        const saved = updated.filter((s) => s.saved);
        next.set(id, { ...ps, scores: updated, totalScore: saved.reduce((n, s) => n + s.score, 0), totalPar: saved.reduce((n, s) => n + s.par, 0) });
      });
      return next;
    });

    // ONE event for the whole group (spec v2.4.0 §2.2)
    const scores = visiblePlayers
      .map((player) => {
        const holeScore = playerScoresMap.get(player.id)?.scores.find((s) => s.holeNumber === holeNumber);
        return holeScore ? { player_id: player.id, score: holeScore.score } : null;
      })
      .filter((s): s is { player_id: string; score: number } => s !== null);

    if (scores.length > 0) {
      await syncEngine.record('HOLE_SAVED', { round_id: activeRoundId, hole_number: holeNumber, scores }, activeRoundId);
    }
  }, [competition, activeRoundId, playerScoresMap, scoringMode, visiblePlayerIds]);

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

  const resetCompetition = useCallback(async () => {
    if (activeRoundId) {
      await database.write(async () => {
        const holeScores = await database.get<HoleScoreModel>('hole_scores').query(Q.where('round_id', activeRoundId)).fetch();
        for (const hs of holeScores) await hs.destroyPermanently();
        const roundPlayers = await database.get<RoundPlayer>('round_players').query(Q.where('round_id', activeRoundId)).fetch();
        for (const rp of roundPlayers) await rp.destroyPermanently();
        const round = await database.get<Round>('rounds').find(activeRoundId);
        await round.destroyPermanently();
      });
      wsClient.disconnect();
    }
    setCompetition(null);
    setCurrentHole(1);
    setHolePars(generateHolePars());
    setPlayerScoresMap(new Map());
    setCurrentScreen(undefined);
    setActiveRoundId(null);
    setWsLeaderboard(null);
  }, [activeRoundId]);

  const finishCompetition = useCallback(async () => {
    if (!competition || !activeRoundId) return;

    await database.write(async () => {
      const round = await database.get<Round>('rounds').find(activeRoundId);
      await round.update((r) => { r.status = 'finished'; r.finishedAt = Date.now(); });
    });

    await syncEngine.record('ROUND_FINISHED', { round_id: activeRoundId }, activeRoundId);
    await syncEngine.flush();
  }, [competition, activeRoundId]);

  const setDevicePlayerId = useCallback(async (playerId: string) => {
    await setAppConfig('currentDevicePlayerId', playerId);
    setCurrentDevicePlayerId(playerId);
  }, []);

  const clearDevicePlayerId = useCallback(async () => {
    await removeAppConfig('currentDevicePlayerId');
    setCurrentDevicePlayerId(null);
  }, []);

  const setScoringModeAndPlayers = useCallback(async (mode: 'all' | 'partial', playerIds?: string[]) => {
    const ids = playerIds ?? [];
    setScoringMode(mode);
    setVisiblePlayerIds(ids);
    if (activeRoundId) {
      await database.write(async () => {
        const round = await database.get<Round>('rounds').find(activeRoundId);
        await round.update((r) => { r.scoringMode = mode; r.visiblePlayerIds = JSON.stringify(ids); });
      });
    }
  }, [activeRoundId]);

  const updateCurrentScreen = useCallback((screenName: string) => setCurrentScreen(screenName), []);

  // ─── Leaderboard (WebSocket > local) ────────────────────────────────────────

  const leaderboard = useMemo(() => {
    const players = competition?.jugadores ?? [];
    if (!players.length) return [];

    // Si el backend ya envió el leaderboard por WS, usarlo directamente
    if (wsLeaderboard) {
      return wsLeaderboard.map((entry) => {
        const player = players.find((p) => p.id === entry.player_id);
        return {
          player: player ?? { id: entry.player_id, nombre: entry.nombre, apellido: entry.apellido },
          totalScore: entry.total_score,
          totalPar: 0,
          score: entry.vs_par,
          holesCompleted: entry.holes_completed,
          position: entry.position,
        };
      });
    }

    // Fallback: calcular localmente
    return players
      .map((player) => {
        const ps = playerScoresMap.get(player.id);
        const saved = ps?.scores.filter((s) => s.saved) ?? [];
        return {
          player,
          totalScore: ps?.totalScore ?? 0,
          totalPar: ps?.totalPar ?? 72,
          score: saved.length > 0 ? (ps?.totalScore ?? 0) - (ps?.totalPar ?? 0) : 0,
          holesCompleted: saved.length,
        };
      })
      .sort((a, b) => {
        if (a.holesCompleted === 0 && b.holesCompleted === 0) return 0;
        if (a.holesCompleted === 0) return 1;
        if (b.holesCompleted === 0) return -1;
        return a.score - b.score;
      });
  }, [competition, playerScoresMap, wsLeaderboard]);

  return useMemo(() => ({
    competition, currentHole, holePars, holeHandicaps, playerScoresMap,
    isOnline, isLoaded, currentDevicePlayerId, deviceId, currentScreen,
    scoringMode, visiblePlayerIds,
    startCompetition, updateScore, saveHole,
    goToNextHole, goToPreviousHole, goToHole,
    isHoleSaved, allHolesSaved, leaderboard,
    resetCompetition, finishCompetition,
    setDevicePlayerId, clearDevicePlayerId,
    updateCurrentScreen, setScoringModeAndPlayers,
  }), [
    competition, currentHole, holePars, holeHandicaps, playerScoresMap,
    isOnline, isLoaded, currentDevicePlayerId, deviceId, currentScreen,
    scoringMode, visiblePlayerIds,
    startCompetition, updateScore, saveHole,
    goToNextHole, goToPreviousHole, goToHole,
    isHoleSaved, allHolesSaved, leaderboard,
    resetCompetition, finishCompetition,
    setDevicePlayerId, clearDevicePlayerId,
    updateCurrentScreen, setScoringModeAndPlayers,
  ]);
});
