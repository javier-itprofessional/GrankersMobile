import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Image,
} from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BarChart3, Settings, ChevronRight, User, Calendar, LogOut,
  Award, Trophy, Users, FileText,
} from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import Colors from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/Typography';
import { usePlayerAuth } from '@/providers/PlayerAuthProvider';
import { getDashboardStats, getUpcomingEvents, DashboardStats, UpcomingEvent } from '@/services/user-service';

interface MenuItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function MenuItem({ icon, title, subtitle, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuIconContainer}>{icon}</View>
      <View style={styles.menuTextContainer}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight size={18} color={Colors.golf.border} />
    </TouchableOpacity>
  );
}

interface StatCardProps {
  value: number;
  label: string;
  icon: React.ReactNode;
}

function StatCard({ value, label, icon }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function statusBadgeStyle(status: string) {
  if (status === 'confirmed') return styles.badgeConfirmed;
  if (status === 'pending') return styles.badgePending;
  return styles.badgeDefault;
}

function statusLabel(status: string): string {
  if (status === 'confirmed') return 'Confirmado';
  if (status === 'pending') return 'Pendiente';
  if (status === 'cancelled') return 'Cancelado';
  return status;
}

export default function PlayerAreaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, userProfile, isLoading, isAuthenticated, clearSession } = usePlayerAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [events, setEvents] = useState<UpcomingEvent[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!isLoading && !isAuthenticated) {
        router.replace('/player-area/login');
      }
    }, [isLoading, isAuthenticated, router])
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    setDataLoading(true);
    Promise.all([getDashboardStats(), getUpcomingEvents()])
      .then(([s, e]) => {
        setStats(s);
        setEvents(e.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setDataLoading(false));
  }, [isAuthenticated]);

  const handleLogout = useCallback(async () => {
    await clearSession();
    router.replace('/player-area/login');
  }, [clearSession, router]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Área del Jugador', headerStyle: { backgroundColor: Colors.golf.headerBg }, headerTintColor: '#FFFFFF' }} />
        <ActivityIndicator size="large" color={Colors.golf.primary} />
        <Text style={styles.loadingText}>Cargando sesión...</Text>
      </View>
    );
  }

  if (!isAuthenticated || !session) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: 'Área del Jugador', headerStyle: { backgroundColor: Colors.golf.headerBg }, headerTintColor: '#FFFFFF' }} />
        <ActivityIndicator size="large" color={Colors.golf.primary} />
      </View>
    );
  }

  const displayName = session.name || userProfile?.email || '';
  const handicap = userProfile ? null : null; // comes from license

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Área del Jugador', headerStyle: { backgroundColor: Colors.golf.headerBg }, headerTintColor: '#FFFFFF' }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/player-area/profile')} activeOpacity={0.9}>
          <View style={styles.profileLeft}>
            {userProfile?.profile_picture ? (
              <Image source={{ uri: userProfile.profile_picture }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <User size={28} color="#FFFFFF" strokeWidth={1.5} />
              </View>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{displayName}</Text>
            <Text style={styles.profileEmail}>{session.email}</Text>
            {session.country ? (
              <View style={styles.countryBadge}>
                <Text style={styles.countryText}>{session.country}</Text>
              </View>
            ) : null}
          </View>
          <ChevronRight size={18} color="rgba(255,255,255,0.5)" />
        </TouchableOpacity>

        {/* Stats row */}
        {(stats || dataLoading) && (
          <View style={styles.statsRow}>
            {dataLoading && !stats ? (
              <ActivityIndicator color={Colors.golf.primary} style={{ flex: 1 }} />
            ) : stats ? (
              <>
                <StatCard
                  value={stats.events_count}
                  label="Eventos"
                  icon={<Calendar size={18} color={Colors.golf.primary} />}
                />
                <View style={styles.statDivider} />
                <StatCard
                  value={stats.tours_count}
                  label="Torneos"
                  icon={<Trophy size={18} color={Colors.golf.gold} />}
                />
                <View style={styles.statDivider} />
                <StatCard
                  value={stats.clubs_count}
                  label="Clubes"
                  icon={<Users size={18} color={Colors.golf.water} />}
                />
              </>
            ) : null}
          </View>
        )}

        {/* Upcoming events */}
        {events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Próximos eventos</Text>
            <View style={styles.menuCard}>
              {events.map((ev, idx) => (
                <View key={ev.registration_uuid}>
                  {idx > 0 && <View style={styles.separator} />}
                  <TouchableOpacity
                    style={styles.eventRow}
                    onPress={() => router.push('/player-area/competitions')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.eventInfo}>
                      <Text style={styles.eventName} numberOfLines={1}>{ev.event_name}</Text>
                      <Text style={styles.eventMeta}>{ev.tour_name} · {formatDate(ev.start_date)}</Text>
                      {ev.golf_club_name ? (
                        <Text style={styles.eventClub} numberOfLines={1}>{ev.golf_club_name}</Text>
                      ) : null}
                    </View>
                    <View style={[styles.statusBadge, statusBadgeStyle(ev.status)]}>
                      <Text style={styles.statusText}>{statusLabel(ev.status)}</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Main menu */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>General</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon={<Calendar size={20} color={Colors.golf.primary} />}
              title="Competiciones"
              subtitle="Consulta tus competiciones"
              onPress={() => router.push('/player-area/competitions')}
            />
            <View style={styles.separator} />
            <MenuItem
              icon={<BarChart3 size={20} color={Colors.golf.water} />}
              title="Tarjetas de puntuación"
              subtitle="Historial de rondas y estadísticas"
              onPress={() => router.push('/player-area/scorecard')}
            />
            <View style={styles.separator} />
            <MenuItem
              icon={<Award size={20} color={Colors.golf.gold} />}
              title="Licencias y hándicap"
              subtitle="Gestiona tus licencias federativas"
              onPress={() => router.push('/player-area/profile')}
            />
            <View style={styles.separator} />
            <MenuItem
              icon={<FileText size={20} color={Colors.golf.textLight} />}
              title="Mi perfil"
              subtitle="Datos personales y de golf"
              onPress={() => router.push('/player-area/profile')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Configuración</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon={<Settings size={20} color={Colors.golf.textLight} />}
              title="Ajustes"
              subtitle="Preferencias de la aplicación"
              onPress={() => router.push('/player-area/settings')}
            />
          </View>
        </View>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
          testID="logout-button"
        >
          <LogOut size={18} color={Colors.golf.error} />
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.golf.background },
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: Colors.golf.background, gap: 16,
  },
  loadingText: {
    fontSize: FontSize.bodyS, fontFamily: FontFamily.bodyMedium, color: Colors.golf.textLight,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Profile card
  profileCard: {
    backgroundColor: Colors.golf.headerBg,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  profileLeft: { marginRight: 14 },
  avatar: { width: 60, height: 60, borderRadius: 16 },
  avatarPlaceholder: {
    width: 60, height: 60, borderRadius: 16,
    backgroundColor: Colors.golf.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  profileInfo: { flex: 1 },
  profileName: {
    fontSize: FontSize.bodyL, fontFamily: FontFamily.heading,
    color: '#FFFFFF', marginBottom: 2,
  },
  profileEmail: {
    fontSize: FontSize.bodyS, fontFamily: FontFamily.body,
    color: 'rgba(255,255,255,0.65)',
  },
  countryBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
    marginTop: 6, alignSelf: 'flex-start',
  },
  countryText: {
    fontSize: 12, fontFamily: FontFamily.bodySemi, color: '#FFFFFF',
  },

  // Stats
  statsRow: {
    flexDirection: 'row', backgroundColor: '#FFFFFF',
    borderRadius: 14, marginBottom: 16,
    paddingVertical: 16, paddingHorizontal: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  statCard: { flex: 1, alignItems: 'center', gap: 4 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: Colors.golf.border },
  statIcon: {
    width: 34, height: 34, borderRadius: 9,
    backgroundColor: Colors.golf.background,
    justifyContent: 'center', alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.h4, fontFamily: FontFamily.headingBold, color: Colors.golf.text,
  },
  statLabel: {
    fontSize: FontSize.caption, fontFamily: FontFamily.body, color: Colors.golf.textMuted,
  },

  // Events
  eventRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 14,
  },
  eventInfo: { flex: 1, paddingRight: 8 },
  eventName: {
    fontSize: FontSize.bodyM, fontFamily: FontFamily.bodySemi, color: Colors.golf.text,
  },
  eventMeta: {
    fontSize: FontSize.bodyS, fontFamily: FontFamily.body,
    color: Colors.golf.textLight, marginTop: 2,
  },
  eventClub: {
    fontSize: FontSize.caption, fontFamily: FontFamily.body,
    color: Colors.golf.textMuted, marginTop: 1,
  },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeConfirmed: { backgroundColor: Colors.golf.primarySoft },
  badgePending: { backgroundColor: Colors.golf.goldSoft },
  badgeDefault: { backgroundColor: Colors.golf.background },
  statusText: {
    fontSize: 11, fontFamily: FontFamily.bodySemi, color: Colors.golf.text,
  },

  // Sections / menu
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11, fontFamily: FontFamily.bodySemi,
    color: Colors.golf.textLight,
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginBottom: 8, marginLeft: 4,
  },
  menuCard: {
    backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  menuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 14,
  },
  menuIconContainer: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: Colors.golf.background,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  menuTextContainer: { flex: 1 },
  menuTitle: {
    fontSize: FontSize.bodyM, fontFamily: FontFamily.bodySemi,
    color: Colors.golf.text, marginBottom: 1,
  },
  menuSubtitle: {
    fontSize: FontSize.bodyS, fontFamily: FontFamily.body, color: Colors.golf.textLight,
  },
  separator: {
    height: StyleSheet.hairlineWidth, backgroundColor: Colors.golf.border, marginLeft: 64,
  },

  logoutButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 14, gap: 8, marginBottom: 20,
  },
  logoutText: {
    fontSize: FontSize.bodyM, fontFamily: FontFamily.bodySemi, color: Colors.golf.error,
  },
});
