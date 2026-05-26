import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useState } from 'react';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { CheckCircle, WifiOff, Clock } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { FontFamily } from '../../constants/Typography';
import { useFreePlay } from '../../providers/FreePlayProvider';

type PlayerStatus = 'ready' | 'waiting' | 'offline';

type WaitingPlayer = {
  id: string;
  firstName: string;
  lastName: string;
  handicap?: string;
  license?: string;
  status: PlayerStatus;
};

export default function WaitingPlayersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    players?: string;
    sessionUuid?: string;
    devicePlayerId?: string;
    courseName?: string;
    routeName?: string;
    gameName?: string;
    isPrivate?: string;
    gamePassword?: string;
  }>();
  const { startFreePlay, setDevicePlayer } = useFreePlay();
  const [isStarting, setIsStarting] = useState(false);

  const devicePlayerId = params.devicePlayerId ?? '1';

  const [players, setPlayers] = useState<WaitingPlayer[]>(() => {
    const raw: { id: string; firstName: string; lastName: string; handicap?: string; license?: string }[] =
      params.players ? JSON.parse(params.players) : [];
    return raw.map((p) => ({
      ...p,
      status: p.id === devicePlayerId ? 'ready' : 'waiting',
    }));
  });

  const allReady = players.every((p) => p.status !== 'waiting');

  const setStatus = (id: string, status: 'ready' | 'offline') => {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
  };

  const handleStart = async () => {
    setIsStarting(true);
    try {
      const playersForGame = players.map((p) => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        license: p.license,
        handicap: p.handicap ? parseFloat(p.handicap) : 0,
        isDevice: p.id === devicePlayerId,
      }));
      await startFreePlay(playersForGame, params.sessionUuid || undefined, {
        isPrivate: params.isPrivate === '1',
        password: params.gamePassword || undefined,
      });
      setDevicePlayer(devicePlayerId);
      setTimeout(() => router.replace('/game/scoring'), 150);
    } catch {
      setIsStarting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Jugadores',
          headerStyle: { backgroundColor: Colors.golf.headerBg },
          headerTintColor: '#FFFFFF',
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.title}>Confirmar jugadores</Text>
        <Text style={styles.subtitle}>
          Marca como preparado a los jugadores que están listos, u offline si jugarán sin el móvil.
        </Text>

        <View style={styles.playerList}>
          {players.map((player) => (
            <View key={player.id} style={styles.playerCard}>
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>
                  {player.firstName} {player.lastName}
                </Text>
                {player.handicap ? (
                  <Text style={styles.playerHandicap}>Hcp {player.handicap}</Text>
                ) : null}
              </View>

              {player.status === 'ready' && (
                <View style={styles.statusBadge}>
                  <CheckCircle size={15} color="#16a34a" />
                  <Text style={[styles.statusText, styles.statusReady]}>Preparado</Text>
                </View>
              )}

              {player.status === 'offline' && (
                <View style={[styles.statusBadge, styles.statusBadgeOffline]}>
                  <WifiOff size={15} color="#6b7280" />
                  <Text style={[styles.statusText, styles.statusOffline]}>Offline</Text>
                </View>
              )}

              {player.status === 'waiting' && (
                <View style={styles.waitingRow}>
                  <View style={[styles.statusBadge, styles.statusBadgeWaiting]}>
                    <Clock size={15} color="#d97706" />
                    <Text style={[styles.statusText, styles.statusWaiting]}>Esperando</Text>
                  </View>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.btnReady}
                      onPress={() => setStatus(player.id, 'ready')}
                    >
                      <CheckCircle size={14} color="#16a34a" />
                      <Text style={styles.btnReadyText}>Preparado</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.btnOffline}
                      onPress={() => setStatus(player.id, 'offline')}
                    >
                      <WifiOff size={14} color="#6b7280" />
                      <Text style={styles.btnOfflineText}>Offline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.startButton, (!allReady || isStarting) && styles.startButtonDisabled]}
          onPress={handleStart}
          disabled={!allReady || isStarting}
        >
          {isStarting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.startButtonText}>Empezar partida</Text>
          )}
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontFamily: FontFamily.headingSemi,
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 14,
    color: Colors.golf.textLight,
    lineHeight: 20,
    marginBottom: 8,
  },
  playerList: {
    gap: 12,
  },
  playerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerName: {
    fontFamily: FontFamily.bodySemi,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.text,
  },
  playerHandicap: {
    fontFamily: FontFamily.body,
    fontSize: 13,
    color: Colors.golf.textLight,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(22,163,74,0.1)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  statusBadgeWaiting: {
    backgroundColor: 'rgba(217,119,6,0.1)',
  },
  statusBadgeOffline: {
    backgroundColor: 'rgba(107,114,128,0.1)',
  },
  statusText: {
    fontFamily: FontFamily.bodySemi,
    fontSize: 13,
    fontWeight: '600' as const,
  },
  statusReady: {
    color: '#16a34a',
  },
  statusWaiting: {
    color: '#d97706',
  },
  statusOffline: {
    color: '#6b7280',
  },
  waitingRow: {
    gap: 10,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  btnReady: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#16a34a',
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnReadyText: {
    fontFamily: FontFamily.bodySemi,
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#16a34a',
  },
  btnOffline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: '#9ca3af',
    borderRadius: 10,
    paddingVertical: 10,
  },
  btnOfflineText: {
    fontFamily: FontFamily.bodySemi,
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#6b7280',
  },
  startButton: {
    backgroundColor: Colors.golf.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  startButtonDisabled: {
    backgroundColor: Colors.golf.textLight,
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  startButtonText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
