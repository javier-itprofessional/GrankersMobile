import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, ScrollView, Alert,
} from 'react-native';
import { useState, useMemo, useRef } from 'react';
import { useRouter, Stack } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import Colors from '../../constants/colors';
import { FontFamily } from '../../constants/Typography';
import { fetchCompetitionData } from '@/services/game-service';
import { usePlayerAuth } from '../../providers/PlayerAuthProvider';
import { useCompetition } from '../../providers/CompetitionProvider';
import type { FirebaseCompetitionData, Competition } from '../../types/game';
import { Trophy, Users, Hash, CheckCircle, AlertCircle, User } from 'lucide-react-native';

// ─── Marker assignment ─────────────────────────────────────────────────────────

type GroupPlayer = FirebaseCompetitionData['players'][number];

interface EnrichedPlayer extends GroupPlayer {
  marksIndex: number;  // index of the player this player marks
  markedByIndex: number; // index of the player who marks this player
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

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function CodeEntryScreen() {
  const router = useRouter();
  const { upcomingEvents, userLicenses, userProfile, isLoading } = usePlayerAuth();
  const { startCompetition } = useCompetition();

  const [groupCode, setGroupCode] = useState('');
  const [competitionData, setCompetitionData] = useState<FirebaseCompetitionData | null>(null);
  const inputRef = useRef<TextInput>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const todayEvent = useMemo(
    () => upcomingEvents.find((e) => e.start_date === today) ?? null,
    [upcomingEvents, today],
  );

  const playerHandicap = userLicenses[0]?.handicap ?? null;
  // userProfile.uuid matches competition player.id (both are user.uuid from backend)
  const currentPlayerId = userProfile?.uuid ?? null;

  const enrichedPlayers = useMemo(
    () => (competitionData ? assignMarkers(competitionData.players) : []),
    [competitionData],
  );

  const myIndex = useMemo(
    () => enrichedPlayers.findIndex((p) => p.id === currentPlayerId),
    [enrichedPlayers, currentPlayerId],
  );

  // ─── Group code lookup ───────────────────────────────────────────────────────

  const groupMutation = useMutation({
    mutationFn: async (code: string) => {
      const data = await fetchCompetitionData(code);
      if (!data) throw new Error('No se encontró ninguna competición con este código');
      return data;
    },
    onSuccess: (data) => setCompetitionData(data),
    onError: (err: Error) => {
      Alert.alert('Error', err.message || 'Código no válido. Inténtalo de nuevo.');
    },
  });

  const handleSubmitCode = () => {
    const code = groupCode.trim().toUpperCase();
    if (code.length >= 4) {
      groupMutation.mutate(code);
    } else {
      Alert.alert('Código inválido', 'Introduce al menos 4 caracteres');
    }
  };

  const handleListo = () => {
    if (!competitionData) return;
    const comp: Competition = {
      groupCode: competitionData.group_code,
      competitionName: competitionData.competition_name,
      eventName: competitionData.event_name,
      courseName: competitionData.course_name,
      routeName: competitionData.route_name,
      sessionUuid: competitionData.session_uuid,
      scoringMode: competitionData.effective_scoring_entry_mode === 'partial' ? 'partial' : 'all',
      players: competitionData.players.map((p) => ({
        id: p.id,
        firstName: p.first_name,
        lastName: p.last_name,
        license: p.license,
        handicap: p.handicap,
      })),
    };
    startCompetition(comp);
    router.push({
      pathname: '/competition/select-player',
      params: { competitionData: JSON.stringify(competitionData) },
    });
  };

  // ─── Rendered regions ────────────────────────────────────────────────────────

  const formattedToday = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }, []);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Stack.Screen options={{ title: 'Competición', headerStyle: { backgroundColor: Colors.golf.headerBg }, headerTintColor: '#fff' }} />
        <ActivityIndicator size="large" color={Colors.golf.primary} />
        <Text style={styles.checkingText}>Comprobando inscripciones...</Text>
      </View>
    );
  }

  // ── State A: competition found, group not yet loaded ──────────────────────────

  if (todayEvent && !competitionData) {
    return (
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

        {playerHandicap !== null && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tu handicap</Text>
            <Text style={styles.infoValue}>{playerHandicap}</Text>
          </View>
        )}

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Código de grupo</Text>
          <Text style={styles.sectionHint}>
            Introduce el código de tu salida (lo encontrarás en la hoja de marcación)
          </Text>
          <View style={styles.codeInputRow}>
            <TextInput
              ref={inputRef}
              style={styles.codeInput}
              value={groupCode}
              onChangeText={(t) => setGroupCode(t.toUpperCase())}
              placeholder="Ej. A3B7C"
              placeholderTextColor={Colors.golf.textMuted}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              editable={!groupMutation.isPending}
            />
            <TouchableOpacity
              style={[styles.codeSubmitBtn, groupCode.length < 4 && styles.btnDisabled]}
              onPress={handleSubmitCode}
              disabled={groupCode.length < 4 || groupMutation.isPending}
            >
              {groupMutation.isPending
                ? <ActivityIndicator size="small" color="#fff" />
                : <Hash size={20} color="#fff" />}
            </TouchableOpacity>
          </View>
          {groupMutation.isError && (
            <View style={styles.errorRow}>
              <AlertCircle size={14} color={Colors.golf.error} />
              <Text style={styles.errorText}>
                {(groupMutation.error as Error)?.message || 'Error al cargar el grupo'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  // ── State B: group loaded — show group details + Listo ────────────────────────

  if (competitionData) {
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

        {playerHandicap !== null && (
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tu handicap</Text>
            <Text style={styles.infoValue}>{playerHandicap}</Text>
          </View>
        )}

        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Users size={16} color={Colors.golf.primary} />
            <Text style={styles.sectionTitle}>Tu grupo</Text>
          </View>

          {enrichedPlayers.map((player, idx) => {
            const isMe = player.id === currentPlayerId;
            const iMark = myIndex >= 0 && idx === enrichedPlayers[myIndex]?.marksIndex;
            const marksMe = myIndex >= 0 && idx === enrichedPlayers[myIndex]?.markedByIndex;

            return (
              <View
                key={player.id}
                style={[styles.playerRow, isMe && styles.playerRowMe]}
              >
                <View style={[styles.playerAvatar, isMe && styles.playerAvatarMe]}>
                  <User size={16} color={isMe ? '#fff' : Colors.golf.textLight} />
                </View>
                <View style={styles.playerInfo}>
                  <Text style={[styles.playerName, isMe && styles.playerNameMe]}>
                    {player.first_name} {player.last_name}
                    {isMe ? '  (Tú)' : ''}
                  </Text>
                  {isMe && myIndex >= 0 && (
                    <Text style={styles.playerRole}>
                      Marcas a: {enrichedPlayers[enrichedPlayers[myIndex].marksIndex].first_name} {enrichedPlayers[enrichedPlayers[myIndex].marksIndex].last_name}
                    </Text>
                  )}
                  {marksMe && (
                    <Text style={styles.playerMarkerLabel}>Tu marcador</Text>
                  )}
                  {iMark && !isMe && (
                    <Text style={styles.playerMarksLabel}>Lo marcas tú</Text>
                  )}
                </View>
                {player.handicap !== undefined && (
                  <View style={styles.hcpBadge}>
                    <Text style={styles.hcpText}>{player.handicap}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <TouchableOpacity style={styles.listoBtn} onPress={handleListo}>
          <CheckCircle size={20} color="#fff" />
          <Text style={styles.listoBtnText}>Listo</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // ── State C: no competition today — manual fallback ───────────────────────────

  return (
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

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Código de competición</Text>
        <Text style={styles.sectionHint}>Introduce el código alfanumérico de tu grupo</Text>
        <View style={styles.codeInputRow}>
          <TextInput
            ref={inputRef}
            style={styles.codeInput}
            value={groupCode}
            onChangeText={(t) => setGroupCode(t.toUpperCase())}
            placeholder="Código de grupo"
            placeholderTextColor={Colors.golf.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={12}
            editable={!groupMutation.isPending}
          />
          <TouchableOpacity
            style={[styles.codeSubmitBtn, groupCode.length < 4 && styles.btnDisabled]}
            onPress={handleSubmitCode}
            disabled={groupCode.length < 4 || groupMutation.isPending}
          >
            {groupMutation.isPending
              ? <ActivityIndicator size="small" color="#fff" />
              : <CheckCircle size={20} color="#fff" />}
          </TouchableOpacity>
        </View>
        {groupMutation.isError && (
          <View style={styles.errorRow}>
            <AlertCircle size={14} color={Colors.golf.error} />
            <Text style={styles.errorText}>
              {(groupMutation.error as Error)?.message || 'Código no encontrado'}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
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
  sectionHint: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.golf.textMuted,
    lineHeight: 19,
  },

  // Code input
  codeInputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  codeInput: {
    flex: 1,
    fontFamily: FontFamily.bodyBold,
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    backgroundColor: Colors.golf.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.golf.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    letterSpacing: 2,
  },
  codeSubmitBtn: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: Colors.golf.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    backgroundColor: Colors.golf.border,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  listoBtnText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.3,
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
});
