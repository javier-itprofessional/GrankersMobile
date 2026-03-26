import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { CheckCircle, Cloud, CloudOff } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useCompetition } from '../../providers/CompetitionProvider';
import { useFreePlay } from '../../providers/FreePlayProvider';
import { useState, useEffect } from 'react';
import ConnectionStatus from '../../components/ConnectionStatus';

export default function CompleteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const isCompetitionMode = params.mode === 'competition';
  
  const { 
    leaderboard: compLeaderboard, 
    resetCompetition, 
    finishCompetition, 
    isOnline: compIsOnline 
  } = useCompetition();
  const { 
    leaderboard: freeLeaderboard, 
    resetFreePlay 
  } = useFreePlay();
  
  const leaderboard = isCompetitionMode ? compLeaderboard : freeLeaderboard;
  const resetGame = isCompetitionMode ? resetCompetition : resetFreePlay;
  const isOnline = isCompetitionMode ? compIsOnline : true;
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  const completedGames = leaderboard.filter((entry) => entry.holesCompleted === 18).length;

  useEffect(() => {
    if (isCompetitionMode) {
      const sync = async () => {
        setIsSyncing(true);
        try {
          await finishCompetition();
        } catch (error) {
          console.error('Error finishing competition:', error);
        } finally {
          setIsSyncing(false);
        }
      };
      sync();
    }
  }, [isCompetitionMode, finishCompetition]);

  const handleFinish = () => {
    resetGame();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Tarjeta Firmada',
          headerStyle: { backgroundColor: Colors.golf.headerBg },
          headerTintColor: '#FFFFFF',
        }}
      />

      {isCompetitionMode && <ConnectionStatus isOnline={isOnline} />}

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <CheckCircle size={80} color={Colors.golf.success} strokeWidth={2} />
          </View>
          <Text style={styles.title}>¡Tarjeta Firmada!</Text>
          <Text style={styles.subtitle}>
            Has completado tu ronda. Aquí está tu clasificación final.
          </Text>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{completedGames}</Text>
            <Text style={styles.statLabel}>Partidas Completadas</Text>
          </View>
          {isSyncing && (
            <View style={styles.syncStatus}>
              <ActivityIndicator size="small" color={Colors.golf.primary} />
              <Text style={styles.syncText}>Sincronizando resultados...</Text>
            </View>
          )}
          {!isSyncing && (
            <View style={styles.syncStatus}>
              {isOnline ? (
                <>
                  <Cloud size={20} color={Colors.golf.success} />
                  <Text style={[styles.syncText, { color: Colors.golf.success }]}>
                    Resultados sincronizados
                  </Text>
                </>
              ) : (
                <>
                  <CloudOff size={20} color={Colors.golf.textLight} />
                  <Text style={styles.syncText}>
                    Se sincronizará cuando haya conexión
                  </Text>
                </>
              )}
            </View>
          )}
        </View>

        <View style={styles.leaderboardCard}>
          <Text style={styles.leaderboardTitle}>Clasificación Final</Text>
          {leaderboard.map((entry, index) => (
            <View key={entry.player.id} style={styles.playerRow}>
              <View style={styles.playerPosition}>
                <Text style={styles.positionText}>{index + 1}</Text>
              </View>
              <Text style={styles.playerName}>
                {entry.player.nombre} {entry.player.apellido}
              </Text>
              <Text
                style={[
                  styles.playerScore,
                  entry.score > 0 ? styles.playerScoreOver : styles.playerScoreUnder,
                ]}
              >
                {entry.score > 0 ? '+' : ''}
                {entry.score}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.finishButton}
          onPress={handleFinish}
          testID="finish-button"
        >
          <Text style={styles.finishButtonText}>Terminar</Text>
        </TouchableOpacity>
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
    gap: 24,
  },
  header: {
    alignItems: 'center',
    gap: 16,
    marginTop: 20,
  },
  iconContainer: {
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.golf.success,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.golf.textLight,
    textAlign: 'center',
    lineHeight: 22,
  },
  statsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
    gap: 8,
  },
  statValue: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  leaderboardCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  leaderboardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    marginBottom: 8,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  playerPosition: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.golf.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  playerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.text,
  },
  playerScore: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  playerScoreOver: {
    color: Colors.golf.error,
  },
  playerScoreUnder: {
    color: Colors.golf.success,
  },
  finishButton: {
    backgroundColor: Colors.golf.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 'auto',
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  finishButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  syncStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8ECF4',
  },
  syncText: {
    fontSize: 14,
    color: Colors.golf.textLight,
  },
});
