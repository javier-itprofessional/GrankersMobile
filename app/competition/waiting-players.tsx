import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Modal } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Users, Check, WifiOff, Square, CheckSquare, UserCheck, UsersRound } from 'lucide-react-native';
import { useState, useEffect, useMemo } from 'react';
import Colors from '../../constants/colors';
import { subscribeToCompetitionPlayers, updatePlayerConnectionStatus } from '@/services/game-service';
import { useCompetition } from '@/providers/CompetitionProvider';

interface PlayerStatus {
  id: string;
  nombre: string;
  apellido: string;
  deviceId?: string;
  estado?: string;
}

export default function CompetitionWaitingPlayersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ competitionData?: string; myPlayerId?: string }>();
  const { competition, currentDevicePlayerId } = useCompetition();

  const competitionData = useMemo(() => 
    params.competitionData ? JSON.parse(params.competitionData) : competition,
    [params.competitionData, competition]
  );
  const codigoGrupo = competitionData?.codigo_grupo || '';
  const players = useMemo(() => competitionData?.jugadores || [], [competitionData]);
  const myPlayerId = params.myPlayerId || currentDevicePlayerId || null;

  const [playersStatus, setPlayersStatus] = useState<PlayerStatus[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [offlinePlayers, setOfflinePlayers] = useState<Set<number>>(new Set());
  const [showScoringModeModal, setShowScoringModeModal] = useState(false);
  const { setScoringModeAndPlayers } = useCompetition();

  useEffect(() => {
    const timer = setTimeout(() => {
      console.log('[CompetitionWaiting] Screen ready, can now navigate when all connected');
      setIsReady(true);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!codigoGrupo) {
      console.log('[CompetitionWaiting] Missing competition code');
      return;
    }

    console.log('[CompetitionWaiting] Subscribing to players for code:', codigoGrupo);

    const unsubscribe = subscribeToCompetitionPlayers(codigoGrupo, players, (playersList) => {
      console.log('[CompetitionWaiting] Players data received:', playersList);
      setPlayersStatus(playersList);

      setOfflinePlayers(prev => {
        const newSet = new Set(prev);
        playersList.forEach((player, idx) => {
          if (player.deviceId && newSet.has(idx)) {
            newSet.delete(idx);
          }
        });
        return newSet;
      });
    });

    return () => {
      console.log('[CompetitionWaiting] Unsubscribing from WebSocket listener');
      unsubscribe();
    };
  }, [codigoGrupo, players]);

  useEffect(() => {
    const effectiveConnected = playersStatus.filter((p, idx) => p.deviceId || offlinePlayers.has(idx)).length;
    
    if (effectiveConnected === playersStatus.length && playersStatus.length > 0 && isReady) {
      const connectedPlayers = playersStatus.filter((p) => !!p.deviceId);
      const offlineCount = offlinePlayers.size;
      
      if (connectedPlayers.length === 1 && offlineCount > 0 && playersStatus.length > 1) {
        console.log('[CompetitionWaiting] Only 1 player connected, rest offline. Showing scoring mode modal.');
        setShowScoringModeModal(true);
      } else if (offlineCount === 0 && connectedPlayers.length === playersStatus.length && myPlayerId) {
        console.log('[CompetitionWaiting] All players online! Setting circular partial scoring.');
        const myIndex = playersStatus.findIndex(p => p.id === myPlayerId);
        if (myIndex !== -1) {
          const nextIndex = (myIndex + 1) % playersStatus.length;
          const ids = [myPlayerId, playersStatus[nextIndex].id];
          console.log('[CompetitionWaiting] Circular assignment: I am', myPlayerId, '-> marking', playersStatus[nextIndex].id);
          setScoringModeAndPlayers('partial', ids);
        } else {
          console.log('[CompetitionWaiting] Could not find my player, falling back to all');
          setScoringModeAndPlayers('all', playersStatus.map(p => p.id));
        }
        setTimeout(() => {
          router.replace('/game/scoring');
        }, 500);
      } else {
        console.log('[CompetitionWaiting] Mixed state, navigating with all players...');
        setScoringModeAndPlayers('all', playersStatus.map(p => p.id));
        setTimeout(() => {
          router.replace('/game/scoring');
        }, 500);
      }
    }
  }, [playersStatus, offlinePlayers, isReady, router, setScoringModeAndPlayers]);

  const toggleOfflinePlayer = async (index: number) => {
    const player = playersStatus[index];
    if (player.deviceId) return;
    
    const isCurrentlyOffline = offlinePlayers.has(index);
    const newStatus = isCurrentlyOffline ? null : 'offline';
    
    setOfflinePlayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      console.log('[CompetitionWaiting] Toggled offline for player', index, '- now offline:', newSet.has(index));
      return newSet;
    });

    if (codigoGrupo && player.id) {
      try {
        if (newStatus === 'offline') {
          await updatePlayerConnectionStatus(codigoGrupo, player.id, 'offline');
          console.log('[CompetitionWaiting] Player', player.id, 'marked as offline in Firebase');
        }
      } catch (error) {
        console.error('[CompetitionWaiting] Error updating player status:', error);
      }
    }
  };

  const effectiveConnectedCount = playersStatus.filter((p, idx) => p.deviceId || offlinePlayers.has(idx)).length;

  const handleScoringModeAll = () => {
    console.log('[CompetitionWaiting] User chose to score ALL players');
    setScoringModeAndPlayers('all', playersStatus.map(p => p.id));
    setShowScoringModeModal(false);
    setTimeout(() => {
      router.replace('/game/scoring');
    }, 300);
  };

  const handleScoringModePartial = () => {
    console.log('[CompetitionWaiting] User chose PARTIAL scoring (self + next)');
    const myIndex = playersStatus.findIndex(p => p.id === myPlayerId);
    const nextIndex = (myIndex + 1) % playersStatus.length;
    const ids = [playersStatus[myIndex].id, playersStatus[nextIndex].id];
    console.log('[CompetitionWaiting] Visible player IDs:', ids);
    setScoringModeAndPlayers('partial', ids);
    setShowScoringModeModal(false);
    setTimeout(() => {
      router.replace('/game/scoring');
    }, 300);
  };

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
          La competición comenzará cuando todos los jugadores estén conectados
        </Text>

        <View style={styles.counterContainer}>
          <Text style={styles.counterText}>
            {effectiveConnectedCount} / {playersStatus.length || players.length}
          </Text>
          <Text style={styles.counterLabel}>jugadores conectados</Text>
        </View>

        <View style={styles.playersListContainer}>
          {playersStatus.map((player, index) => {
            const isOffline = offlinePlayers.has(index);
            const isConnected = !!player.deviceId;
            
            return (
              <View key={player.id} style={[styles.playerRow, player.id === myPlayerId && styles.playerRowHighlighted]}>
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
                  (isConnected || isOffline) && styles.playerNameConnected,
                  player.id === myPlayerId && styles.playerNameHighlighted,
                ]}>
                  {player.nombre} {player.apellido}{player.id === myPlayerId ? ' (Tú)' : ''}
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

      <Modal
        visible={showScoringModeModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconContainer}>
              <UserCheck size={40} color={Colors.golf.primary} />
            </View>
            <Text style={styles.modalTitle}>Eres el único jugador conectado</Text>
            <Text style={styles.modalDescription}>
              ¿Vas a llevar la puntuación de todos los jugadores del grupo o solo la tuya y la del siguiente jugador?
            </Text>

            <TouchableOpacity
              style={styles.modalOptionAll}
              onPress={handleScoringModeAll}
              testID="scoring-mode-all"
            >
              <UsersRound size={22} color="#FFFFFF" />
              <Text style={styles.modalOptionAllText}>Todos los jugadores</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalOptionPartial}
              onPress={handleScoringModePartial}
              testID="scoring-mode-partial"
            >
              <UserCheck size={22} color={Colors.golf.primary} />
              <Text style={styles.modalOptionPartialText}>Solo el que me corresponde</Text>
            </TouchableOpacity>
          </View>
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
  statusOffline: {
    backgroundColor: Colors.golf.warning,
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
  playerStatusConnected: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.golf.success,
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
  playerRowHighlighted: {
    borderWidth: 2,
    borderColor: Colors.golf.primary,
    backgroundColor: `${Colors.golf.primary}08`,
  },
  playerNameHighlighted: {
    color: Colors.golf.primary,
    fontWeight: '700' as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
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
  },
  modalIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: `${Colors.golf.primary}15`,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 15,
    color: Colors.golf.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  modalOptionAll: {
    width: '100%',
    backgroundColor: Colors.golf.primary,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modalOptionAllText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  modalOptionPartial: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: Colors.golf.primary,
  },
  modalOptionPartialText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
  },
});
