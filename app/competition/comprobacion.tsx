import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, Alert } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { ClipboardCheck, Eye, PenLine, ChevronLeft, Check, Clock, Minus, Plus, AlertCircle } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { FontFamily } from '../../constants/Typography';
import { useCompetition } from '../../providers/CompetitionProvider';

export default function ComprobacionScreen() {
  const router = useRouter();
  const {
    competition,
    currentDevicePlayerId,
    playerScoresMap,
    resetCompetition,
    updateCurrentScreen,
    amendScore,
  } = useCompetition();

  const [reviewModalVisible, setReviewModalVisible] = useState<boolean>(false);
  const [editingHole, setEditingHole] = useState<number | null>(null);
  const [editingScore, setEditingScore] = useState<number>(0);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

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
    return competition.players.find(p => p.id === currentDevicePlayerId) ?? null;
  }, [competition, currentDevicePlayerId]);

  const markerPlayer = useMemo(() => {
    if (!competition || !currentDevicePlayerId) return null;
    const players = competition.players;
    const myIndex = players.findIndex(p => p.id === currentDevicePlayerId);
    if (myIndex === -1) return null;
    return players[(myIndex - 1 + players.length) % players.length];
  }, [competition, currentDevicePlayerId]);

  // All 18 hole records for the current player
  const myHoleScores = useMemo(() => {
    if (!currentDevicePlayerId) return [];
    return playerScoresMap.get(currentDevicePlayerId)?.scores ?? [];
  }, [currentDevicePlayerId, playerScoresMap]);

  const myOwnScores = useMemo(() => {
    const saved = myHoleScores.filter((s) => s.saved);
    if (!saved.length) return null;
    const totalStrokes = saved.reduce((sum, s) => sum + s.score, 0);
    const totalPar = saved.reduce((sum, s) => sum + s.par, 0);
    return { totalStrokes, totalPar, diff: totalStrokes - totalPar };
  }, [myHoleScores]);

  // Marker scores come from conflictScoreMarker on my hole records (filled via score_confirmed WS)
  const markerScoresForMe = useMemo(() => {
    const holesWithMarker = myHoleScores.filter(
      (s) => s.conflictScoreMarker !== null && s.conflictScoreMarker !== undefined
    );
    if (!holesWithMarker.length) return null;
    const totalStrokes = holesWithMarker.reduce((sum, s) => sum + (s.conflictScoreMarker ?? 0), 0);
    const totalPar = holesWithMarker.reduce((sum, s) => sum + s.par, 0);
    return {
      totalStrokes,
      totalPar,
      diff: totalStrokes - totalPar,
      holesCompleted: holesWithMarker.length,
      allHolesCompleted: holesWithMarker.length === 18,
    };
  }, [myHoleScores]);

  // Holes where self-recorded score ≠ marker-recorded score (both present)
  const conflictHoles = useMemo(() => {
    const set = new Set<number>();
    for (const s of myHoleScores) {
      if (
        s.conflictScoreLocal !== null && s.conflictScoreLocal !== undefined &&
        s.conflictScoreMarker !== null && s.conflictScoreMarker !== undefined &&
        s.conflictScoreLocal !== s.conflictScoreMarker
      ) {
        set.add(s.holeNumber);
      }
    }
    return set;
  }, [myHoleScores]);

  const hasConflicts = conflictHoles.size > 0;

  const formatDiff = useCallback((diff: number) => {
    if (diff > 0) return `+${diff}`;
    if (diff === 0) return 'E';
    return `${diff}`;
  }, []);

  const handleReviewCard = useCallback(() => {
    setReviewModalVisible(true);
  }, []);

  const handleSignCard = useCallback(() => {
    if (hasConflicts) {
      Alert.alert(
        'Conflictos pendientes',
        `${conflictHoles.size} hoyo(s) con discrepancia (${Array.from(conflictHoles).sort((a, b) => a - b).join(', ')}). Resuélvelos antes de firmar.`,
        [{ text: 'Revisar', onPress: () => setReviewModalVisible(true) }]
      );
      return;
    }
    Alert.alert(
      'Firmar tarjeta',
      '¿Estás seguro de que quieres firmar la tarjeta? Esta acción no se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Firmar',
          onPress: () => {
            resetCompetition();
            router.replace('/');
          },
        },
      ]
    );
  }, [hasConflicts, conflictHoles, resetCompetition, router]);

  const handleEditHole = useCallback((holeNumber: number) => {
    const hs = myHoleScores.find((s) => s.holeNumber === holeNumber);
    // Default to marker score so player is agreeing to (or amending) what was recorded
    setEditingScore(hs?.conflictScoreMarker ?? hs?.score ?? 0);
    setEditingHole(holeNumber);
  }, [myHoleScores]);

  const handleSaveEdit = useCallback(async () => {
    if (editingHole === null || !currentDevicePlayerId) return;
    setIsSavingEdit(true);
    try {
      await amendScore(currentDevicePlayerId, editingHole, editingScore);
      setEditingHole(null);
    } finally {
      setIsSavingEdit(false);
    }
  }, [editingHole, editingScore, currentDevicePlayerId, amendScore]);

  if (!competition || !myPlayer) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Comprobación de resultado</Text>
        <Text style={styles.headerSubtitle}>{competition.competitionName}</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        {hasConflicts && (
          <View style={styles.conflictBanner}>
            <AlertCircle size={18} color="#C0392B" />
            <Text style={styles.conflictBannerText}>
              {conflictHoles.size} hoyo(s) con discrepancia: {Array.from(conflictHoles).sort((a, b) => a - b).join(', ')}
            </Text>
          </View>
        )}

        <View style={styles.block}>
          <View style={styles.blockHeader}>
            <ClipboardCheck size={18} color={Colors.golf.primary} />
            <Text style={styles.blockTitle}>Golpes registrados por el marcador</Text>
          </View>

          <View style={styles.blockContent}>
            <Text style={styles.markerName}>
              {markerPlayer ? `${markerPlayer.firstName} ${markerPlayer.lastName}` : 'Marcador desconocido'}
            </Text>

            {markerScoresForMe?.allHolesCompleted ? (
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
                <Text style={styles.waitingText}>
                  {markerScoresForMe
                    ? `${markerScoresForMe.holesCompleted}/18 hoyos recibidos...`
                    : 'Esperando tarjeta del marcador...'}
                </Text>
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
              {myPlayer.firstName} {myPlayer.lastName}
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
            style={[styles.signButton, hasConflicts && styles.signButtonDisabled]}
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
            <Text style={styles.modalTitle}>Revisión de tarjeta</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
            <View style={styles.scorecardHeader}>
              <Text style={styles.scorecardHeaderHole}>Hoyo</Text>
              <Text style={styles.scorecardHeaderPar}>Par</Text>
              <Text style={styles.scorecardHeaderMarker}>Marc.</Text>
              <Text style={styles.scorecardHeaderMe}>Yo</Text>
              <View style={{ width: 40 }} />
            </View>

            {myHoleScores.map((hs) => {
              const isConflict = conflictHoles.has(hs.holeNumber);

              return (
                <View key={hs.holeNumber} style={[styles.scorecardRow, isConflict && styles.scorecardRowConflict]}>
                  {editingHole === hs.holeNumber ? (
                    <>
                      <Text style={styles.scorecardHole}>{hs.holeNumber}</Text>
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
                      <TouchableOpacity
                        style={[styles.saveEditBtn, isSavingEdit && styles.saveEditBtnDisabled]}
                        onPress={handleSaveEdit}
                        disabled={isSavingEdit}
                      >
                        <Check size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.scorecardHole, isConflict && styles.conflictText]}>{hs.holeNumber}</Text>
                      <Text style={styles.scorecardPar}>{hs.par}</Text>
                      <Text style={[
                        styles.scorecardScore,
                        isConflict && styles.conflictScoreText,
                        !isConflict && hs.conflictScoreMarker !== null && (hs.conflictScoreMarker ?? 0) > hs.par && styles.scoreOver,
                        !isConflict && hs.conflictScoreMarker !== null && (hs.conflictScoreMarker ?? 0) < hs.par && styles.scoreUnder,
                      ]}>
                        {hs.conflictScoreMarker ?? '—'}
                      </Text>
                      <Text style={[
                        styles.scorecardScore,
                        isConflict && styles.conflictScoreText,
                        !isConflict && hs.conflictScoreLocal !== null && (hs.conflictScoreLocal ?? 0) > hs.par && styles.scoreOver,
                        !isConflict && hs.conflictScoreLocal !== null && (hs.conflictScoreLocal ?? 0) < hs.par && styles.scoreUnder,
                      ]}>
                        {hs.conflictScoreLocal ?? '—'}
                      </Text>
                      <TouchableOpacity
                        style={[styles.editHoleBtn, isConflict && styles.editHoleBtnConflict]}
                        onPress={() => handleEditHole(hs.holeNumber)}
                        testID={`edit-hole-${hs.holeNumber}`}
                      >
                        <PenLine size={14} color={isConflict ? '#C0392B' : Colors.golf.primary} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              );
            })}

            {myHoleScores.length > 0 && (
              <View style={styles.scorecardTotal}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalPar}>{myHoleScores.reduce((s, h) => s + h.par, 0)}</Text>
                <Text style={styles.totalScore}>{markerScoresForMe?.totalStrokes ?? '—'}</Text>
                <Text style={styles.totalScore}>{myOwnScores?.totalStrokes ?? '—'}</Text>
                <View style={{ width: 40 }} />
              </View>
            )}
          </ScrollView>
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
    fontFamily: FontFamily.headingSemi,
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontFamily: FontFamily.body,
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
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FDEDEC',
    borderWidth: 1,
    borderColor: '#E74C3C',
    borderRadius: 12,
    padding: 14,
  },
  conflictBannerText: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 13,
    fontWeight: '500' as const,
    color: '#C0392B',
    flex: 1,
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
    fontFamily: FontFamily.bodyBold,
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  blockContent: {
    padding: 18,
    gap: 14,
  },
  markerName: {
    fontFamily: FontFamily.bodySemi,
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
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.golf.textLight,
  },
  statValue: {
    fontFamily: FontFamily.headingSemi,
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  statValueHighlight: {
    fontFamily: FontFamily.headingSemi,
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
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#8B6914',
    flex: 1,
  },
  noDataText: {
    fontFamily: FontFamily.body,
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
    fontFamily: FontFamily.bodyBold,
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
  signButtonDisabled: {
    backgroundColor: Colors.golf.textLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  signButtonText: {
    fontFamily: FontFamily.bodyBold,
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
    fontFamily: FontFamily.headingSemi,
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.golf.text,
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
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: Colors.golf.headerBg,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  scorecardHeaderHole: {
    fontFamily: FontFamily.bodyBold,
    flex: 1,
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  scorecardHeaderPar: {
    fontFamily: FontFamily.bodyBold,
    width: 36,
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  scorecardHeaderMarker: {
    fontFamily: FontFamily.bodyBold,
    width: 52,
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  scorecardHeaderMe: {
    fontFamily: FontFamily.bodyBold,
    width: 52,
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  scorecardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: Colors.golf.border,
  },
  scorecardRowConflict: {
    backgroundColor: '#FDEDEC',
  },
  scorecardHole: {
    fontFamily: FontFamily.bodySemi,
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.golf.text,
  },
  scorecardPar: {
    fontFamily: FontFamily.bodyMedium,
    width: 36,
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.golf.textLight,
    textAlign: 'center',
  },
  scorecardScore: {
    fontFamily: FontFamily.headingSemi,
    width: 52,
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    textAlign: 'center',
  },
  conflictText: {
    color: '#C0392B',
  },
  conflictScoreText: {
    color: '#C0392B',
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
    marginLeft: 4,
  },
  editHoleBtnConflict: {
    backgroundColor: '#FADBD8',
  },
  editScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 108,
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
    fontFamily: FontFamily.headingSemi,
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
    marginLeft: 4,
  },
  saveEditBtnDisabled: {
    opacity: 0.5,
  },
  scorecardTotal: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    backgroundColor: Colors.golf.primary + '0D',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  totalLabel: {
    fontFamily: FontFamily.bodyBold,
    flex: 1,
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  totalPar: {
    fontFamily: FontFamily.bodySemi,
    width: 36,
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
    textAlign: 'center',
  },
  totalScore: {
    fontFamily: FontFamily.headingSemi,
    width: 52,
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
    textAlign: 'center',
  },
});
