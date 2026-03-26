import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, ActivityIndicator } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { UserCheck } from 'lucide-react-native';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import * as Application from 'expo-application';
import Colors from '../../constants/colors';
import { useCompetition } from '../../providers/CompetitionProvider';
import { linkDeviceToCompetitionPlayer, subscribeToCompetitionPlayers } from '@/config/firebase';

export default function CompetitionSelectPlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ competitionData?: string }>();
  const [deviceId, setDeviceId] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [unassignedPlayers, setUnassignedPlayers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const { competition, setDevicePlayerId } = useCompetition();
  const autoSelectRef = useRef<string | null>(null);
  const [isAutoAssigning, setIsAutoAssigning] = useState<boolean>(false);

  const competitionData = useMemo(() => 
    params.competitionData ? JSON.parse(params.competitionData) : competition,
    [params.competitionData, competition]
  );
  const players = useMemo(() => competitionData?.jugadores || [], [competitionData]);
  const codigoGrupo = competitionData?.codigo_grupo || '';

  const handleSelectPlayer = useCallback(async (playerId: string, providedDeviceId?: string) => {
    const effectiveDeviceId = providedDeviceId || deviceId;
    if (!effectiveDeviceId) {
      console.error('[CompetitionSelectPlayer] ❌ No deviceId available');
      Alert.alert(
        'Error', 
        'No se pudo obtener el ID del dispositivo. Por favor, reinicia la aplicación.',
        [{ text: 'OK', onPress: () => router.back() }]
      );
      return;
    }

    if (!codigoGrupo) {
      Alert.alert('Error', 'Faltan datos necesarios para vincular el dispositivo');
      return;
    }

    console.log('[CompetitionSelectPlayer] Selected player:', playerId);
    console.log('[CompetitionSelectPlayer] Device ID:', effectiveDeviceId);
    
    setIsLinking(true);
    
    try {
      await linkDeviceToCompetitionPlayer(codigoGrupo, playerId, effectiveDeviceId);
      
      console.log('[CompetitionSelectPlayer] ✅ Device linked successfully to player');
      
      await setDevicePlayerId(playerId);
      
      setTimeout(() => {
        console.log('[CompetitionSelectPlayer] Navigating to waiting screen...');
        router.replace({
          pathname: '/competition/waiting-players',
          params: { competitionData: JSON.stringify(competitionData) },
        });
      }, 150);
    } catch (error) {
      console.error('[CompetitionSelectPlayer] ❌ Error linking device:', error);
      Alert.alert(
        'Error',
        'No se pudo vincular el dispositivo. ¿Deseas continuar sin vincular?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Continuar',
            onPress: async () => {
              await setDevicePlayerId(playerId);
              setTimeout(() => {
                router.replace({
                  pathname: '/competition/waiting-players',
                  params: { competitionData: JSON.stringify(competitionData) },
                });
              }, 150);
            },
          },
        ]
      );
    } finally {
      setIsLinking(false);
    }
  }, [deviceId, codigoGrupo, competitionData, setDevicePlayerId, router]);

  useEffect(() => {
    if (autoSelectRef.current && deviceId) {
      const playerId = autoSelectRef.current;
      autoSelectRef.current = null;
      handleSelectPlayer(playerId, deviceId);
    }
  }, [deviceId, handleSelectPlayer]);

  useEffect(() => {
    const initDevice = async () => {
      try {
        let currentDeviceId: string;
        if (Platform.OS === 'web') {
          let webDeviceId = localStorage.getItem('deviceId');
          if (!webDeviceId) {
            webDeviceId = `web-${Date.now()}-${Math.random()}`;
            localStorage.setItem('deviceId', webDeviceId);
          }
          currentDeviceId = webDeviceId;
          console.log('[CompetitionSelectPlayer] Web Device ID:', webDeviceId);
        } else {
          try {
            if (Platform.OS === 'android') {
              const androidId = await Application.getAndroidId();
              currentDeviceId = androidId || `android-${Date.now()}-${Math.random()}`;
            } else if (Platform.OS === 'ios') {
              const iosId = await Application.getIosIdForVendorAsync();
              currentDeviceId = iosId || `ios-${Date.now()}-${Math.random()}`;
            } else {
              currentDeviceId = `native-${Date.now()}-${Math.random()}`;
            }
          } catch (nativeError) {
            console.log('[CompetitionSelectPlayer] Native ID fetch failed:', nativeError);
            currentDeviceId = `native-${Date.now()}-${Math.random()}`;
          }
        }
        console.log('[CompetitionSelectPlayer] Final Device ID:', currentDeviceId);
        setDeviceId(currentDeviceId);
      } catch (error) {
        console.error('[CompetitionSelectPlayer] Error getting device ID:', error);
        const fallbackId = `fallback-${Date.now()}-${Math.random()}`;
        setDeviceId(fallbackId);
      }
    };
    initDevice();
  }, []);

  useEffect(() => {
    if (!codigoGrupo) {
      console.log('[CompetitionSelectPlayer] Missing competition code');
      setUnassignedPlayers(players);
      setIsLoading(false);
      return;
    }

    console.log('[CompetitionSelectPlayer] Subscribing to real-time player updates for code:', codigoGrupo);

    const unsubscribe = subscribeToCompetitionPlayers(codigoGrupo, (data) => {
      console.log('[CompetitionSelectPlayer] Real-time update received:', data);

      const unassigned: any[] = [];

      players.forEach((player: any) => {
        const fbPlayer = data[player.id];
        const hasDevice = fbPlayer?.deviceId;
        const isOffline = fbPlayer?.estado === 'offline';
        if (!hasDevice && !isOffline) {
          unassigned.push(player);
          console.log(`[CompetitionSelectPlayer] Player ${player.id} is unassigned and online`);
        } else {
          console.log(`[CompetitionSelectPlayer] Player ${player.id} excluded (deviceId: ${hasDevice}, offline: ${isOffline})`);
        }
      });

      console.log('[CompetitionSelectPlayer] Unassigned players:', unassigned.length);
      setUnassignedPlayers(unassigned);

      if (unassigned.length === 1 && !autoSelectRef.current && !isLinking) {
        const playerId = unassigned[0].id;
        console.log('[CompetitionSelectPlayer] Only one player left, auto-assigning:', playerId);
        setIsAutoAssigning(true);
        autoSelectRef.current = playerId;
        if (deviceId) {
          console.log('[CompetitionSelectPlayer] DeviceId already available, selecting now');
          handleSelectPlayer(playerId, deviceId);
        }
      } else if (unassigned.length === 0 && !autoSelectRef.current && !isAutoAssigning && !isLinking) {
        Alert.alert(
          'Sin jugadores disponibles',
          'Todos los jugadores ya tienen un dispositivo asignado o están offline.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }

      setIsLoading(false);
    });

    return () => {
      console.log('[CompetitionSelectPlayer] Unsubscribing from real-time listener');
      unsubscribe();
    };
  }, [codigoGrupo, players, router, deviceId, isLinking, handleSelectPlayer]);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Seleccionar Jugador',
          headerStyle: { backgroundColor: Colors.golf.headerBg },
          headerTintColor: '#FFFFFF',
        }}
      />

      {isLoading || isAutoAssigning ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.golf.primary} />
          <Text style={styles.loadingText}>
            {isAutoAssigning ? 'Asignando jugador automáticamente...' : 'Cargando jugadores...'}
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <UserCheck size={56} color={Colors.golf.primary} />
            <Text style={styles.title}>¿Quién eres?</Text>
            <Text style={styles.subtitle}>
              Selecciona tu nombre de la lista para vincular este dispositivo a tu jugador.
            </Text>
            {unassignedPlayers.length < players.length && (
              <Text style={styles.infoText}>
                Mostrando solo jugadores sin dispositivo asignado
              </Text>
            )}
          </View>

          <View style={styles.playersContainer}>
            {unassignedPlayers.map((player: { id: string; nombre: string; apellido: string; handicap?: number }) => (
              <TouchableOpacity
                key={player.id}
                style={[styles.playerButton, isLinking && styles.playerButtonDisabled]}
                onPress={() => handleSelectPlayer(player.id)}
                disabled={isLinking}
                testID={`select-player-${player.id}`}
              >
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>
                    {player.nombre} {player.apellido}
                  </Text>
                  {player.handicap !== undefined && (
                    <Text style={styles.playerHandicap}>
                      Handicap: {player.handicap}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {isLinking && (
            <View style={styles.linkingContainer}>
              <ActivityIndicator size="small" color={Colors.golf.primary} />
              <Text style={styles.linkingText}>Vinculando dispositivo...</Text>
            </View>
          )}
        </ScrollView>
      )}
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
    gap: 32,
  },
  header: {
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.golf.textLight,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 320,
  },
  playersContainer: {
    gap: 16,
  },
  playerButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 2,
    borderColor: Colors.golf.primary,
  },
  playerInfo: {
    alignItems: 'center',
    gap: 8,
  },
  playerName: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  playerHandicap: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
  },
  playerButtonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
  },
  infoText: {
    fontSize: 14,
    color: Colors.golf.primary,
    textAlign: 'center',
    fontWeight: '600' as const,
    marginTop: 8,
  },
  linkingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
  },
  linkingText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.golf.textLight,
  },
});
