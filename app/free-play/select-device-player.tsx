import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { UserCheck } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import * as Application from 'expo-application';
import Colors from '../../constants/colors';
import { useFreePlay } from '../../providers/FreePlayProvider';
import { linkDeviceToPlayer, getActiveGamePlayers } from '@/services/game-service';

export default function SelectDevicePlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    players?: string;
    courseName?: string;
    routeName?: string;
    gameName?: string;
    groupName?: string;
  }>();
  const [deviceId, setDeviceId] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);
  const [unassignedPlayers, setUnassignedPlayers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [currentHole, setCurrentHole] = useState<number>(1);
  const { startFreePlay, setGameInfo, setDevicePlayer, goToHole } = useFreePlay();

  const players = params.players ? JSON.parse(params.players) : [];

  useEffect(() => {
    const initializeScreen = async () => {
      try {
        let currentDeviceId: string;
        if (Platform.OS === 'web') {
          let webDeviceId = localStorage.getItem('deviceId');
          if (!webDeviceId) {
            webDeviceId = `web-${Date.now()}-${Math.random()}`;
            localStorage.setItem('deviceId', webDeviceId);
          }
          currentDeviceId = webDeviceId;
          console.log('[SelectDevicePlayer] Web Device ID:', webDeviceId);
        } else {
          try {
            if (Platform.OS === 'android') {
              const androidId = await Application.getAndroidId();
              currentDeviceId = androidId || `android-${Date.now()}-${Math.random()}`;
              console.log('[SelectDevicePlayer] Android Device ID:', currentDeviceId);
            } else if (Platform.OS === 'ios') {
              const iosId = await Application.getIosIdForVendorAsync();
              currentDeviceId = iosId || `ios-${Date.now()}-${Math.random()}`;
              console.log('[SelectDevicePlayer] iOS Device ID:', currentDeviceId);
            } else {
              currentDeviceId = `native-${Date.now()}-${Math.random()}`;
              console.log('[SelectDevicePlayer] Unknown platform, using fallback:', currentDeviceId);
            }
          } catch (nativeError) {
            console.log('[SelectDevicePlayer] Native ID fetch failed, using fallback:', nativeError);
            currentDeviceId = `native-${Date.now()}-${Math.random()}`;
          }
        }
        console.log('[SelectDevicePlayer] Final Device ID:', currentDeviceId);
        setDeviceId(currentDeviceId);

        if (params.courseName && params.routeName && params.gameName && params.groupName) {
          await fetchUnassignedPlayers(currentDeviceId);
        } else {
          console.log('[SelectDevicePlayer] Missing game parameters');
          setUnassignedPlayers(players);
          setIsLoading(false);
        }
      } catch (error) {
        console.error('[SelectDevicePlayer] Error initializing:', error);
        const fallbackId = `fallback-${Date.now()}-${Math.random()}`;
        setDeviceId(fallbackId);
        setUnassignedPlayers(players);
        setIsLoading(false);
      }
    };
    
    initializeScreen();
  }, []);

  const fetchUnassignedPlayers = async (currentDeviceId: string) => {
    try {
      console.log('[SelectDevicePlayer] Fetching players with device assignments...');

      const gamePlayers = await getActiveGamePlayers(
        params.courseName ?? '',
        params.routeName ?? '',
        params.gameName ?? '',
        params.groupName ?? ''
      );

      if (!gamePlayers) {
        console.log('[SelectDevicePlayer] No players found in backend');
        setUnassignedPlayers(players);
        setIsLoading(false);
        return;
      }

      const unassigned: any[] = [];

      players.forEach((player: any, index: number) => {
        const playerKey = `jugador_${String(index + 1).padStart(2, '0')}`;
        const backendPlayer = gamePlayers[playerKey];

        if (!backendPlayer || !backendPlayer.deviceId) {
          unassigned.push(player);
        }
      });

      console.log('[SelectDevicePlayer] Unassigned players:', unassigned);
      setUnassignedPlayers(unassigned);

      if (unassigned.length === 1) {
        console.log('[SelectDevicePlayer] Only one player left, auto-assigning...');
        await handleSelectPlayer(unassigned[0].id, true, currentDeviceId);
      } else if (unassigned.length === 0) {
        Alert.alert(
          'Sin jugadores disponibles',
          'Todos los jugadores ya tienen un dispositivo asignado.',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      }
      
      setIsLoading(false);
    } catch (error) {
      console.error('[SelectDevicePlayer] Error fetching unassigned players:', error);
      setUnassignedPlayers(players);
      setIsLoading(false);
    }
  };

  const handleSelectPlayer = async (playerId: string, autoAssigned: boolean = false, providedDeviceId?: string) => {
    const effectiveDeviceId = providedDeviceId || deviceId;
    if (!effectiveDeviceId) {
      console.error('[SelectDevicePlayer] ❌ No deviceId available');
      Alert.alert(
        'Error', 
        'No se pudo obtener el ID del dispositivo. Por favor, reinicia la aplicación.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          }
        ]
      );
      return;
    }

    if (!params.courseName || !params.routeName || !params.gameName || !params.groupName) {
      Alert.alert('Error', 'Faltan datos necesarios para vincular el dispositivo');
      return;
    }

    console.log('[SelectDevicePlayer] Selected player:', playerId);
    console.log('[SelectDevicePlayer] Device ID:', effectiveDeviceId);
    
    const selectedPlayerIndex = players.findIndex((p: { id: string }) => p.id === playerId);
    const playerKey = `jugador_${String(selectedPlayerIndex + 1).padStart(2, '0')}`;
    
    console.log('[SelectDevicePlayer] Player Key:', playerKey);
    console.log('[SelectDevicePlayer] Linking to:', {
      courseName: params.courseName,
      routeName: params.routeName,
      gameName: params.gameName,
      groupName: params.groupName,
    });
    
    setIsLinking(true);
    
    try {
      await linkDeviceToPlayer(
        params.courseName,
        params.routeName,
        params.gameName,
        params.groupName,
        playerKey,
        effectiveDeviceId
      );
      
      console.log('[SelectDevicePlayer] ✅ Device linked successfully to player');
      
      setGameInfo(params.gameName, params.groupName);
      setDevicePlayer(playerId);
      
      const playersWithIds = players.map((p: { id: string; firstName: string; lastName: string; handicap: string; license?: string }) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        license: p.license,
        handicap: p.handicap ? parseFloat(p.handicap) : 0,
        isDevice: p.id === playerId,
      }));

      startFreePlay(playersWithIds);
      
      if (currentHole > 1) {
        console.log(`[SelectDevicePlayer] Setting hole to ${currentHole}`);
        goToHole(currentHole);
      }
      
      setTimeout(() => {
        console.log('[SelectDevicePlayer] Navigating to waiting screen...');
        router.replace({
          pathname: '/free-play/waiting-players',
          params: {
            courseName: params.courseName,
            routeName: params.routeName,
            gameName: params.gameName,
            groupName: params.groupName,
            totalPlayers: players.length.toString(),
          },
        });
      }, 150);
    } catch (error) {
      console.error('[SelectDevicePlayer] ❌ Error linking device:', error);
      Alert.alert(
        'Error',
        'No se pudo vincular el dispositivo. ¿Deseas continuar sin vincular?',
        [
          {
            text: 'Cancelar',
            style: 'cancel',
          },
          {
            text: 'Continuar',
            onPress: () => {
              const playersWithIds = players.map((p: { id: string; firstName: string; lastName: string; handicap: string; license?: string }) => ({
                id: p.id,
                firstName: p.firstName,
                lastName: p.lastName,
                license: p.license,
                handicap: p.handicap ? parseFloat(p.handicap) : 0,
                isDevice: p.id === playerId,
              }));
              
              startFreePlay(playersWithIds);
              
              if (currentHole > 1) {
                goToHole(currentHole);
              }
              
              setTimeout(() => {
                router.replace({
                  pathname: '/free-play/waiting-players',
                  params: {
                    courseName: params.courseName,
                    routeName: params.routeName,
                    gameName: params.gameName,
                    groupName: params.groupName,
                    totalPlayers: players.length.toString(),
                  },
                });
              }, 150);
            },
          },
        ]
      );
    } finally {
      setIsLinking(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Seleccionar Jugador',
          headerStyle: { backgroundColor: Colors.golf.headerBg },
          headerTintColor: '#FFFFFF',
        }}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando jugadores...</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <UserCheck size={56} color={Colors.golf.primary} />
            <Text style={styles.title}>¿Quién eres?</Text>
            <Text style={styles.subtitle}>
              Selecciona tu nombre de la lista. Tu tarjeta aparecerá resaltada durante la partida.
            </Text>
            {unassignedPlayers.length < players.length && (
              <Text style={styles.infoText}>
                Mostrando solo jugadores sin dispositivo asignado
              </Text>
            )}
          </View>

          <View style={styles.playersContainer}>
            {unassignedPlayers.map((player: { id: string; firstName: string; lastName: string; handicap?: string }) => (
              <TouchableOpacity
                key={player.id}
                style={[styles.playerButton, isLinking && styles.playerButtonDisabled]}
                onPress={() => handleSelectPlayer(player.id, false)}
                disabled={isLinking}
                testID={`select-player-${player.id}`}
              >
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>
                    {player.firstName} {player.lastName}
                  </Text>
                  {player.handicap && (
                    <Text style={styles.playerHandicap}>
                      Handicap: {player.handicap}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
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
});
