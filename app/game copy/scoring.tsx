import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import type { HoleScore } from '../../types/game';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { Minus, Plus, ArrowLeft, LogOut, ChevronRight, Trophy, CreditCard } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useCompetition } from '../../providers/CompetitionProvider';
import { useFreePlay } from '../../providers/FreePlayProvider';
import ConnectionStatus from '../../components/ConnectionStatus';

export default function ScoringScreen() {
  const router = useRouter();
  const { competition: competitionData, isOnline: competitionIsOnline, currentDevicePlayerId, scoringMode, visiblePlayerIds } = useCompetition();
  const { players, gameStarted } = useFreePlay();
  
  const isCompetitionMode = competitionData !== null;
  const isFreePlayMode = gameStarted;
  const isOnline = isCompetitionMode ? competitionIsOnline : true;

  const {
    currentHole: compHole,
    holePars: compPars,
    holeHandicaps: compHandicaps,
    playerScoresMap: compScoresMap,
    updateScore: compUpdateScore,
    saveHole: compSaveHole,
    goToNextHole: compGoToNextHole,
    goToPreviousHole: compGoToPreviousHole,
    isHoleSaved: compIsHoleSaved,
    resetCompetition,
  } = useCompetition();

  const {
    currentHole: freeHole,
    holePars: freePars,
    holeHandicaps: freeHandicaps,
    playerScoresMap: freeScoresMap,
    updateScore: freeUpdateScore,
    saveHole: freeSaveHole,
    goToNextHole: freeGoToNextHole,
    goToPreviousHole: freeGoToPreviousHole,
    isHoleSaved: freeIsHoleSaved,
    resetFreePlay,
    updateCurrentScreen,
  } = useFreePlay();

  const { gameName, groupName } = useFreePlay();

  const competition = isCompetitionMode ? competitionData : (isFreePlayMode ? {
    codigo_grupo: '',
    nombre_competicion: gameName || 'Partida Libre',
    nombre_prueba: groupName || 'Grupo',
    jugadores: players,
  } : null);

  const currentHole = isCompetitionMode ? compHole : freeHole;
  const holePars = isCompetitionMode ? compPars : freePars;
  const holeHandicaps = isCompetitionMode ? compHandicaps : freeHandicaps;
  const playerScoresMap = isCompetitionMode ? compScoresMap : freeScoresMap;
  const updateScore = isCompetitionMode ? compUpdateScore : freeUpdateScore;
  const saveHole = isCompetitionMode ? compSaveHole : freeSaveHole;
  const goToNextHole = isCompetitionMode ? compGoToNextHole : freeGoToNextHole;
  const goToPreviousHole = isCompetitionMode ? compGoToPreviousHole : freeGoToPreviousHole;
  const isHoleSaved = isCompetitionMode ? compIsHoleSaved : freeIsHoleSaved;
  const resetGame = isCompetitionMode ? resetCompetition : resetFreePlay;
  const [editMode, setEditMode] = useState<boolean>(false);

  const marcandoPlayerId = useMemo(() => {
    if (!isCompetitionMode || !competition || !currentDevicePlayerId) return null;
    const jugadores = competition.jugadores;
    const myIndex = jugadores.findIndex(p => p.id === currentDevicePlayerId);
    if (myIndex === -1) return null;
    const nextIndex = (myIndex + 1) % jugadores.length;
    return jugadores[nextIndex].id;
  }, [isCompetitionMode, competition, currentDevicePlayerId]);

  const miMarcadorId = useMemo(() => {
    if (!isCompetitionMode || !competition || !currentDevicePlayerId) return null;
    const jugadores = competition.jugadores;
    const myIndex = jugadores.findIndex(p => p.id === currentDevicePlayerId);
    if (myIndex === -1) return null;
    const prevIndex = (myIndex - 1 + jugadores.length) % jugadores.length;
    return jugadores[prevIndex].id;
  }, [isCompetitionMode, competition, currentDevicePlayerId]);

  const sortedPlayers = useMemo(() => {
    if (!competition) return [];
    let filtered = competition.jugadores;
    if (isCompetitionMode && scoringMode === 'partial') {
      filtered = filtered.filter(p => visiblePlayerIds.includes(p.id));
    }
    if (isCompetitionMode && marcandoPlayerId && currentDevicePlayerId) {
      const marcando = filtered.find(p => p.id === marcandoPlayerId);
      const me = filtered.find(p => p.id === currentDevicePlayerId);
      const rest = filtered.filter(p => p.id !== marcandoPlayerId && p.id !== currentDevicePlayerId);
      const sorted: typeof filtered = [];
      if (marcando) sorted.push(marcando);
      if (me) sorted.push(me);
      sorted.push(...rest);
      return sorted;
    }
    return [...filtered].sort((a, b) => {
      const aIsMe = isCompetitionMode ? a.id === currentDevicePlayerId : !!a.isDevice;
      const bIsMe = isCompetitionMode ? b.id === currentDevicePlayerId : !!b.isDevice;
      if (aIsMe) return -1;
      if (bIsMe) return 1;
      return 0;
    });
  }, [competition, isCompetitionMode, scoringMode, visiblePlayerIds, marcandoPlayerId, currentDevicePlayerId]);

  useEffect(() => {
    if (!competition) {
      router.replace('/');
    } else if (isFreePlayMode) {
      updateCurrentScreen('/game/scoring');
    }
  }, [competition, router, isFreePlayMode, updateCurrentScreen]);

  useEffect(() => {
    setEditMode(false);
  }, [currentHole]);

  const handleSave = useCallback(async () => {
    console.log('Saving hole:', currentHole);
    saveHole(currentHole);
    setEditMode(false);
    if (currentHole < 18) {
      goToNextHole();
    } else {
      Alert.alert(
        'Partida finalizada',
        '¡Hemos terminado el juego!',
        [
          {
            text: 'Revisar tarjeta',
            onPress: () => {
              const firstPlayer = sortedPlayers[0];
              if (firstPlayer) {
                router.push({
                  pathname: '/game/scorecard',
                  params: { playerId: firstPlayer.id },
                });
              }
            },
          },
        ]
      );
    }
  }, [currentHole, saveHole, goToNextHole, sortedPlayers, router]);

  if (!competition) {
    return null;
  }

  const holeSaved = isHoleSaved(currentHole);
  const currentPar = holePars[currentHole - 1];
  const currentHcp = holeHandicaps[currentHole - 1] ?? 0;

  console.log('[Scoring] currentHole:', currentHole, 'holeHandicaps:', JSON.stringify(holeHandicaps), 'currentHcp:', currentHcp);
  const canEdit = editMode || !holeSaved;

  const handleEdit = () => {
    console.log('Enabling edit mode for hole:', currentHole);
    setEditMode(true);
  };

  const handleBack = () => {
    if (currentHole > 1) {
      goToPreviousHole();
      setEditMode(false);
    }
  };

  const handleIncrement = (playerId: string) => {
    const playerScores = playerScoresMap.get(playerId);
    if (playerScores) {
      const currentScore = playerScores.scores[currentHole - 1].score;
      updateScore(playerId, currentHole, currentScore + 1);
    }
  };

  const handleDecrement = (playerId: string) => {
    const playerScores = playerScoresMap.get(playerId);
    if (playerScores) {
      const currentScore = playerScores.scores[currentHole - 1].score;
      if (currentScore > 1) {
        updateScore(playerId, currentHole, currentScore - 1);
      }
    }
  };

  const handlePlayerPress = (playerId: string) => {
    router.push({
      pathname: '/game/scorecard',
      params: { playerId },
    });
  };

  const handlePruebaPress = () => {
    router.push('/game/leaderboard');
  };

  const calculateStablefordPoints = (score: number, par: number): number => {
    const diff = par - score;
    if (diff <= -2) return 0;
    if (diff === -1) return 1;
    if (diff === 0) return 2;
    if (diff === 1) return 3;
    if (diff === 2) return 4;
    if (diff >= 3) return 5 + (diff - 3);
    return 0;
  };

  const calculateTotalStableford = (scores: HoleScore[]): number => {
    return scores
      .filter(s => s.saved)
      .reduce((total, hole) => total + calculateStablefordPoints(hole.score, hole.par), 0);
  };

  const handleExit = () => {
    console.log('[Scoring] Exit button pressed - isCompetitionMode:', isCompetitionMode, 'isFreePlayMode:', isFreePlayMode);
    
    if (isCompetitionMode) {
      Alert.alert(
        'Abandonar partida',
        '¿Vas a abandonar la partida, estás seguro?',
        [
          { text: 'No', style: 'cancel' },
          {
            text: 'Sí',
            style: 'destructive',
            onPress: () => {
              Alert.alert(
                'Causa justificada',
                '¿Es el abandono por una causa justificada?',
                [
                  {
                    text: 'Sí',
                    onPress: () => {
                      console.log('[Scoring] Player abandoned with justified cause');
                      resetGame();
                      router.replace('/');
                    },
                  },
                  {
                    text: 'No',
                    style: 'destructive',
                    onPress: () => {
                      Alert.alert(
                        'Descalificación',
                        'Va a ser descalificado de la competición',
                        [
                          { text: 'No', style: 'cancel' },
                          {
                            text: 'Sí, aceptar',
                            style: 'destructive',
                            onPress: () => {
                              console.log('[Scoring] Player disqualified from competition');
                              resetGame();
                              router.replace('/');
                            },
                          },
                        ]
                      );
                    },
                  },
                ]
              );
            },
          },
        ]
      );
    } else {
      Alert.alert(
        'Salir de la partida',
        '¿Está seguro de que desea salir de la partida? Todo su progreso será descartado.',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Sí, salir',
            style: 'destructive',
            onPress: async () => {
              console.log('[Scoring] User confirmed exit, resetting game...');
              try {
                resetGame();
                router.replace('/');
              } catch (error) {
                console.error('[Scoring] Error during exit:', error);
              }
            },
          },
        ],
        { cancelable: false }
      );
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {isCompetitionMode && <ConnectionStatus isOnline={isOnline} />}

      <View style={styles.header}>
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.pruebaButton}
            onPress={handlePruebaPress}
            testID="prueba-button"
          >
            <Text style={styles.competitionName}>{competition.nombre_competicion}</Text>
            <Text style={styles.pruebaText}>{competition.nombre_prueba}</Text>
          </TouchableOpacity>

          <View style={styles.holeInfo}>
            <View style={styles.holeBadge}>
              <Text style={styles.holeLabel}>HOYO</Text>
              <Text style={styles.holeValue}>{currentHole}</Text>
            </View>
            <View style={styles.parBadge}>
              <Text style={styles.parLabel}>PAR</Text>
              <Text style={styles.parValue}>{currentPar}</Text>
            </View>
            <View style={styles.hcpBadge}>
              <Text style={styles.hcpLabel}>HCP</Text>
              <Text style={styles.hcpValue}>{currentHcp}</Text>
            </View>
          </View>
        </View>

        <View style={styles.actionRow}>
          {currentHole > 1 && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleBack}
              testID="back-button"
            >
              <ArrowLeft size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Atrás</Text>
            </TouchableOpacity>
          )}
          
          {!holeSaved || editMode ? (
            <TouchableOpacity
              style={styles.saveBtnPrimary}
              onPress={handleSave}
              testID="save-button"
            >
              <Text style={styles.saveBtnText}>Guardar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleEdit}
              testID="edit-button"
            >
              <Text style={styles.actionBtnText}>Editar</Text>
            </TouchableOpacity>
          )}

          {currentHole < 18 && holeSaved && !editMode && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={goToNextHole}
              testID="next-button"
            >
              <Text style={styles.actionBtnText}>Siguiente</Text>
              <ChevronRight size={16} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} contentInset={{ bottom: 80 }}>
        <View style={styles.playersContainer}>
          {sortedPlayers.map((player) => {
            const scores = playerScoresMap.get(player.id);
            const currentScore = scores?.scores[currentHole - 1].score || currentPar;
            const totalStableford = scores ? calculateTotalStableford(scores.scores) : 0;
            
            const calculateTotalPar = (scores: HoleScore[]): number => {
              return scores.filter(s => s.saved).reduce((total, hole) => total + hole.par, 0);
            };
            
            const totalPar = scores ? calculateTotalPar(scores.scores) : 0;
            const totalScore = scores?.totalScore || 0;
            const diffFromPar = totalScore - totalPar;
            const diffString = diffFromPar === 0 ? 'E' : diffFromPar > 0 ? `+${diffFromPar}` : `${diffFromPar}`;
            const isMe = isCompetitionMode ? player.id === currentDevicePlayerId : !!player.isDevice;
            const isMarcando = isCompetitionMode && player.id === marcandoPlayerId;

            return (
              <View
                key={player.id}
                style={[
                  styles.playerCard,
                  isMe && styles.playerCardMe,
                  isMarcando && styles.playerCardMarcando,
                ]}
              >
                <TouchableOpacity
                  style={styles.playerInfo}
                  onPress={() => handlePlayerPress(player.id)}
                  testID={`player-${player.id}`}
                >
                  <View style={styles.playerNameRow}>
                    {isMe && <View style={styles.meDot} />}
                    {isMarcando && <View style={styles.marcandoDot} />}
                    <Text style={[styles.playerName, isMe && styles.playerNameMe, isMarcando && styles.playerNameMarcando]} numberOfLines={1}>
                      {player.nombre} {player.apellido}
                    </Text>
                    {isMe && <Text style={styles.tagMe}>Tú</Text>}
                    {isMarcando && <Text style={styles.tagMarcando}>Marcando</Text>}
                  </View>
                  <View style={styles.playerStats}>
                    {scores && scores.totalScore > 0 && (
                      <Text style={styles.playerScore}>
                        {diffString} / {totalStableford}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>

                <View style={styles.scoreControl}>
                  <TouchableOpacity
                    style={[styles.controlBtn, !canEdit && styles.controlBtnDisabled]}
                    onPress={() => handleDecrement(player.id)}
                    disabled={!canEdit}
                    testID={`decrement-${player.id}`}
                  >
                    <Minus size={22} color={!canEdit ? Colors.golf.border : Colors.golf.primary} />
                  </TouchableOpacity>

                  <View style={[styles.scoreBox, holeSaved && !editMode && styles.scoreBoxSaved]}>
                    <Text style={[styles.scoreValue, holeSaved && !editMode && styles.scoreValueSaved]}>
                      {currentScore}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.controlBtn, !canEdit && styles.controlBtnDisabled]}
                    onPress={() => handleIncrement(player.id)}
                    disabled={!canEdit}
                    testID={`increment-${player.id}`}
                  >
                    <Plus size={22} color={!canEdit ? Colors.golf.border : Colors.golf.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.footerBtn}
          onPress={handlePruebaPress}
          testID="footer-ranking-button"
        >
          <Trophy size={18} color="#FFFFFF" />
          <Text style={styles.footerBtnText}>Ranking</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerBtn}
          onPress={() => {
            if (isCompetitionMode && miMarcadorId) {
              handlePlayerPress(miMarcadorId);
            } else {
              const firstPlayer = sortedPlayers[0];
              if (firstPlayer) handlePlayerPress(firstPlayer.id);
            }
          }}
          testID="footer-tarjeta-button"
        >
          <CreditCard size={18} color="#FFFFFF" />
          <Text style={styles.footerBtnText}>Tarjeta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerBtnDanger}
          onPress={handleExit}
          testID="footer-abandonar-button"
        >
          <LogOut size={18} color="#FF6B6B" />
          <Text style={styles.footerBtnDangerText}>Abandonar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.golf.background,
  },
  header: {
    backgroundColor: Colors.golf.headerBg,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pruebaButton: {
    alignItems: 'flex-start',
    gap: 2,
    flex: 1,
  },
  competitionName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  pruebaText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.7)',
  },
  holeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  holeBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  holeLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  holeValue: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  parBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  parLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  parValue: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  hcpBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  hcpLabel: {
    fontSize: 9,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  hcpValue: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  saveBtnPrimary: {
    backgroundColor: Colors.golf.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingTop: 12,
    gap: 16,
    paddingBottom: 32,
  },
  playersContainer: {
    gap: 12,
  },
  playerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  playerCardMe: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.golf.primary,
  },
  playerCardMarcando: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.golf.accent,
  },
  playerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  meDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.golf.primary,
  },
  marcandoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.golf.accent,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.text,
    flexShrink: 1,
  },
  playerNameMe: {
    color: Colors.golf.primaryDark,
    fontWeight: '700' as const,
  },
  playerNameMarcando: {
    color: '#8B6914',
    fontWeight: '700' as const,
  },
  tagMe: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
    backgroundColor: Colors.golf.primary + '15',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  tagMarcando: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.golf.accent,
    backgroundColor: Colors.golf.accent + '20',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  playerStats: {
    flexDirection: 'row',
    gap: 8,
  },
  playerScore: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  scoreControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  controlBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.golf.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.golf.primary,
  },
  controlBtnDisabled: {
    borderColor: Colors.golf.border,
    backgroundColor: '#FAFAFA',
  },
  scoreBox: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: Colors.golf.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.golf.primary,
  },
  scoreBoxSaved: {
    backgroundColor: Colors.golf.primary + '12',
    borderColor: Colors.golf.primary,
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: '800' as const,
    color: Colors.golf.text,
  },
  scoreValueSaved: {
    color: Colors.golf.primary,
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: Colors.golf.headerBg,
    paddingBottom: 34,
    paddingTop: 14,
    paddingHorizontal: 20,
    justifyContent: 'space-around',
    alignItems: 'center',
    gap: 8,
  },
  footerBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  footerBtnText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  footerBtnDanger: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  footerBtnDangerText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FF6B6B',
  },
});
