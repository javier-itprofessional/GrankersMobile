import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BarChart3, History, Award, Settings, ChevronRight, User, Calendar, LogOut } from 'lucide-react-native';
import { useCallback } from 'react';
import Colors from '@/constants/colors';
import { usePlayerAuth } from '@/providers/PlayerAuthProvider';

interface MenuItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onPress: () => void;
}

function MenuItem({ icon, title, subtitle, onPress }: MenuItemProps) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuIconContainer}>
        {icon}
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight size={18} color={Colors.golf.border} />
    </TouchableOpacity>
  );
}

export default function PlayerAreaScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, isLoading, isAuthenticated, clearSession } = usePlayerAuth();

  useFocusEffect(
    useCallback(() => {
      console.log('[PlayerArea] Screen focused, isLoading:', isLoading, 'isAuthenticated:', isAuthenticated);
      if (!isLoading && !isAuthenticated) {
        console.log('[PlayerArea] No session, redirecting to login');
        router.replace('/player-area/login');
      }
    }, [isLoading, isAuthenticated, router])
  );

  const handleLogout = useCallback(async () => {
    console.log('[PlayerArea] Logging out');
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

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Área del Jugador', headerStyle: { backgroundColor: Colors.golf.headerBg }, headerTintColor: '#FFFFFF' }} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <User size={36} color="#FFFFFF" strokeWidth={1.5} />
          </View>
          <Text style={styles.profileName}>{session.name}</Text>
          <Text style={styles.profileSubtitle}>{session.email}</Text>
          {session.country ? (
            <View style={styles.countryBadge}>
              <Text style={styles.countryText}>{session.country}</Text>
            </View>
          ) : null}
        </View>

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
              title="Estadísticas"
              subtitle="Consulta tu rendimiento"
              onPress={() => console.log('[PlayerArea] Stats pressed')}
            />
            <View style={styles.separator} />
            <MenuItem
              icon={<History size={20} color={Colors.golf.textLight} />}
              title="Historial de Partidas"
              subtitle="Revisa tus partidas anteriores"
              onPress={() => console.log('[PlayerArea] History pressed')}
            />
            <View style={styles.separator} />
            <MenuItem
              icon={<Award size={20} color={Colors.golf.accent} />}
              title="Logros"
              subtitle="Tus hitos y récords"
              onPress={() => console.log('[PlayerArea] Achievements pressed')}
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
              onPress={() => console.log('[PlayerArea] Settings pressed')}
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
  container: {
    flex: 1,
    backgroundColor: Colors.golf.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.golf.background,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.golf.textLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  profileCard: {
    backgroundColor: Colors.golf.headerBg,
    borderRadius: 18,
    paddingVertical: 28,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarContainer: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: Colors.golf.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  profileSubtitle: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: 'rgba(255,255,255,0.65)',
  },
  countryBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 10,
  },
  countryText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  menuIconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.golf.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.golf.text,
    marginBottom: 1,
  },
  menuSubtitle: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: Colors.golf.textLight,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.golf.border,
    marginLeft: 64,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
    marginBottom: 20,
  },
  logoutText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.golf.error,
  },
});
