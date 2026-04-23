import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useEffect, useState, useMemo } from 'react';
import { Minus, Plus, ArrowLeft, LogOut, ChevronRight } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useCompetition } from '../../providers/CompetitionProvider';
import ConnectionStatus from '../../components/ConnectionStatus';

export default function CompetitionScoringScreen() {
  const router = useRouter();
  const {
    currentDevicePlayerId,
    competition,
    currentHole,
    holePars,
    holeHandicaps,
    playerScoresMap,
    updateScore,
    saveHole,
    goToNextHole,
    goToPreviousHole,
    isHoleSaved,
    resetCompetition,
    updateCurrentScreen,
    isOnline,
    scoringMode,
    visiblePlayerIds,
    leaderboard,
  } = useCompetition();
  const [editMode, setEditMode] = useState<boolean>(false);

  const marcandoPlayerId = useMemo(() => {
    if (!competition || !currentDevicePlayerId) return null;
    const players = competition.players;
    const myIndex = players.findIndex(p => p.id === currentDevicePlayerId);
    if (myIndex === -1) return null;
    const nextIndex = (myIndex + 1) % players.length;
    return players[nextIndex].id;
  }, [competition, currentDevicePlayerId]);

  const sortedPlayers = useMemo(() => {
    if (!competition) return [];
    const allPlayers = competition.players.filter(
      (player) => scoringMode === 'all' || visiblePlayerIds.includes(player.id)
    );
    if (!marcandoPlayerId || !currentDevicePlayerId) return allPlayers;
    const marcando = allPlayers.find(p => p.id === marcandoPlayerId);
    const me = allPlayers.find(p => p.id === currentDevicePlayerId);
    const rest = allPlayers.filter(p => p.id !== marcandoPlayerId && p.id !== currentDevicePlayerId);
    const sorted: typeof allPlayers = [];
    if (marcando) sorted.push(marcando);
    if (me) sorted.push(me);
    sorted.push(...rest);
    return sorted;
  }, [competition, scoringMode, visiblePlayerIds, marcandoPlayerId, currentDevicePlayerId]);

  useEffect(() => {
    if (!competition) {
      router.replace('/');
    }
  }, [competition, router]);

  useEffect(() => {
    updateCurrentScreen('/competition/scoring');
  }, [updateCurrentScreen]);

  useEffect(() => {
    setEditMode(false);
  }, [currentHole]);

  if (!competition) {
    return null;
  }

  const holeSaved = isHoleSaved(currentHole);
  const currentPar = holePars[currentHole - 1];
  const currentHcp = holeHandicaps[currentHole - 1] ?? 0;
  const canEdit = editMode || !holeSaved;

  const handleSave = async () => {
    console.log('[Competition] Saving hole:', currentHole);
    const holeBeingSaved = currentHole;
    const isLastHole = holeBeingSaved === 18;
    setEditMode(false);

    try {
      await saveHole(holeBeingSaved);
      console.log('[Competition] Hole saved successfully:', holeBeingSaved);
    } catch (error) {
      console.error('[Competition] Error saving hole:', error);
    }

    if (isLastHole) {
      console.log('[Competition] Last hole (18) saved, navigating to comprobacion NOW');
      router.replace('/competition/comprobacion');
    } else {
      goToNextHole();
    }
  };

  const handleEdit = () => {
    console.log('[Competition] Enabling edit mode for hole:', currentHole);
    setEditMode(true);
  };

  const handleBack = () => {
    if (currentHole > 1) {
      goToPreviousHole();
      setEditMode(false);
    }
  };

  const handleExitGame = () => {
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
                    console.log('[Competition] Player abandoned with justified cause');
                    resetCompetition();
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
                            console.log('[Competition] Player disqualified from competition');
                            resetCompetition();
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
      params: { playerId, mode: 'competition' },
    });
  };

  const handlePruebaPress = () => {
    router.push({
      pathname: '/game/leaderboard',
      params: { mode: 'competition' },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ConnectionStatus isOnline={isOnline} />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.pruebaButton}
          onPress={handlePruebaPress}
          testID="prueba-button"
        >
          <Text style={styles.competitionName}>{competition.competitionName}</Text>
          <Text style={styles.pruebaText}>{competition.eventName}</Text>
        </TouchableOpacity>

        <View style={styles.holeRow}>
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

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {sortedPlayers.map((player) => {
          const scores = playerScoresMap.get(player.id);
          const currentScore = scores?.scores[currentHole - 1].score || currentPar;
          const isMe = player.id === currentDevicePlayerId;
          const isMarcando = player.id === marcandoPlayerId;

          return (
            <View key={player.id} style={[styles.playerCard, isMe && styles.playerCardMe, isMarcando && styles.playerCardMarcando]}>
              <TouchableOpacity
                style={styles.playerInfo}
                onPress={() => handlePlayerPress(player.id)}
                testID={`player-${player.id}`}
              >
                <View style={styles.playerNameRow}>
                  {isMarcando && <View style={styles.marcandoDot} />}
                  {isMe && <View style={styles.meDot} />}
                  <Text style={[styles.playerName, isMe && styles.playerNameMe, isMarcando && styles.playerNameMarcando]} numberOfLines={1}>
                    {player.firstName} {player.lastName}
                  </Text>
                  {isMe && <Text style={styles.tagMe}>Tú</Text>}
                  {isMarcando && <Text style={styles.tagMarcando}>Marcando</Text>}
                </View>
                <View style={styles.playerStats}>
                  {(() => {
                    const entry = leaderboard.find(e => e.player.id === player.id);
                    if (entry && entry.holesCompleted > 0) {
                      return (
                        <Text style={[styles.playerScore, entry.score > 0 ? styles.scoreOver : entry.score < 0 ? styles.scoreUnder : null]}>
                          {entry.score > 0 ? '+' : ''}{entry.score} ({entry.holesCompleted}h)
                        </Text>
                      );
                    }
                    return null;
                  })()}
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

        <TouchableOpacity
          style={styles.exitBtn}
          onPress={handleExitGame}
          testID="exit-button"
        >
          <LogOut size={16} color={Colors.golf.error} />
          <Text style={styles.exitBtnText}>Salir de la partida</Text>
        </TouchableOpacity>
      </ScrollView>
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
  pruebaButton: {
    alignItems: 'center',
    gap: 2,
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
  holeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  holeBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  holeLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  holeValue: {
    fontSize: 34,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  parBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(0,166,81,0.3)',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  parLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  parValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
  },
  hcpBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  hcpLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1,
  },
  hcpValue: {
    fontSize: 28,
    fontWeight: '700' as const,
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
    gap: 12,
    paddingBottom: 32,
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
  scoreOver: {
    color: Colors.golf.error,
  },
  scoreUnder: {
    color: Colors.golf.primary,
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
  exitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.golf.error + '40',
    backgroundColor: Colors.golf.error + '08',
    marginTop: 8,
  },
  exitBtnText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.golf.error,
  },
});
