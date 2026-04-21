import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Users, Check, WifiOff, Square, CheckSquare } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import Colors from '../../constants/colors';
import { wsClient } from '@/services/websocket';
import { useFreePlay } from '@/providers/FreePlayProvider';

interface PlayerStatus {
  nombre: string;
  apellido: string;
  deviceId?: string;
}

export default function WaitingPlayersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    courseName?: string;
    routeName?: string;
    gameName?: string;
    groupName?: string;
    totalPlayers?: string;
  }>();

  const [playersStatus, setPlayersStatus] = useState<PlayerStatus[]>([]);
  const [, setConnectedCount] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [offlinePlayers, setOfflinePlayers] = useState<Set<number>>(new Set());
  const totalPlayers = params.totalPlayers ? parseInt(params.totalPlayers, 10) : 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('[WaitingPlayers] Screen ready, can now navigate when all connected');
      setIsReady(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const { players: freePlayPlayers, activeRoundId } = useFreePlay();

  // Initialize player list from FreePlayProvider
  useEffect(() => {
    if (freePlayPlayers.length > 0) {
      const list: PlayerStatus[] = freePlayPlayers.map((p) => ({
        nombre: p.nombre,
        apellido: p.apellido,
        deviceId: p.isDevice ? 'local' : undefined,
      }));
      setPlayersStatus(list);
      setConnectedCount(list.filter((p) => p.deviceId).length);
    }
  }, [freePlayPlayers]);

  // Listen for player_status_changed events via WebSocket
  useEffect(() => {
    if (!activeRoundId) return;

    const unsubscribe = wsClient.on('player_status_changed', (payload) => {
      setPlayersStatus((prev) => {
        const updated = prev.map((p, idx) => {
          if (payload.player_id === String(idx)) {
            return { ...p, deviceId: payload.status === 'conectado' ? payload.player_id : undefined };
          }
          return p;
        });
        setConnectedCount(updated.filter((p) => p.deviceId).length);
        return updated;
      });
    });

    return unsubscribe;
  }, [activeRoundId]);

  useEffect(() => {
    const effectiveConnected = playersStatus.filter((p, idx) => p.deviceId || offlinePlayers.has(idx)).length;
    
    if (effectiveConnected === playersStatus.length && playersStatus.length > 0 && isReady) {
      console.log('[WaitingPlayers] All players connected or marked offline! Navigating to scoring...');
      setTimeout(() => {
        router.replace('/game/scoring');
      }, 500);
    }
  }, [playersStatus, offlinePlayers, isReady, router]);

  const toggleOfflinePlayer = (index: number) => {
    if (playersStatus[index].deviceId) return;
    
    setOfflinePlayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      console.log('[WaitingPlayers] Toggled offline for player', index, '- now offline:', newSet.has(index));
      return newSet;
    });
  };

  const effectiveConnectedCount = playersStatus.filter((p, idx) => p.deviceId || offlinePlayers.has(idx)).length;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Esperando Jugadores',
          headerStyle: { backgroundColor: Colors.golf.headerBg },
          headerTintColor: '#FFFFFF',
          headerBackVisible: false,
          gestureEnabled: false,
        }}
      />

      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Users size={64} color={Colors.golf.primary} />
        </View>

        <Text style={styles.title}>Esperando al resto de jugadores</Text>
        <Text style={styles.subtitle}>
          La partida comenzará cuando todos los jugadores estén conectados
        </Text>

        <View style={styles.counterContainer}>
          <Text style={styles.counterText}>
            {effectiveConnectedCount} / {playersStatus.length || totalPlayers}
          </Text>
          <Text style={styles.counterLabel}>jugadores conectados</Text>
        </View>

        <View style={styles.playersListContainer}>
          {playersStatus.map((player, index) => {
            const isOffline = offlinePlayers.has(index);
            const isConnected = !!player.deviceId;
            
            return (
              <View key={index} style={styles.playerRow}>
                <View style={[
                  styles.statusIndicator,
                  isConnected ? styles.statusConnected : (isOffline ? styles.statusOffline : styles.statusWaiting)
                ]}>
                  {isConnected ? (
                    <Check size={14} color="#FFFFFF" />
                  ) : isOffline ? (
                    <WifiOff size={14} color="#FFFFFF" />
                  ) : (
                    <ActivityIndicator size="small" color={Colors.golf.textLight} />
                  )}
                </View>
                <Text style={[
                  styles.playerName,
                  (isConnected || isOffline) && styles.playerNameConnected
                ]}>
                  {player.nombre} {player.apellido}
                </Text>
                
                {!isConnected && (
                  <TouchableOpacity
                    style={styles.offlineCheckbox}
                    onPress={() => toggleOfflinePlayer(index)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {isOffline ? (
                      <CheckSquare size={22} color={Colors.golf.warning} />
                    ) : (
                      <Square size={22} color={Colors.golf.textLight} />
                    )}
                    <Text style={[styles.offlineLabel, isOffline && styles.offlineLabelActive]}>
                      Offline
                    </Text>
                  </TouchableOpacity>
                )}
                
                {isConnected && (
                  <Text style={styles.playerStatusConnected}>
                    Conectado
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {effectiveConnectedCount < playersStatus.length && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.golf.primary} />
            <Text style={styles.offlineHint}>
              Marca como Offline a los jugadores que no se conectarán
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.golf.background,
  },
  content: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: `${Colors.golf.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.golf.textLight,
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
    marginBottom: 32,
  },
  counterContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  counterText: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
  },
  counterLabel: {
    fontSize: 14,
    color: Colors.golf.textLight,
    marginTop: 4,
  },
  playersListContainer: {
    width: '100%',
    gap: 12,
    marginBottom: 32,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statusIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusConnected: {
    backgroundColor: Colors.golf.success,
  },
  statusWaiting: {
    backgroundColor: '#F0F0F0',
  },
  playerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
  },
  playerNameConnected: {
    color: Colors.golf.text,
  },
  playerStatus: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  playerStatusConnected: {
    color: Colors.golf.success,
  },
  playerStatusWaiting: {
    color: Colors.golf.textLight,
  },
  statusOffline: {
    backgroundColor: Colors.golf.warning,
  },
  offlineCheckbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  offlineLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.golf.textLight,
  },
  offlineLabelActive: {
    color: Colors.golf.warning,
  },
  loadingContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  offlineHint: {
    marginTop: 12,
    fontSize: 13,
    color: Colors.golf.textLight,
    textAlign: 'center',
    maxWidth: 280,
  },
});
