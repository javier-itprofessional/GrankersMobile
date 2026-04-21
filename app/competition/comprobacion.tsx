import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { ClipboardCheck, Eye, PenLine, ChevronLeft, Check, Clock, Minus, Plus } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useCompetition } from '../../providers/CompetitionProvider';

export default function ComprobacionScreen() {
  const router = useRouter();
  const {
    competition,
    currentDevicePlayerId,
    playerScoresMap,
    holePars,
    resetCompetition,
    updateCurrentScreen,
    goToHole,
  } = useCompetition();

  const [reviewModalVisible, setReviewModalVisible] = useState<boolean>(false);
  const [editingHole, setEditingHole] = useState<number | null>(null);
  const [editingScore, setEditingScore] = useState<number>(0);

  useEffect(() => {
    updateCurrentScreen('/competition/comprobacion');
  }, [updateCurrentScreen]);

  useEffect(() => {
    if (!competition) {
      router.replace('/');
    }
  }, [competition, router]);

  const myPlayer = useMemo(() => {
    if (!competition || !currentDevicePlayerId) return null;
    return competition.jugadores.find(p => p.id === currentDevicePlayerId) ?? null;
  }, [competition, currentDevicePlayerId]);

  const markerPlayer = useMemo(() => {
    if (!competition || !currentDevicePlayerId) return null;
    const jugadores = competition.jugadores;
    const myIndex = jugadores.findIndex(p => p.id === currentDevicePlayerId);
    if (myIndex === -1) return null;
    const prevIndex = (myIndex - 1 + jugadores.length) % jugadores.length;
    return jugadores[prevIndex];
  }, [competition, currentDevicePlayerId]);

  const myOwnScores = useMemo(() => {
    if (!currentDevicePlayerId) return null;
    const scores = playerScoresMap.get(currentDevicePlayerId);
    if (!scores) return null;
    const totalStrokes = scores.scores.reduce((sum, s) => sum + s.score, 0);
    const totalPar = scores.scores.reduce((sum, s) => sum + s.par, 0);
    return { totalStrokes, totalPar, diff: totalStrokes - totalPar };
  }, [currentDevicePlayerId, playerScoresMap]);

  // Marker scores are delivered via WebSocket (score_confirmed events) and reflected in playerScoresMap
  const markerScoresForMe = useMemo(() => {
    if (!currentDevicePlayerId || !markerPlayer) return null;

    const markerScores = playerScoresMap.get(markerPlayer.id);
    if (!markerScores) return null;

    const savedScores = markerScores.scores.filter((s) => s.saved);
    const totalStrokes = savedScores.reduce((sum, s) => sum + s.score, 0);
    const totalPar = savedScores.reduce((sum, s) => sum + s.par, 0);
    const holeScores = savedScores.map((s) => ({ hole: s.holeNumber, score: s.score, par: s.par }));

    return {
      totalStrokes,
      totalPar,
      diff: totalStrokes - totalPar,
      holesCompleted: savedScores.length,
      allHolesCompleted: savedScores.length === 18,
      holeScores,
    };
  }, [currentDevicePlayerId, markerPlayer, playerScoresMap]);

  const formatDiff = useCallback((diff: number) => {
    if (diff > 0) return `+${diff}`;
    if (diff === 0) return 'E';
    return `${diff}`;
  }, []);

  const handleReviewCard = useCallback(() => {
    setReviewModalVisible(true);
  }, []);

  const handleSignCard = useCallback(() => {
    Alert.alert(
      'Firmar tarjeta',
      '¿Estás seguro de que quieres firmar la tarjeta? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Firmar',
          onPress: () => {
            console.log('[Comprobacion] Card signed');
            resetCompetition();
            router.replace('/');
          },
        },
      ]
    );
  }, [resetCompetition, router]);

  const _handleEditHole = useCallback((hole: number, currentScore: number) => {
    setEditingHole(hole);
    setEditingScore(currentScore);
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (editingHole !== null) {
      console.log('[Comprobacion] Saving edit for hole', editingHole, 'score:', editingScore);
      setEditingHole(null);
    }
  }, [editingHole, editingScore]);

  const handleGoToHole = useCallback((holeNumber: number) => {
    setReviewModalVisible(false);
    goToHole(holeNumber);
    router.push('/competition/scoring');
  }, [goToHole, router]);

  if (!competition || !myPlayer) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Comprobación de resultado</Text>
        <Text style={styles.headerSubtitle}>{competition.nombre_competicion}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <ClipboardCheck size={18} color={Colors.golf.primary} />
            <Text style={styles.blockTitle}>Golpes registrados por el marcador</Text>
          </View>

          <View style={styles.blockContent}>
            <Text style={styles.markerName}>
              {markerPlayer ? `${markerPlayer.nombre} ${markerPlayer.apellido}` : 'Marcador desconocido'}
            </Text>

            {markerScoresForMe && markerScoresForMe.allHolesCompleted ? (
              <View style={styles.scoresContainer}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Total de golpes</Text>
                  <Text style={styles.statValue}>{markerScoresForMe.totalStrokes}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Resultado</Text>
                  <Text style={[
                    styles.statValueHighlight,
                    markerScoresForMe.diff > 0 && styles.statOver,
                    markerScoresForMe.diff < 0 && styles.statUnder,
                    markerScoresForMe.diff === 0 && styles.statEven,
                  ]}>
                    {formatDiff(markerScoresForMe.diff)} (Par {markerScoresForMe.totalPar})
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.waitingContainer}>
                <Clock size={22} color={Colors.golf.accent} />
                <Text style={styles.waitingText}>Esperando tarjeta del marcador...</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <PenLine size={18} color={Colors.golf.primary} />
            <Text style={styles.blockTitle}>Golpes apuntados por mí</Text>
          </View>

          <View style={styles.blockContent}>
            <Text style={styles.markerName}>
              {myPlayer.nombre} {myPlayer.apellido}
            </Text>

            {myOwnScores ? (
              <View style={styles.scoresContainer}>
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Total de golpes</Text>
                  <Text style={styles.statValue}>{myOwnScores.totalStrokes}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statRow}>
                  <Text style={styles.statLabel}>Resultado</Text>
                  <Text style={[
                    styles.statValueHighlight,
                    myOwnScores.diff > 0 && styles.statOver,
                    myOwnScores.diff < 0 && styles.statUnder,
                    myOwnScores.diff === 0 && styles.statEven,
                  ]}>
                    {formatDiff(myOwnScores.diff)} (Par {myOwnScores.totalPar})
                  </Text>
                </View>
              </View>
            ) : (
              <Text style={styles.noDataText}>Sin datos disponibles</Text>
            )}
          </View>
        </View>

        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.reviewButton}
            onPress={handleReviewCard}
            testID="review-card-button"
          >
            <Eye size={18} color={Colors.golf.primary} />
            <Text style={styles.reviewButtonText}>Revisar tarjeta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.signButton}
            onPress={handleSignCard}
            testID="sign-card-button"
          >
            <Check size={18} color="#FFFFFF" />
            <Text style={styles.signButtonText}>Firmar tarjeta</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={reviewModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setReviewModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setReviewModalVisible(false)} testID="close-review-modal">
              <ChevronLeft size={28} color={Colors.golf.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Tarjeta del marcador</Text>
            <View style={{ width: 28 }} />
          </View>

          {!markerScoresForMe || !markerScoresForMe.allHolesCompleted ? (
            <View style={styles.modalWaiting}>
              <Clock size={32} color={Colors.golf.accent} />
              <Text style={styles.modalWaitingText}>El marcador aún no ha completado todos los hoyos</Text>
            </View>
          ) : (
            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
              <View style={styles.scorecardHeader}>
                <Text style={styles.scorecardHeaderHole}>Hoyo</Text>
                <Text style={styles.scorecardHeaderPar}>Par</Text>
                <Text style={styles.scorecardHeaderScore}>Golpes</Text>
                <Text style={styles.scorecardHeaderAction}>Editar</Text>
              </View>

              {markerScoresForMe.holeScores.map((hs) => (
                <View key={hs.hole} style={styles.scorecardRow}>
                  {editingHole === hs.hole ? (
                    <>
                      <Text style={styles.scorecardHole}>{hs.hole}</Text>
                      <Text style={styles.scorecardPar}>{hs.par}</Text>
                      <View style={styles.editScoreContainer}>
                        <TouchableOpacity
                          style={styles.editControlBtn}
                          onPress={() => setEditingScore(Math.max(1, editingScore - 1))}
                        >
                          <Minus size={14} color={Colors.golf.primary} />
                        </TouchableOpacity>
                        <Text style={styles.editScoreValue}>{editingScore}</Text>
                        <TouchableOpacity
                          style={styles.editControlBtn}
                          onPress={() => setEditingScore(editingScore + 1)}
                        >
                          <Plus size={14} color={Colors.golf.primary} />
                        </TouchableOpacity>
                      </View>
                      <TouchableOpacity style={styles.saveEditBtn} onPress={handleSaveEdit}>
                        <Check size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.scorecardHole}>{hs.hole}</Text>
                      <Text style={styles.scorecardPar}>{hs.par}</Text>
                      <Text style={[
                        styles.scorecardScore,
                        hs.score > hs.par && styles.scoreOver,
                        hs.score < hs.par && styles.scoreUnder,
                      ]}>
                        {hs.score}
                      </Text>
                      <TouchableOpacity
                        style={styles.editHoleBtn}
                        onPress={() => handleGoToHole(hs.hole)}
                        testID={`edit-hole-${hs.hole}`}
                      >
                        <PenLine size={14} color={Colors.golf.primary} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              ))}

              <View style={styles.scorecardTotal}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalPar}>{markerScoresForMe.totalPar}</Text>
                <Text style={styles.totalScore}>{markerScoresForMe.totalStrokes}</Text>
                <View style={{ width: 40 }} />
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
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
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.7)',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  block: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: Colors.golf.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.golf.border,
  },
  blockTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  blockContent: {
    padding: 18,
    gap: 14,
  },
  markerName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.primary,
  },
  scoresContainer: {
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.golf.textLight,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  statValueHighlight: {
    fontSize: 17,
    fontWeight: '700' as const,
  },
  statOver: {
    color: Colors.golf.error,
  },
  statUnder: {
    color: Colors.golf.primary,
  },
  statEven: {
    color: Colors.golf.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.golf.border,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.golf.accent + '15',
    padding: 14,
    borderRadius: 12,
  },
  waitingText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#8B6914',
    flex: 1,
  },
  noDataText: {
    fontSize: 14,
    color: Colors.golf.textLight,
  },
  actionsContainer: {
    gap: 10,
    marginTop: 4,
  },
  reviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: Colors.golf.primary,
    borderRadius: 14,
    paddingVertical: 16,
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
  },
  signButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.golf.primary,
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  signButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.golf.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.golf.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  modalWaiting: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 40,
  },
  modalWaitingText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.golf.textLight,
    textAlign: 'center',
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    padding: 16,
  },
  scorecardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.golf.headerBg,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  scorecardHeaderHole: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  scorecardHeaderPar: {
    width: 50,
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  scorecardHeaderScore: {
    width: 60,
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  scorecardHeaderAction: {
    width: 50,
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  scorecardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.golf.border,
  },
  scorecardHole: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.golf.text,
  },
  scorecardPar: {
    width: 50,
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.golf.textLight,
    textAlign: 'center',
  },
  scorecardScore: {
    width: 60,
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    textAlign: 'center',
  },
  scoreOver: {
    color: Colors.golf.error,
  },
  scoreUnder: {
    color: Colors.golf.primary,
  },
  editHoleBtn: {
    width: 36,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.golf.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 7,
  },
  editScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    width: 60,
    justifyContent: 'center',
  },
  editControlBtn: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: Colors.golf.background,
    borderWidth: 1.5,
    borderColor: Colors.golf.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editScoreValue: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
    minWidth: 20,
    textAlign: 'center',
  },
  saveEditBtn: {
    width: 36,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.golf.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 7,
  },
  scorecardTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: Colors.golf.primary + '0D',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  totalLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  totalPar: {
    width: 50,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
    textAlign: 'center',
  },
  totalScore: {
    width: 60,
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
    textAlign: 'center',
  },
});
