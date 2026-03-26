import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Edit2, Save, Minus, Plus, ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useCompetition } from '../../providers/CompetitionProvider';
import { useFreePlay } from '../../providers/FreePlayProvider';


export default function ScorecardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ playerId: string; holeNumber?: string }>();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  
  const { competition: competitionData, playerScoresMap: compScoresMap, currentHole: compHole, isHoleSaved: compIsHoleSaved, updateScore: compUpdateScore, saveHole: compSaveHole } = useCompetition();
  const { players, gameStarted, playerScoresMap: freeScoresMap, currentHole: freeHole, isHoleSaved: freeIsHoleSaved, updateScore: freeUpdateScore, saveHole: freeSaveHole, devicePlayerId, holePars } = useFreePlay();



  
  const isCompetitionMode = competitionData !== null;
  const isFreePlayMode = gameStarted;
  
  const competition = isCompetitionMode ? competitionData : (isFreePlayMode ? {
    codigo_grupo: '',
    nombre_competicion: 'Partida Libre',
    nombre_prueba: 'Partida Libre',
    jugadores: players,
  } : null);
  
  const playerScoresMap = isCompetitionMode ? compScoresMap : freeScoresMap;
  const currentHole = isCompetitionMode ? compHole : freeHole;
  const isHoleSaved = isCompetitionMode ? compIsHoleSaved : freeIsHoleSaved;
  const updateScore = isCompetitionMode ? compUpdateScore : freeUpdateScore;
  const saveHole = isCompetitionMode ? compSaveHole : freeSaveHole;

  const player = competition?.jugadores.find((p) => p.id === params.playerId);
  const scores = playerScoresMap.get(params.playerId);
  const selectedHole = params.holeNumber ? parseInt(params.holeNumber) : currentHole;
  
  const [viewMode, setViewMode] = React.useState<'overview' | 'hole'>(
    params.holeNumber ? 'hole' : 'overview'
  );
  const [editMode, setEditMode] = React.useState<boolean>(false);
  const [holeToView, setHoleToView] = React.useState<number>(selectedHole);



  if (!competition) {
    router.replace('/');
    return null;
  }

  if (!player || !scores) {
    return null;
  }

  const firstNine = scores.scores.slice(0, 9);
  const secondNine = scores.scores.slice(9, 18);

  const firstNineTotal = firstNine
    .filter((s) => s.saved)
    .reduce((sum, s) => sum + s.score, 0);
  const secondNineTotal = secondNine
    .filter((s) => s.saved)
    .reduce((sum, s) => sum + s.score, 0);

  const firstNinePar = firstNine.reduce((sum, s) => sum + s.par, 0);
  const secondNinePar = secondNine.reduce((sum, s) => sum + s.par, 0);

  const handleHolePress = (holeNumber: number) => {
    setHoleToView(holeNumber);
    setViewMode('hole');
    setEditMode(false);
  };

  const handleBackToOverview = () => {
    setViewMode('overview');
    setEditMode(false);
  };

  const handlePreviousHole = () => {
    if (holeToView > 1) {
      setHoleToView(holeToView - 1);
      setEditMode(false);
    }
  };

  const handleNextHole = () => {
    if (holeToView < 18) {
      setHoleToView(holeToView + 1);
      setEditMode(false);
    }
  };

  const handleEdit = () => {
    setEditMode(true);
  };

  const handleSave = () => {
    saveHole(holeToView);
    setEditMode(false);
  };



  const renderHoleRow = (holeScores: typeof firstNine, startHole: number) => (
    <View style={styles.nineHoles}>
      <View style={styles.row}>
        <Text style={styles.labelCell}>Hoyo</Text>
        {holeScores.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleHolePress(startHole + index)}
            style={styles.cellTouchable}
          >
            <Text style={styles.cell}>
              {startHole + index}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.totalCell}>Total</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.labelCell}>Par</Text>
        {holeScores.map((hole, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => handleHolePress(startHole + index)}
            style={styles.cellTouchable}
          >
            <Text style={styles.cell}>
              {hole.par}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.totalCell}>
          {startHole === 1 ? firstNinePar : secondNinePar}
        </Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.labelCellPlayer}>Score</Text>
        {holeScores.map((hole, index) => {
          const diff = hole.score - hole.par;
          let cellStyle = styles.scoreCell;
          if (hole.saved) {
            if (diff < 0) cellStyle = styles.scoreCellBirdie;
            else if (diff === 0) cellStyle = styles.scoreCellPar;
            else if (diff === 1) cellStyle = styles.scoreCellBogey;
            else cellStyle = styles.scoreCellDouble;
          }

          return (
            <TouchableOpacity
              key={index}
              onPress={() => handleHolePress(startHole + index)}
              style={styles.cellTouchable}
            >
              <Text style={[styles.cell, cellStyle]}>
                {hole.saved ? hole.score : '-'}
              </Text>
            </TouchableOpacity>
          );
        })}
        <Text style={styles.totalCellPlayer}>
          {startHole === 1 ? firstNineTotal || '-' : secondNineTotal || '-'}
        </Text>
      </View>
    </View>
  );



  if (viewMode === 'hole') {
    const holeSaved = isHoleSaved(holeToView);
    const canEdit = editMode || !holeSaved;
    const holeParValue = holePars[holeToView - 1] || 4;

    return (
      <View style={styles.container}>
        <Stack.Screen
          options={{
            title: '',
            headerStyle: { backgroundColor: Colors.golf.headerBg },
            headerTintColor: '#FFFFFF',
            headerLeft: () => (
              <TouchableOpacity
                onPress={() => router.back()}
                style={{ marginLeft: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}
                testID="back-scorecard-button"
              >
                <ArrowLeft size={24} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' as const }}>
                  Atrás
                </Text>
              </TouchableOpacity>
            ),
          }}
        />

        <View style={styles.holeViewHeader}>
          <TouchableOpacity
            style={styles.backToOverviewButton}
            onPress={handleBackToOverview}
            testID="back-to-overview"
          >
            <Text style={styles.backToOverviewText}>Volver a tarjeta</Text>
          </TouchableOpacity>

          <View style={styles.holeNavigationContainer}>
            <TouchableOpacity
              style={[styles.holeNavButton, holeToView === 1 && styles.holeNavButtonDisabled]}
              onPress={handlePreviousHole}
              disabled={holeToView === 1}
              testID="prev-hole"
            >
              <ChevronLeft size={18} color={holeToView === 1 ? Colors.golf.textLight : Colors.golf.primary} />
              <Text style={[styles.holeNavButtonText, holeToView === 1 && styles.holeNavButtonTextDisabled]}>Anterior</Text>
            </TouchableOpacity>

            <View style={styles.holeNumberBadge}>
              <Text style={styles.holeNumberBadgeLabel}>Hoyo</Text>
              <Text style={styles.holeNumberBadgeValue}>{holeToView}</Text>
              <Text style={styles.holeNumberBadgePar}>Par {holeParValue}</Text>
            </View>

            {!holeSaved || editMode ? (
              <TouchableOpacity
                style={styles.holeEditButton}
                onPress={handleSave}
                testID="save-hole"
              >
                <Save size={18} color="#FFFFFF" />
                <Text style={styles.holeEditButtonText}>Guardar</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.holeEditButtonOutline}
                onPress={handleEdit}
                testID="edit-hole"
              >
                <Edit2 size={18} color={Colors.golf.primary} />
                <Text style={styles.holeEditButtonTextOutline}>Editar</Text>
              </TouchableOpacity>
            )}

            {holeToView < 18 && (
              <TouchableOpacity
                style={styles.holeNavButton}
                onPress={handleNextHole}
                testID="next-hole"
              >
                <Text style={styles.holeNavButtonText}>Siguiente</Text>
                <ChevronRight size={18} color={Colors.golf.primary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.holeViewContent}>
          {competition.jugadores.map((p) => {
            const playerScores = playerScoresMap.get(p.id);
            if (!playerScores) return null;
            
            const holeData = playerScores.scores[holeToView - 1];
            const isDevicePlayer = isFreePlayMode && devicePlayerId && p.id === devicePlayerId;

            return (
              <View key={p.id} style={styles.playerScoreCard}>
                <View style={styles.playerScoreHeader}>
                  <View style={styles.playerScoreInfo}>
                    <Text style={styles.playerScoreName}>
                      {p.nombre} {p.apellido}
                      {isDevicePlayer && ' (Tú)'}
                    </Text>
                    <View style={styles.playerScoreStats}>
                      <Text style={styles.playerScoreStat}>Total: {playerScores.totalScore || 0}</Text>
                      <Text style={[
                        styles.playerScoreStat,
                        playerScores.totalScore - playerScores.totalPar > 0 ? styles.playerScoreStatOver : styles.playerScoreStatUnder
                      ]}>
                        {playerScores.totalScore - playerScores.totalPar > 0 ? '+' : ''}{playerScores.totalScore - playerScores.totalPar}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.holeScoreControl}>
                  <TouchableOpacity
                    style={[styles.holeControlButton, !canEdit && styles.holeControlButtonDisabled]}
                    onPress={() => {
                      const currentScore = holeData.score;
                      if (currentScore > 1 && canEdit) {
                        updateScore(p.id, holeToView, currentScore - 1);
                      }
                    }}
                    disabled={!canEdit}
                    testID={`decrement-score-${p.id}`}
                  >
                    <Minus size={24} color={!canEdit ? Colors.golf.textLight : Colors.golf.primary} />
                  </TouchableOpacity>

                  <View style={[
                    styles.holeScoreDisplayCompact,
                    holeSaved && !editMode && styles.holeScoreDisplaySaved,
                    isDevicePlayer && styles.holeScoreDisplayDevice
                  ]}>
                    <Text style={[
                      styles.holeScoreValueCompact,
                      holeSaved && !editMode && styles.holeScoreValueSaved,
                      isDevicePlayer && styles.holeScoreValueDevice
                    ]}>
                      {holeData.score}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={[styles.holeControlButton, !canEdit && styles.holeControlButtonDisabled]}
                    onPress={() => {
                      if (canEdit) {
                        updateScore(p.id, holeToView, holeData.score + 1);
                      }
                    }}
                    disabled={!canEdit}
                    testID={`increment-score-${p.id}`}
                  >
                    <Plus size={24} color={!canEdit ? Colors.golf.textLight : Colors.golf.primary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.holeScoreInfo}>
                  <Text style={styles.holeScoreInfoText}>
                    {holeData.score - holeData.par === 0 && 'Par'}
                    {holeData.score - holeData.par < 0 && `${Math.abs(holeData.score - holeData.par)} ${Math.abs(holeData.score - holeData.par) === 1 ? 'bajo par' : 'bajo par'}`}
                    {holeData.score - holeData.par > 0 && `${holeData.score - holeData.par} ${holeData.score - holeData.par === 1 ? 'sobre par' : 'sobre par'}`}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.container, isLandscape && styles.containerLandscape]}>
      <Stack.Screen
        options={{
          title: '',
          headerStyle: { backgroundColor: Colors.golf.headerBg },
          headerTintColor: '#FFFFFF',
          headerShown: !isLandscape,
          headerLeft: () => (
            <TouchableOpacity
              onPress={() => router.back()}
              style={{ marginLeft: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}
              testID="back-scorecard-button"
            >
              <ArrowLeft size={24} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' as const }}>
                Atrás
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      {isLandscape && (
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.landscapeBackButton}
          testID="landscape-back-button"
        >
          <ArrowLeft size={20} color="#FFFFFF" />
          <Text style={styles.landscapeBackText}>Atrás</Text>
        </TouchableOpacity>
      )}

      <ScrollView 
        style={[styles.scrollView, isLandscape && styles.scrollViewLandscape]} 
        contentContainerStyle={[styles.content, isLandscape && styles.contentLandscape]}
        horizontal={isLandscape}
      >
        <View style={[styles.header, isLandscape && styles.headerLandscape]}>
          <Text style={[styles.playerName, isLandscape && styles.playerNameLandscape]}>
            {player.nombre} {player.apellido}
          </Text>
          <Text style={[styles.competitionName, isLandscape && styles.competitionNameLandscape]}>{competition.nombre_prueba}</Text>
        </View>

        <View style={[styles.summary, isLandscape && styles.summaryLandscape]}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total</Text>
            <Text style={styles.summaryValue}>{scores.totalScore || 0}</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>vs Par</Text>
            <Text
              style={[
                styles.summaryValue,
                scores.totalScore - scores.totalPar > 0
                  ? styles.summaryValueOver
                  : styles.summaryValueUnder,
              ]}
            >
              {scores.totalScore - scores.totalPar > 0 ? '+' : ''}
              {scores.totalScore - scores.totalPar}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Hoyos</Text>
            <Text style={styles.summaryValue}>
              {scores.scores.filter((s) => s.saved).length}/18
            </Text>
          </View>
        </View>

        <View style={[styles.scorecard, isLandscape && styles.scorecardLandscape]}>
          <Text style={[styles.sectionTitle, isLandscape && styles.sectionTitleLandscape]}>Primera Vuelta</Text>
          {renderHoleRow(firstNine, 1)}

          <Text style={[styles.sectionTitle, styles.sectionTitleSecond, isLandscape && styles.sectionTitleLandscape]}>Segunda Vuelta</Text>
          {renderHoleRow(secondNine, 10)}
        </View>

        <View style={[styles.legend, isLandscape && styles.legendLandscape]}>
          <Text style={styles.legendTitle}>Leyenda</Text>
          <View style={styles.legendItems}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotBirdie]} />
              <Text style={styles.legendText}>Birdie o mejor</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotPar]} />
              <Text style={styles.legendText}>Par</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotBogey]} />
              <Text style={styles.legendText}>Bogey</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, styles.legendDotDouble]} />
              <Text style={styles.legendText}>Doble Bogey +</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.golf.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  header: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  playerName: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  competitionName: {
    fontSize: 16,
    color: Colors.golf.textLight,
    fontWeight: '500' as const,
  },
  summary: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
    textTransform: 'uppercase',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  summaryValueOver: {
    color: Colors.golf.error,
  },
  summaryValueUnder: {
    color: Colors.golf.success,
  },
  scorecard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
    marginBottom: 12,
  },
  sectionTitleSecond: {
    marginTop: 20,
  },
  nineHoles: {
    gap: 1,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.golf.border,
  },
  labelCell: {
    width: 50,
    padding: 8,
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
  },
  labelCellPlayer: {
    width: 50,
    padding: 8,
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
  },
  cell: {
    flex: 1,
    padding: 8,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.golf.text,
    textAlign: 'center',
  },
  totalCell: {
    width: 50,
    padding: 8,
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    textAlign: 'center',
    backgroundColor: Colors.golf.background,
  },
  totalCellPlayer: {
    width: 50,
    padding: 8,
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
    textAlign: 'center',
    backgroundColor: Colors.golf.primary + '20',
  },
  scoreCell: {
    backgroundColor: '#FFFFFF',
  },
  scoreCellBirdie: {
    backgroundColor: Colors.golf.primary + '18',
    color: Colors.golf.primary,
  },
  scoreCellPar: {
    backgroundColor: Colors.golf.accent + '15',
  },
  scoreCellBogey: {
    backgroundColor: '#FFF3E0',
  },
  scoreCellDouble: {
    backgroundColor: Colors.golf.error + '15',
    color: Colors.golf.error,
  },
  legend: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    marginBottom: 12,
  },
  legendItems: {
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  legendDotBirdie: {
    backgroundColor: Colors.golf.primary + '18',
  },
  legendDotPar: {
    backgroundColor: Colors.golf.accent + '15',
  },
  legendDotBogey: {
    backgroundColor: '#FFF3E0',
  },
  legendDotDouble: {
    backgroundColor: Colors.golf.error + '15',
  },
  legendText: {
    fontSize: 14,
    color: Colors.golf.text,
    fontWeight: '500' as const,
  },
  cellTouchable: {
    flex: 1,
  },
  holeViewHeader: {
    backgroundColor: '#FFFFFF',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.golf.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  backToOverviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
  },
  backToOverviewText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.primary,
  },
  holeNavigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  holeNavButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.golf.background,
    borderWidth: 2,
    borderColor: Colors.golf.primary,
  },
  holeNavButtonDisabled: {
    borderColor: Colors.golf.border,
    backgroundColor: Colors.golf.background + '80',
  },
  holeNavButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.golf.primary,
  },
  holeNavButtonTextDisabled: {
    color: Colors.golf.textLight,
  },
  holeNumberBadge: {
    alignItems: 'center',
    gap: 2,
  },
  holeNumberBadgeLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.golf.textLight,
    textTransform: 'uppercase',
  },
  holeNumberBadgeValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
  },
  holeNumberBadgePar: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
  },
  holeEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: Colors.golf.primary,
  },
  holeEditButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  holeEditButtonOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: Colors.golf.background,
    borderWidth: 2,
    borderColor: Colors.golf.primary,
  },
  holeEditButtonTextOutline: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.golf.primary,
  },
  holeViewContent: {
    padding: 20,
    gap: 20,
  },
  holeScoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    gap: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  holeScoreLabel: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    textAlign: 'center',
  },
  holeScoreControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
  },
  holeControlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.golf.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.golf.primary,
  },
  holeControlButtonDisabled: {
    borderColor: Colors.golf.border,
    backgroundColor: Colors.golf.background,
  },
  holeScoreDisplay: {
    width: 120,
    height: 120,
    borderRadius: 20,
    backgroundColor: Colors.golf.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.golf.primary,
    gap: 4,
  },
  holeScoreDisplaySaved: {
    backgroundColor: Colors.golf.primary + '20',
    borderColor: Colors.golf.primary,
  },
  holeScoreValue: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  holeScoreValueSaved: {
    color: Colors.golf.primary,
  },
  holeScoreStatus: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.golf.primary,
    textTransform: 'uppercase',
  },
  holeScoreInfo: {
    alignItems: 'center',
  },
  holeScoreInfoText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
  },
  playerInfoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  playerInfoName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  playerInfoStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 16,
  },
  playerInfoStatItem: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  playerInfoStatLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
    textTransform: 'uppercase',
  },
  playerInfoStatValue: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  playerInfoStatOver: {
    color: Colors.golf.error,
  },
  playerInfoStatUnder: {
    color: Colors.golf.success,
  },
  playerScoreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  playerScoreHeader: {
    marginBottom: 16,
  },
  playerScoreInfo: {
    gap: 8,
  },
  playerScoreName: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  playerScoreStats: {
    flexDirection: 'row',
    gap: 16,
  },
  playerScoreStat: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
  },
  playerScoreStatOver: {
    color: Colors.golf.error,
  },
  playerScoreStatUnder: {
    color: Colors.golf.success,
  },
  holeScoreDisplayCompact: {
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: Colors.golf.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.golf.primary,
  },
  holeScoreDisplayDevice: {
    backgroundColor: '#E8F5E9',
    borderColor: Colors.golf.success,
    borderWidth: 3,
  },
  holeScoreValueCompact: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  holeScoreValueDevice: {
    color: Colors.golf.success,
  },
  containerLandscape: {
    transform: [{ rotate: '90deg' }],
    width: '100%',
    height: '100%',
  },
  landscapeBackButton: {
    position: 'absolute' as const,
    top: 16,
    left: 16,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.golf.headerBg,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  landscapeBackText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  scrollViewLandscape: {
    flex: 1,
  },
  contentLandscape: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: 60,
    paddingTop: 80,
  },
  headerLandscape: {
    marginRight: 40,
    minWidth: 200,
  },
  playerNameLandscape: {
    fontSize: 32,
  },
  competitionNameLandscape: {
    fontSize: 18,
  },
  summaryLandscape: {
    flexDirection: 'column',
    minWidth: 180,
    marginRight: 40,
  },
  scorecardLandscape: {
    flex: 1,
    maxWidth: 900,
  },
  sectionTitleLandscape: {
    fontSize: 18,
  },
  legendLandscape: {
    minWidth: 200,
    marginLeft: 40,
  },
});
