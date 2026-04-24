import createContextHook from '@nkzw/create-context-hook';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
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
import { apiRequest } from '@/services/api';
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
  const [isSessionTerminated, setIsSessionTerminated] = useState(false);
  const devicePlayerPrevStatusRef = useRef<string | null>(null);
  const competitionRef = useRef<Competition | null>(null);
  const leaderboardPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Initial load ───────────────────────────────────────────────────────────

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
          groupCode: round.groupCode ?? '',
          competitionName: round.competitionName ?? '',
          eventName: round.eventName ?? '',
          courseName: round.courseName,
          routeName: round.routeName,
          date: round.date ?? undefined,
          players: players.map((p) => ({
            id: p.playerExternalId,
            firstName: p.firstName,
            lastName: p.lastName,
            license: p.license ?? undefined,
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
        for (const player of comp.players) {
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

        wsClient.connect(round.sessionUuid ?? round.id);
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

  // ─── WebSocket: real-time leaderboard ───────────────────────────────────────

  useEffect(() => {
    if (!activeRoundId) return;

    const unsub = wsClient.on('leaderboard_updated', (payload) => {
      if (payload.round_id === activeRoundId) {
        setWsLeaderboard(payload.leaderboard);
      }
    });

    return unsub;
  }, [activeRoundId]);

  // keep ref current so leaderboard poll always reads the latest competition
  competitionRef.current = competition;

  // ─── WebSocket: leaderboard REST fallback when WS drops 3× ──────────────────

  useEffect(() => {
    const stopPoll = () => {
      if (leaderboardPollRef.current) {
        clearInterval(leaderboardPollRef.current);
        leaderboardPollRef.current = null;
      }
    };

    const startPoll = () => {
      stopPoll();
      leaderboardPollRef.current = setInterval(async () => {
        const comp = competitionRef.current;
        if (!comp?.groupCode) return;
        try {
          const data = await apiRequest<{ leaderboard: LeaderboardEntry[] }>(
            `/api/v1/scoring/leaderboard/${encodeURIComponent(comp.groupCode)}/`
          );
          setWsLeaderboard(data.leaderboard);
        } catch {}
      }, 15_000);
    };

    const unsubMax = wsClient.on('max_retries_reached', startPoll);
    const unsubRecon = wsClient.on('reconnected', stopPoll);

    return () => {
      unsubMax();
      unsubRecon();
      stopPoll();
    };
  }, []);

  // ─── WebSocket: organizer lifecycle (§2.g, §2.h, §2.i) ──────────────────────

  useEffect(() => {
    devicePlayerPrevStatusRef.current = null;

    const unsubStatus = wsClient.on('player_status_changed', (payload) => {
      if (!currentDevicePlayerId || payload.player_id !== currentDevicePlayerId) return;
      const prev = devicePlayerPrevStatusRef.current;
      devicePlayerPrevStatusRef.current = payload.status;

      if (payload.status === 'withdrawn') {
        setIsSessionTerminated(true);
        Alert.alert('Retirado', 'Has sido retirado por el organizador.');
      } else if (payload.status === 'not_started' && (prev === 'ready' || prev === 'playing')) {
        setIsSessionTerminated(true);
        Alert.alert('Dispositivo desvinculado', 'Tu dispositivo fue desvinculado. Vuelve a escanear el código de grupo.');
      }
    });

    const unsubFinished = wsClient.on('round_finished', () => {
      setIsSessionTerminated(true);
    });

    return () => {
      unsubStatus();
      unsubFinished();
    };
  }, [currentDevicePlayerId]);

  // ─── Persist currentHole and currentScreen ──────────────────────────────────

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

  // ─── Actions ────────────────────────────────────────────────────────────────

  const startCompetition = useCallback(async (comp: Competition) => {
    let pars = generateHolePars();
    let hcps = new Array(18).fill(0);
    if (comp.courseName?.trim() && comp.routeName?.trim()) {
      const courseData = await getCourseRouteData(comp.courseName.trim(), comp.routeName.trim()).catch(() => null);
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
        r.courseName = comp.courseName ?? '';
        r.routeName = comp.routeName ?? '';
        r.currentHole = 1;
        r.status = 'in_progress';
        r.scoringMode = comp.scoringMode ?? 'all';
        r.visiblePlayerIds = '[]';
        r.holePars = JSON.stringify(pars);
        r.holeHandicaps = JSON.stringify(hcps);
        r.groupCode = comp.groupCode;
        r.competitionName = comp.competitionName;
        r.eventName = comp.eventName;
        r.date = comp.date ?? null;
        r.sessionUuid = comp.sessionUuid ?? null;
        r.createdAt = Date.now();
      });
      roundId = round.id;

      for (const player of comp.players) {
        await database.get<RoundPlayer>('round_players').create((rp) => {
          rp.roundId = round.id;
          rp.playerExternalId = player.id;
          rp.firstName = player.firstName;
          rp.lastName = player.lastName;
          rp.license = player.license ?? null;
          rp.handicap = player.handicap ?? null;
          rp.isLocalDevice = false;
          rp.status = 'not_started';
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
    comp.players.forEach((player) => {
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
    setScoringMode(comp.scoringMode ?? 'all');
    setVisiblePlayerIds([]);
    setWsLeaderboard(null);

    await syncEngine.record('ROUND_STARTED', {
      round_id: roundId,
      mode: 'competition',
    }, roundId);
    wsClient.connect(comp.sessionUuid ?? roundId);
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
    if (!competition || !activeRoundId || isSessionTerminated) return;

    const visiblePlayers = competition.players.filter(
      (p) => scoringMode === 'all' || visiblePlayerIds.includes(p.id)
    );

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
  }, [competition, activeRoundId, playerScoresMap, scoringMode, visiblePlayerIds, isSessionTerminated]);

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
    const players = competition?.players ?? [];
    if (!players.length) return [];

    if (wsLeaderboard) {
      return wsLeaderboard.map((entry) => {
        const player = players.find((p) => p.id === entry.player_id);
        return {
          player: player ?? { id: entry.player_id, firstName: entry.first_name, lastName: entry.last_name },
          totalScore: entry.total_score,
          totalPar: 0,
          score: entry.vs_par,
          holesCompleted: entry.holes_completed,
          position: entry.position,
        };
      });
    }

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
    scoringMode, visiblePlayerIds, isSessionActive: !isSessionTerminated,
    startCompetition, updateScore, saveHole,
    goToNextHole, goToPreviousHole, goToHole,
    isHoleSaved, allHolesSaved, leaderboard,
    resetCompetition, finishCompetition,
    setDevicePlayerId, clearDevicePlayerId,
    updateCurrentScreen, setScoringModeAndPlayers,
  }), [
    competition, currentHole, holePars, holeHandicaps, playerScoresMap,
    isOnline, isLoaded, currentDevicePlayerId, deviceId, currentScreen,
    scoringMode, visiblePlayerIds, isSessionTerminated,
    startCompetition, updateScore, saveHole,
    goToNextHole, goToPreviousHole, goToHole,
    isHoleSaved, allHolesSaved, leaderboard,
    resetCompetition, finishCompetition,
    setDevicePlayerId, clearDevicePlayerId,
    updateCurrentScreen, setScoringModeAndPlayers,
  ]);
});
