import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, ClipboardList, ChevronRight, Trophy, Clock, MapPin, Navigation } from 'lucide-react-native';
import { useQuery, useMutation } from '@tanstack/react-query';
import Colors from '@/constants/colors';
import { fetchProximaCompeticion, fetchCompetitionData, linkDeviceToCompetitionPlayer } from '@/services/game-service';
import * as Application from 'expo-application';
import { useCompetition } from '@/providers/CompetitionProvider';
import type { ProximaCompeticion } from '@/services/game-service';

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
      <ChevronRight size={20} color={Colors.golf.textLight} />
    </TouchableOpacity>
  );
}

function NextCompetitionCard({ data }: { data: ProximaCompeticion }) {
  const router = useRouter();
  const { startCompetition } = useCompetition();

  const { setDevicePlayerId } = useCompetition();

  const teeButtonMutation = useMutation({
    mutationFn: async () => {
      console.log('[Competitions] Estoy en el tee pressed');
      console.log('[Competitions] Loading competition with id_grupo:', data.id_grupo);

      const competitionData = await fetchCompetitionData(data.id_grupo);

      if (!competitionData) {
        throw new Error('No se encontró la competición');
      }

      const myLicencia = data.numero_licencia || data.id_jugador || '';
      console.log('[Competitions] My licencia (numero_licencia):', myLicencia);
      console.log('[Competitions] id_jugador fallback:', data.id_jugador);
      console.log('[Competitions] numero_licencia:', data.numero_licencia);

      const myPlayer = competitionData.jugadores.find(
        (j) => j.licencia && j.licencia.trim().toLowerCase() === myLicencia.trim().toLowerCase()
      );

      if (!myPlayer) {
        console.error('[Competitions] No player found matching licencia:', myLicencia);
        console.error('[Competitions] Available players and their licencias:', 
          competitionData.jugadores.map(j => ({ id: j.id, licencia: j.licencia }))
        );
        throw new Error('No se encontró tu jugador en la competición');
      }

      console.log('[Competitions] Found my player:', myPlayer.id, myPlayer.nombre, myPlayer.apellido);

      let deviceId: string;
      if (Platform.OS === 'web') {
        let webDeviceId = localStorage.getItem('deviceId');
        if (!webDeviceId) {
          webDeviceId = `web-${Date.now()}-${Math.random()}`;
          localStorage.setItem('deviceId', webDeviceId);
        }
        deviceId = webDeviceId;
      } else {
        try {
          if (Platform.OS === 'android') {
            const androidId = await Application.getAndroidId();
            deviceId = androidId || `android-${Date.now()}-${Math.random()}`;
          } else if (Platform.OS === 'ios') {
            const iosId = await Application.getIosIdForVendorAsync();
            deviceId = iosId || `ios-${Date.now()}-${Math.random()}`;
          } else {
            deviceId = `native-${Date.now()}-${Math.random()}`;
          }
        } catch {
          deviceId = `native-${Date.now()}-${Math.random()}`;
        }
      }

      console.log('[Competitions] Device ID:', deviceId);

      try {
        await linkDeviceToCompetitionPlayer(data.id_grupo, myPlayer.id, deviceId);
        console.log('[Competitions] Device linked to player successfully');
      } catch (linkError) {
        console.error('[Competitions] Error linking device, continuing anyway:', linkError);
      }

      await setDevicePlayerId(myPlayer.id);

      return { competitionData, myPlayerId: myPlayer.id };
    },
    onSuccess: ({ competitionData, myPlayerId }) => {
      console.log('[Competitions] Competition loaded, navigating to waiting-players');
      startCompetition(competitionData);

      router.push({
        pathname: '/competition/waiting-players',
        params: {
          competitionData: JSON.stringify(competitionData),
          myPlayerId,
        },
      });
    },
    onError: (error: Error) => {
      console.error('[Competitions] Error loading competition:', error);
      Alert.alert('Error', error.message || 'No se pudo cargar la competición');
    },
  });

  return (
    <View style={styles.nextCompCard}>
      <View style={styles.nextCompHeader}>
        <View style={styles.nextCompBadge}>
          <Trophy size={16} color="#FFFFFF" />
          <Text style={styles.nextCompBadgeText}>Próxima Prueba</Text>
        </View>
      </View>

      <Text style={styles.nextCompName}>{data.nombre_competicion}</Text>

      <View style={styles.nextCompDivider} />

      <View style={styles.nextCompInfoRow}>
        <MapPin size={16} color={Colors.golf.primary} />
        <Text style={styles.nextCompInfoLabel}>Prueba</Text>
        <Text style={styles.nextCompInfoValue}>{data.nombre_prueba}</Text>
      </View>

      <View style={styles.nextCompInfoRow}>
        <Calendar size={16} color={Colors.golf.primary} />
        <Text style={styles.nextCompInfoLabel}>Fecha</Text>
        <Text style={styles.nextCompInfoValue}>{data.fecha}</Text>
      </View>

      <View style={styles.nextCompInfoRow}>
        <Clock size={16} color={Colors.golf.primary} />
        <Text style={styles.nextCompInfoLabel}>Hora de salida</Text>
        <Text style={styles.nextCompInfoValue}>{data.hora_salida}</Text>
      </View>

      <TouchableOpacity
        style={[styles.teeButton, teeButtonMutation.isPending && styles.teeButtonDisabled]}
        onPress={() => teeButtonMutation.mutate()}
        disabled={teeButtonMutation.isPending}
        activeOpacity={0.8}
        testID="tee-button"
      >
        {teeButtonMutation.isPending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Navigation size={20} color="#FFFFFF" />
        )}
        <Text style={styles.teeButtonText}>
          {teeButtonMutation.isPending ? 'Cargando...' : 'Estoy en el Tee'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

export default function CompetitionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const proximaQuery = useQuery({
    queryKey: ['proxima-competicion'],
    queryFn: fetchProximaCompeticion,
  });

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Competiciones',
          headerStyle: { backgroundColor: Colors.golf.background },
          headerTintColor: Colors.golf.text,
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Menú</Text>
          <View style={styles.menuCard}>
            <MenuItem
              icon={<Calendar size={22} color={Colors.golf.success} />}
              title="Próximas Competiciones"
              subtitle="Competiciones disponibles próximamente"
              onPress={() => console.log('[Competitions] Proximas competiciones pressed')}
            />
            <View style={styles.separator} />
            <MenuItem
              icon={<ClipboardList size={22} color={Colors.golf.water} />}
              title="Competiciones Inscrito"
              subtitle="Competiciones en las que estás inscrito"
              onPress={() => console.log('[Competitions] Competiciones inscrito pressed')}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tu próxima prueba</Text>
          {proximaQuery.isLoading && (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={Colors.golf.primary} />
              <Text style={styles.loadingText}>Cargando información...</Text>
            </View>
          )}

          {proximaQuery.isError && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>No se pudo cargar la información</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => proximaQuery.refetch()}
              >
                <Text style={styles.retryButtonText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          )}

          {proximaQuery.isSuccess && proximaQuery.data && (
            <NextCompetitionCard data={proximaQuery.data} />
          )}

          {proximaQuery.isSuccess && !proximaQuery.data && (
            <View style={styles.emptyCard}>
              <Trophy size={40} color={Colors.golf.textLight} strokeWidth={1.2} />
              <Text style={styles.emptyText}>No tienes pruebas próximas</Text>
            </View>
          )}
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: Colors.golf.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.golf.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.text,
    marginBottom: 2,
  },
  menuSubtitle: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: Colors.golf.textLight,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.golf.border,
    marginLeft: 70,
  },
  nextCompCard: {
    backgroundColor: Colors.golf.card,
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  nextCompHeader: {
    flexDirection: 'row',
    marginBottom: 14,
  },
  nextCompBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.golf.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  nextCompBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  nextCompName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    marginBottom: 14,
  },
  nextCompDivider: {
    height: 1,
    backgroundColor: Colors.golf.border,
    marginBottom: 14,
  },
  nextCompInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  nextCompInfoLabel: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.golf.textLight,
    width: 100,
  },
  nextCompInfoValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.golf.text,
  },
  teeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.golf.primary,
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
    marginTop: 8,
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  teeButtonDisabled: {
    opacity: 0.7,
  },
  teeButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  loadingCard: {
    backgroundColor: Colors.golf.card,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.golf.textLight,
  },
  errorCard: {
    backgroundColor: Colors.golf.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.golf.error,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: Colors.golf.primary,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  emptyCard: {
    backgroundColor: Colors.golf.card,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.golf.textLight,
  },
});
