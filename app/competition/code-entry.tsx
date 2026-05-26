import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView, Modal, Platform,
} from 'react-native';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter, Stack } from 'expo-router';
import * as Application from 'expo-application';
import Colors from '../../constants/colors';
import { FontFamily } from '../../constants/Typography';
import {
  fetchCompetitionData,
  findCompetitionByDeviceId,
  getMyTodayCompetition,
  linkDeviceToCompetitionPlayer,
} from '@/services/game-service';
import { listCourseNames, getCourseRoutes, getCourseRouteData } from '@/services/course-service';
import { usePlayerAuth } from '../../providers/PlayerAuthProvider';
import { useCompetition } from '../../providers/CompetitionProvider';
import type { FirebaseCompetitionData, Competition } from '../../types/game';
import { Trophy, Users, CheckCircle, AlertCircle, User, MapPin, Hash } from 'lucide-react-native';

// ─── Marker assignment ─────────────────────────────────────────────────────────

type GroupPlayer = FirebaseCompetitionData['players'][number];

interface EnrichedPlayer extends GroupPlayer {
  marksIndex: number;
  markedByIndex: number;
}

function assignMarkers(players: GroupPlayer[]): EnrichedPlayer[] {
  const n = players.length;
  if (n === 0) return [];
  return players.map((p, i) => ({
    ...p,
    marksIndex: (i + 1) % n,
    markedByIndex: (i - 1 + n) % n,
  }));
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const TEE_COLOR_HEX: Record<string, string> = {
  yellow: '#FBBF24',
  blue:   '#3B82F6',
  red:    '#EF4444',
  white:  '#E5E7EB',
  black:  '#374151',
};

const TEE_COLOR_LABEL: Record<string, string> = {
  yellow: 'Amarillo',
  blue:   'Azul',
  red:    'Rojo',
  white:  'Blanco',
  black:  'Negro',
};

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function CodeEntryScreen() {
  const router = useRouter();
  const { upcomingEvents, userLicenses, userProfile, isLoading } = usePlayerAuth();
  const { startCompetition, setDevicePlayerId } = useCompetition();

  const [competitionData, setCompetitionData] = useState<FirebaseCompetitionData | null>(null);
  const inputRef = useRef<TextInput>(null);

  // Device ID
  const [deviceId, setDeviceId] = useState('');
  // Auto-load (device already linked from prior session)
  const [autoLoading, setAutoLoading] = useState(false);
  // "Estoy listo" linking in State B
  const [isLinking, setIsLinking] = useState(false);
  // Course data for State B card
  const [courseCity, setCourseCity] = useState<string | null>(null);
  const [routeSlope, setRouteSlope] = useState<number | null>(null);
  const [routePar, setRoutePar] = useState<number | null>(null);
  // Partial club city for State A card (from todayEvent.golf_club_name)
  const [todayClubCity, setTodayClubCity] = useState<string | null>(null);
  // Group code modal
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [modalCode, setModalCode] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayEvent = useMemo(
    () => upcomingEvents.find((e) => e.start_date === today) ?? null,
    [upcomingEvents, today],
  );

  const playerHandicap = userLicenses[0]?.handicap ?? null;
  const currentPlayerId = userProfile?.uuid ?? null;

  const enrichedPlayers = useMemo(
    () => (competitionData ? assignMarkers(competitionData.players) : []),
    [competitionData],
  );

  const myIndex = useMemo(
    () => enrichedPlayers.findIndex((p) => p.id === currentPlayerId),
    [enrichedPlayers, currentPlayerId],
  );

  // ─── Device ID ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const init = async () => {
      try {
        let id: string;
        if (Platform.OS === 'android') {
          id = Application.getAndroidId() || `android-${Date.now()}`;
        } else if (Platform.OS === 'ios') {
          id = (await Application.getIosIdForVendorAsync()) || `ios-${Date.now()}`;
        } else {
          id = `native-${Date.now()}`;
        }
        setDeviceId(id);
      } catch {
        setDeviceId(`fallback-${Date.now()}`);
      }
    };
    init();
  }, []);

  // ─── Auto-load: three escalating strategies, no group code needed ────────────

  useEffect(() => {
    if (!todayEvent || competitionData || !deviceId) return;
    setAutoLoading(true);

    (async () => {
      // 1. Resume: device already linked from a prior session
      const found = await findCompetitionByDeviceId(deviceId).catch((e) => { console.log('[CE] device lookup failed:', e?.message); return null; });
      if (found) {
        const data = await fetchCompetitionData(found.groupCode).catch(() => null);
        if (data) { console.log('[CE] loaded via device link'); setCompetitionData(data); return; }
      }
      // 2. Registered user: resolve competition by player identity (no group code needed)
      const mine = await getMyTodayCompetition().catch((e) => { console.log('[CE] my-today failed:', e?.message); return null; });
      if (mine) { console.log('[CE] loaded via my-today'); setCompetitionData(mine); return; }
      // 3. Fallback: group_code from upcoming-events
      console.log('[CE] my-today returned null, group_code from event:', todayEvent.group_code);
      if (todayEvent.group_code) {
        const data = await fetchCompetitionData(todayEvent.group_code).catch(() => null);
        if (data) { console.log('[CE] loaded via group_code fallback'); setCompetitionData(data); }
      }
    })().finally(() => setAutoLoading(false));
  }, [todayEvent, competitionData, deviceId]);

  // ─── City lookup for State A (from todayEvent club name) ─────────────────────

  useEffect(() => {
    if (!todayEvent?.golf_club_name) return;
    listCourseNames().then((courses) => {
      const found = courses.find((c) => c.name === todayEvent.golf_club_name);
      if (found?.city) setTodayClubCity(found.city);
    }).catch(() => {});
  }, [todayEvent?.golf_club_name]);

  // ─── Course/route details for State B ────────────────────────────────────────

  useEffect(() => {
    if (!competitionData?.course_name) return;
    const { course_name, route_name } = competitionData;

    (async () => {
      const courses = await listCourseNames().catch(() => []);
      const found = courses.find((c) => c.name === course_name);
      if (found?.city) setCourseCity(found.city);

      // route_name from backend is a start-time label (e.g. "Salida 1"), not a DB route name.
      // Try exact match first; if it fails, fall back to the first route in the catalog.
      let routeData = route_name
        ? await getCourseRouteData(course_name, route_name).catch(() => null)
        : null;

      if (!routeData && found) {
        const routes = await getCourseRoutes(found.id).catch(() => []);
        if (routes.length > 0) {
          setRoutePar(routes[0].parTotal);
          routeData = await getCourseRouteData(course_name, routes[0].name).catch(() => null);
        }
      }

      if (routeData) {
        setRoutePar(routeData.par_total ?? null);
        setRouteSlope(routeData.slope ?? null);
      }
    })();
  }, [competitionData?.course_name, competitionData?.route_name]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  const _buildComp = (data: FirebaseCompetitionData): Competition => ({
    groupCode: data.group_code,
    competitionName: data.competition_name,
    eventName: data.event_name,
    courseName: data.course_name,
    routeName: data.route_name,
    sessionUuid: data.session_uuid,
    scoringMode: data.effective_scoring_entry_mode === 'partial' ? 'partial' : 'all',
    players: data.players.map((p) => ({
      id: p.id,
      firstName: p.first_name,
      lastName: p.last_name,
      license: p.license,
      handicap: p.playing_handicap,
    })),
  });

  const _linkAndNavigate = async (data: FirebaseCompetitionData) => {
    const comp = _buildComp(data);
    if (currentPlayerId && deviceId) {
      try {
        await linkDeviceToCompetitionPlayer(data.group_code, currentPlayerId, deviceId);
      } catch {}
      startCompetition(comp);
      await setDevicePlayerId(currentPlayerId);
      router.replace({
        pathname: '/competition/waiting-players',
        params: { competitionData: JSON.stringify(data), myPlayerId: currentPlayerId },
      });
    } else {
      startCompetition(comp);
      router.push({
        pathname: '/competition/select-player',
        params: { competitionData: JSON.stringify(data) },
      });
    }
  };

  // ─── Modal submit ─────────────────────────────────────────────────────────────

  const handleModalSubmit = async () => {
    const code = modalCode.trim().toUpperCase();
    if (code.length < 4) return;

    setModalLoading(true);
    setModalError(null);
    try {
      const data = await fetchCompetitionData(code);
      if (!data) {
        setModalError('No se encontró ninguna competición con este código');
        return;
      }
      // Close modal and show State B so the user sees full route/tee info
      // before pressing "Estoy listo" to proceed.
      setShowCodeModal(false);
      setModalCode('');
      setCompetitionData(data);
    } catch {
      setModalError('Error al cargar la competición. Inténtalo de nuevo.');
    } finally {
      setModalLoading(false);
    }
  };

  // ─── State B: "Estoy listo" from auto-loaded competition ─────────────────────

  const handleListo = async () => {
    if (!competitionData) return;
    setIsLinking(true);
    try {
      await _linkAndNavigate(competitionData);
    } finally {
      setIsLinking(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  const formattedToday = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, []);

  if (isLoading || (todayEvent && !competitionData && autoLoading)) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Competición', headerStyle: { backgroundColor: Colors.golf.headerBg }, headerTintColor: '#fff' }} />
        <ActivityIndicator size="large" color={Colors.golf.primary} />
        <Text style={styles.checkingText}>
          {isLoading ? 'Comprobando inscripciones...' : 'Cargando tu competición...'}
        </Text>
      </View>
    );
  }

  // ── State A: event detected, no competition group loaded yet ──────────────────

  if (todayEvent && !competitionData) {
    return (
      <>
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
          <Stack.Screen options={{ title: 'Competición', headerStyle: { backgroundColor: Colors.golf.headerBg }, headerTintColor: '#fff' }} />

          <View style={styles.heroCard}>
            <View style={styles.heroIconWrap}>
              <Trophy size={32} color={Colors.golf.primary} strokeWidth={1.5} />
            </View>
            <Text style={styles.heroTitle}>{todayEvent.tour_name}</Text>
            <Text style={styles.heroPrueba}>{todayEvent.event_name}</Text>
            <View style={styles.heroDateRow}>
              <Text style={styles.heroDateText}>{formattedToday}</Text>
            </View>
          </View>

          {todayEvent.golf_club_name ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <MapPin size={16} color={Colors.golf.primary} />
                <Text style={styles.sectionTitle}>Campo</Text>
              </View>
              <View style={styles.courseInfoList}>
                <View style={styles.courseInfoRow}>
                  <Text style={styles.courseInfoLabel}>Club</Text>
                  <Text style={styles.courseInfoValue}>{todayEvent.golf_club_name}</Text>
                </View>
                {todayClubCity ? (
                  <View style={styles.courseInfoRow}>
                    <Text style={styles.courseInfoLabel}>Localidad</Text>
                    <Text style={styles.courseInfoValue}>{todayClubCity}</Text>
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {playerHandicap !== null && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Tu handicap</Text>
              <Text style={styles.infoValue}>{playerHandicap}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.listoBtn, isLinking && styles.listoBtnDisabled]}
            onPress={async () => {
              setIsLinking(true);
              try {
                const mine = await getMyTodayCompetition().catch(() => null);
                if (mine) { setCompetitionData(mine); return; }
                if (todayEvent.group_code) {
                  const data = await fetchCompetitionData(todayEvent.group_code).catch(() => null);
                  if (data) { setCompetitionData(data); return; }
                }
              } finally {
                setIsLinking(false);
              }
              setModalError(null);
              setShowCodeModal(true);
            }}
            disabled={isLinking}
          >
            {isLinking
              ? <ActivityIndicator size="small" color="#fff" />
              : <><CheckCircle size={20} color="#fff" /><Text style={styles.listoBtnText}>Estoy listo</Text></>
            }
          </TouchableOpacity>
        </ScrollView>

        {/* Group code modal — last resort when group_code is not assigned yet */}
        <Modal
          visible={showCodeModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowCodeModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <View style={styles.modalIconWrap}>
                <Hash size={28} color={Colors.golf.primary} />
              </View>
              <Text style={styles.modalTitle}>Código de grupo</Text>
              <Text style={styles.modalHint}>
                Introduce el código de tu salida (lo encontrarás en la hoja de marcación)
              </Text>
              <TextInput
                ref={inputRef}
                style={styles.modalInput}
                value={modalCode}
                onChangeText={(t) => { setModalCode(t.toUpperCase()); setModalError(null); }}
                placeholder="Ej. A3B7C"
                placeholderTextColor={Colors.golf.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
                editable={!modalLoading}
                autoFocus
              />
              {modalError ? (
                <View style={styles.errorRow}>
                  <AlertCircle size={14} color={Colors.golf.error} />
                  <Text style={styles.errorText}>{modalError}</Text>
                </View>
              ) : null}
              <View style={styles.modalBtns}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setShowCodeModal(false)}
                  disabled={modalLoading}
                >
                  <Text style={styles.modalCancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, (modalLoading || modalCode.length < 4) && styles.btnDisabled]}
                  onPress={handleModalSubmit}
                  disabled={modalLoading || modalCode.length < 4}
                >
                  {modalLoading
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.modalConfirmText}>Confirmar</Text>}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </>
    );
  }

  // ── State B: competition group loaded (auto-load from linked device) ───────────

  if (competitionData) {
    const myPlayer = myIndex >= 0 ? enrichedPlayers[myIndex] : null;
    const myPlayingHandicap = myPlayer?.playing_handicap ?? playerHandicap;
    const myTeeColor = myPlayer?.tee_color;

    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Stack.Screen options={{ title: 'Competición', headerStyle: { backgroundColor: Colors.golf.headerBg }, headerTintColor: '#fff' }} />

        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Trophy size={32} color={Colors.golf.primary} strokeWidth={1.5} />
          </View>
          <Text style={styles.heroTitle}>{competitionData.competition_name}</Text>
          <Text style={styles.heroPrueba}>{competitionData.event_name}</Text>
          <View style={styles.heroDateRow}>
            <Text style={styles.heroDateText}>{formattedToday}</Text>
          </View>
        </View>

        {/* Club & route info */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <MapPin size={16} color={Colors.golf.primary} />
            <Text style={styles.sectionTitle}>Campo y recorrido</Text>
          </View>
          <View style={styles.courseInfoList}>
            {competitionData.course_name ? (
              <View style={styles.courseInfoRow}>
                <Text style={styles.courseInfoLabel}>Club</Text>
                <Text style={styles.courseInfoValue}>{competitionData.course_name}</Text>
              </View>
            ) : null}
            {courseCity ? (
              <View style={styles.courseInfoRow}>
                <Text style={styles.courseInfoLabel}>Localidad</Text>
                <Text style={styles.courseInfoValue}>{courseCity}</Text>
              </View>
            ) : null}
            {competitionData.route_name ? (
              <View style={styles.courseInfoRow}>
                <Text style={styles.courseInfoLabel}>Recorrido</Text>
                <Text style={styles.courseInfoValue}>{competitionData.route_name}</Text>
              </View>
            ) : null}
            {routePar !== null ? (
              <View style={styles.courseInfoRow}>
                <Text style={styles.courseInfoLabel}>Par</Text>
                <Text style={styles.courseInfoValue}>{routePar}</Text>
              </View>
            ) : null}
            {routeSlope !== null ? (
              <View style={styles.courseInfoRow}>
                <Text style={styles.courseInfoLabel}>Slope</Text>
                <Text style={styles.courseInfoValue}>{routeSlope}</Text>
              </View>
            ) : null}
            {myTeeColor && myTeeColor !== 'not_applicable' ? (
              <View style={styles.courseInfoRow}>
                <Text style={styles.courseInfoLabel}>Tee</Text>
                <View style={styles.teeRow}>
                  <View style={[styles.teeDotLg, { backgroundColor: TEE_COLOR_HEX[myTeeColor] ?? Colors.golf.border }]} />
                  <Text style={styles.courseInfoValue}>
                    {TEE_COLOR_LABEL[myTeeColor] ?? myTeeColor}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* Handicap */}
        {(myPlayingHandicap !== null || myTeeColor) && (
          <View style={styles.infoRow}>
            {myPlayingHandicap !== null && (
              <>
                <Text style={styles.infoLabel}>Tu handicap de juego</Text>
                <Text style={styles.infoValue}>{myPlayingHandicap}</Text>
              </>
            )}
            {myTeeColor && myTeeColor !== 'not_applicable' && (
              <View style={[styles.teeDot, { backgroundColor: TEE_COLOR_HEX[myTeeColor] ?? Colors.golf.border }]} />
            )}
          </View>
        )}

        {/* Players */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Users size={16} color={Colors.golf.primary} />
            <Text style={styles.sectionTitle}>Tu grupo</Text>
          </View>
          {enrichedPlayers.map((player, idx) => {
            const isMe = player.id === currentPlayerId;
            const iMark = myIndex >= 0 && idx === enrichedPlayers[myIndex]?.marksIndex;
            const marksMe = myIndex >= 0 && idx === enrichedPlayers[myIndex]?.markedByIndex;
            const teeHex = player.tee_color && player.tee_color !== 'not_applicable'
              ? (TEE_COLOR_HEX[player.tee_color] ?? null)
              : null;
            return (
              <View key={player.id} style={[styles.playerRow, isMe && styles.playerRowMe]}>
                <View style={[styles.playerAvatar, isMe && styles.playerAvatarMe]}>
                  <User size={16} color={isMe ? '#fff' : Colors.golf.textLight} />
                </View>
                <View style={styles.playerInfo}>
                  <Text style={[styles.playerName, isMe && styles.playerNameMe]}>
                    {player.first_name} {player.last_name}{isMe ? '  (Tú)' : ''}
                  </Text>
                  {isMe && myIndex >= 0 && (
                    <Text style={styles.playerRole}>
                      Marcas a: {enrichedPlayers[enrichedPlayers[myIndex].marksIndex].first_name} {enrichedPlayers[enrichedPlayers[myIndex].marksIndex].last_name}
                    </Text>
                  )}
                  {marksMe && <Text style={styles.playerMarkerLabel}>Tu marcador</Text>}
                  {iMark && !isMe && <Text style={styles.playerMarksLabel}>Lo marcas tú</Text>}
                </View>
                {teeHex && <View style={[styles.teeDot, { backgroundColor: teeHex }]} />}
                {player.playing_handicap !== undefined && (
                  <View style={styles.hcpBadge}>
                    <Text style={styles.hcpText}>{player.playing_handicap}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.listoBtn, isLinking && styles.listoBtnDisabled]}
          onPress={handleListo}
          disabled={isLinking}
        >
          {isLinking ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <CheckCircle size={20} color="#fff" />
              <Text style={styles.listoBtnText}>Estoy listo</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── State C: no competition today — manual fallback ───────────────────────────

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Stack.Screen options={{ title: 'Competición', headerStyle: { backgroundColor: Colors.golf.headerBg }, headerTintColor: '#fff' }} />

        <View style={styles.noCompCard}>
          <AlertCircle size={40} color={Colors.golf.textMuted} strokeWidth={1.5} />
          <Text style={styles.noCompDate}>{formattedToday}</Text>
          <Text style={styles.noCompMessage}>
            Su usuario no aparece como inscrito en ninguna competición para el día de hoy.
            Si crees que es un error, introduce el código de grupo manualmente.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.listoBtn}
          onPress={() => { setModalError(null); setShowCodeModal(true); }}
        >
          <Hash size={20} color="#fff" />
          <Text style={styles.listoBtnText}>Introducir código</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showCodeModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCodeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconWrap}>
              <Hash size={28} color={Colors.golf.primary} />
            </View>
            <Text style={styles.modalTitle}>Código de grupo</Text>
            <Text style={styles.modalHint}>
              Introduce el código alfanumérico de tu grupo
            </Text>
            <TextInput
              ref={inputRef}
              style={styles.modalInput}
              value={modalCode}
              onChangeText={(t) => { setModalCode(t.toUpperCase()); setModalError(null); }}
              placeholder="Código de grupo"
              placeholderTextColor={Colors.golf.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              editable={!modalLoading}
              autoFocus
            />
            {modalError ? (
              <View style={styles.errorRow}>
                <AlertCircle size={14} color={Colors.golf.error} />
                <Text style={styles.errorText}>{modalError}</Text>
              </View>
            ) : null}
            <View style={styles.modalBtns}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCodeModal(false)}
                disabled={modalLoading}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, (modalLoading || modalCode.length < 4) && styles.btnDisabled]}
                onPress={handleModalSubmit}
                disabled={modalLoading || modalCode.length < 4}
              >
                {modalLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.modalConfirmText}>Confirmar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.golf.background,
  },
  scrollContent: {
    padding: 20,
    gap: 16,
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: Colors.golf.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
  },
  checkingText: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.golf.textLight,
  },

  // Hero card
  heroCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  heroIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: Colors.golf.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontFamily: FontFamily.heading,
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    textAlign: 'center',
  },
  heroPrueba: {
    fontFamily: FontFamily.bodySemi,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
    textAlign: 'center',
  },
  heroDateRow: {
    marginTop: 4,
  },
  heroDateText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.golf.textMuted,
    textTransform: 'capitalize',
  },

  // Info row (handicap)
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  infoLabel: {
    fontFamily: FontFamily.bodySemi,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
  },
  infoValue: {
    fontFamily: FontFamily.heading,
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
  },

  // Section card
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.golf.textLight,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },

  // Course info list
  courseInfoList: {
    gap: 0,
  },
  courseInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.golf.border,
  },
  courseInfoLabel: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.golf.textMuted,
    flex: 1,
  },
  courseInfoValue: {
    fontFamily: FontFamily.bodySemi,
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.golf.text,
    textAlign: 'right',
    flex: 2,
  },
  teeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'flex-end',
    flex: 2,
  },
  teeDotLg: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },

  // Error row
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  errorText: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.golf.error,
    flex: 1,
  },

  // Players list
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.golf.border,
  },
  playerRowMe: {
    backgroundColor: Colors.golf.primary + '08',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    borderTopWidth: 0,
    marginTop: 2,
  },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.golf.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.golf.border,
  },
  playerAvatarMe: {
    backgroundColor: Colors.golf.primary,
    borderColor: Colors.golf.primary,
  },
  playerInfo: {
    flex: 1,
    gap: 2,
  },
  playerName: {
    fontFamily: FontFamily.bodySemi,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.golf.text,
  },
  playerNameMe: {
    color: Colors.golf.primary,
    fontFamily: FontFamily.bodyBold,
    fontWeight: '700' as const,
  },
  playerRole: {
    fontFamily: FontFamily.body,
    fontSize: 12,
    color: Colors.golf.textMuted,
  },
  playerMarkerLabel: {
    fontFamily: FontFamily.bodySemi,
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.golf.warning,
    letterSpacing: 0.3,
  },
  playerMarksLabel: {
    fontFamily: FontFamily.bodySemi,
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.golf.info,
    letterSpacing: 0.3,
  },
  teeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
  hcpBadge: {
    backgroundColor: Colors.golf.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.golf.border,
  },
  hcpText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.golf.textLight,
  },

  // Listo button
  listoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.golf.primary,
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  listoBtnDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  listoBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.3,
  },
  btnDisabled: {
    backgroundColor: Colors.golf.border,
  },

  // No competition state
  noCompCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  noCompDate: {
    fontFamily: FontFamily.bodySemi,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
    textTransform: 'capitalize',
  },
  noCompMessage: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.golf.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },

  // Group code modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    gap: 12,
  },
  modalIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: Colors.golf.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  modalTitle: {
    fontFamily: FontFamily.headingSemi,
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    textAlign: 'center',
  },
  modalHint: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.golf.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalInput: {
    width: '100%',
    fontFamily: FontFamily.bodyBold,
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    backgroundColor: Colors.golf.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.golf.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    letterSpacing: 3,
    textAlign: 'center',
  },
  modalBtns: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.golf.border,
  },
  modalCancelText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.golf.textLight,
  },
  modalConfirmBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: Colors.golf.primary,
  },
  modalConfirmText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
