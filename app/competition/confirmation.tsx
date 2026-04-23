import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Users, Calendar, Trophy } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useCompetition } from '../../providers/CompetitionProvider';
import type { FirebaseCompetitionData, Competition } from '../../types/game';

export default function ConfirmationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ competitionData: string }>();
  const { startCompetition } = useCompetition();

  const competition: FirebaseCompetitionData = JSON.parse(params.competitionData);

  const handleAccept = () => {
    console.log('Accepting competition:', competition);
    const comp: Competition = {
      groupCode: competition.group_code,
      competitionName: competition.competition_name,
      eventName: competition.event_name,
      courseName: competition.course_name,
      routeName: competition.route_name,
      players: competition.players.map((p) => ({
        id: p.id, firstName: p.first_name, lastName: p.last_name,
        license: p.license, handicap: p.handicap,
      })),
    };
    startCompetition(comp);
    router.push({
      pathname: '/competition/select-player',
      params: {
        competitionData: params.competitionData,
      },
    });
  };

  const handleReportError = () => {
    console.log('Report error button pressed');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Confirmación',
          headerStyle: { backgroundColor: Colors.golf.headerBg },
          headerTintColor: '#FFFFFF',
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Trophy size={40} color={Colors.golf.primary} strokeWidth={1.5} />
          </View>
          <Text style={styles.title}>{competition.competition_name}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Calendar size={18} color={Colors.golf.primary} />
            <Text style={styles.cardHeaderText}>PRUEBA</Text>
          </View>
          <Text style={styles.infoValue}>{competition.event_name}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Users size={18} color={Colors.golf.primary} />
            <Text style={styles.cardHeaderText}>JUGADORES</Text>
          </View>

          <View style={styles.playersList}>
            {competition.players.map((player, index) => (
              <View key={player.id} style={styles.playerItem}>
                <View style={styles.playerNumber}>
                  <Text style={styles.playerNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.playerName}>
                  {player.first_name} {player.last_name}
                </Text>
                {player.handicap !== undefined && (
                  <View style={styles.handicapBadge}>
                    <Text style={styles.handicapText}>HCP {player.handicap}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={handleAccept}
            testID="accept-button"
          >
            <Text style={styles.acceptButtonText}>Aceptar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.errorButton}
            onPress={handleReportError}
            testID="report-error-button"
          >
            <Text style={styles.errorButtonText}>Informar Error</Text>
          </TouchableOpacity>
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
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    alignItems: 'center',
    gap: 14,
    marginBottom: 8,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.golf.primary + '12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: Colors.golf.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.golf.border,
  },
  cardHeaderText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.golf.textLight,
    letterSpacing: 0.8,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.golf.text,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  playersList: {
    gap: 0,
  },
  playerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: 1,
    borderBottomColor: Colors.golf.border,
  },
  playerNumber: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: Colors.golf.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerNumberText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  playerName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.text,
  },
  handicapBadge: {
    backgroundColor: Colors.golf.background,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  handicapText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
  },
  buttonContainer: {
    marginTop: 8,
    gap: 10,
  },
  acceptButton: {
    backgroundColor: Colors.golf.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  errorButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.golf.border,
  },
  errorButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
  },
});
