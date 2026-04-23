import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { Trophy, Medal } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useCompetition } from '../../providers/CompetitionProvider';
import { useFreePlay } from '../../providers/FreePlayProvider';

export default function LeaderboardScreen() {
  const router = useRouter();
  
  const { competition: competitionData, leaderboard: compLeaderboard } = useCompetition();
  const { players, gameStarted, leaderboard: freeLeaderboard } = useFreePlay();
  
  const isCompetitionMode = competitionData !== null;
  const isFreePlayMode = gameStarted;
  
  const competition = isCompetitionMode ? competitionData : (isFreePlayMode ? {
    groupCode: '',
    competitionName: 'Partida Libre',
    eventName: 'Partida Libre',
    players,
  } : null);
  
  const leaderboard = isCompetitionMode ? compLeaderboard : freeLeaderboard;

  if (!competition) {
    router.replace('/');
    return null;
  }

  const getPositionIcon = (position: number) => {
    if (position === 1) return <Trophy size={24} color="#FFD700" />;
    if (position === 2) return <Medal size={24} color="#C0C0C0" />;
    if (position === 3) return <Medal size={24} color="#CD7F32" />;
    return null;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Clasificación',
          headerStyle: { backgroundColor: Colors.golf.headerBg },
          headerTintColor: '#FFFFFF',
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Trophy size={48} color={Colors.golf.primary} />
          <Text style={styles.title}>{competition.eventName}</Text>
          <Text style={styles.subtitle}>{competition.competitionName}</Text>
        </View>

        <View style={styles.leaderboard}>
          {leaderboard.map((entry, index) => {
            const position = index + 1;
            const score = entry.score;
            const isLeader = position === 1;

            return (
              <TouchableOpacity
                key={entry.player.id}
                style={[styles.playerCard, isLeader && styles.playerCardLeader]}
                onPress={() => router.push({
                  pathname: '/game/scorecard',
                  params: { playerId: entry.player.id }
                })}
                activeOpacity={0.7}
              >
                <View style={styles.playerRank}>
                  {getPositionIcon(position) || (
                    <Text style={styles.positionNumber}>{position}</Text>
                  )}
                </View>

                <View style={styles.playerInfo}>
                  <Text style={[styles.playerName, isLeader && styles.playerNameLeader]}>
                    {entry.player.firstName} {entry.player.lastName}
                  </Text>
                  <Text style={styles.holesCompleted}>
                    {entry.holesCompleted} de 18 hoyos
                  </Text>
                </View>

                <View style={styles.scoreInfo}>
                  <Text
                    style={[
                      styles.scoreValue,
                      isLeader && styles.scoreValueLeader,
                      score > 0 ? styles.scoreValueOver : styles.scoreValueUnder,
                    ]}
                  >
                    {score > 0 ? '+' : ''}
                    {score}
                  </Text>
                  <Text style={styles.totalScore}>{entry.totalScore}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {leaderboard.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No hay resultados todavía</Text>
          </View>
        )}
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
    gap: 24,
  },
  header: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.golf.textLight,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  leaderboard: {
    gap: 12,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  playerCardLeader: {
    backgroundColor: Colors.golf.primary + '15',
    borderWidth: 2,
    borderColor: Colors.golf.primary,
  },
  playerRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.golf.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionNumber: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  playerInfo: {
    flex: 1,
    gap: 4,
  },
  playerName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.golf.text,
  },
  playerNameLeader: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
  },
  holesCompleted: {
    fontSize: 13,
    color: Colors.golf.textLight,
    fontWeight: '500' as const,
  },
  scoreInfo: {
    alignItems: 'flex-end',
    gap: 2,
  },
  scoreValue: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  scoreValueLeader: {
    fontSize: 24,
  },
  scoreValueOver: {
    color: Colors.golf.error,
  },
  scoreValueUnder: {
    color: Colors.golf.success,
  },
  totalScore: {
    fontSize: 13,
    color: Colors.golf.textLight,
    fontWeight: '500' as const,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.golf.textLight,
    fontWeight: '500' as const,
  },
});
