import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { UserCheck } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { useFreePlay } from '../../providers/FreePlayProvider';

export default function SelectDevicePlayerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    players?: string;
    sessionUuid?: string;
    courseName?: string;
    routeName?: string;
    gameName?: string;
  }>();
  const { startFreePlay, setDevicePlayer } = useFreePlay();

  const players: { id: string; firstName: string; lastName: string; handicap?: string }[] =
    params.players ? JSON.parse(params.players) : [];

  const handleSelectPlayer = (playerId: string) => {
    const playersWithIds = players.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      handicap: p.handicap ? parseFloat(p.handicap) : 0,
      isDevice: p.id === playerId,
    }));

    startFreePlay(playersWithIds, params.sessionUuid || undefined);
    setDevicePlayer(playerId);

    setTimeout(() => {
      router.replace('/game/scoring');
    }, 150);
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

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <UserCheck size={56} color={Colors.golf.primary} />
          <Text style={styles.title}>¿Quién eres?</Text>
          <Text style={styles.subtitle}>
            Selecciona tu nombre. Tu tarjeta aparecerá resaltada durante la partida.
          </Text>
        </View>

        <View style={styles.playersContainer}>
          {players.map((player) => (
            <TouchableOpacity
              key={player.id}
              style={styles.playerButton}
              onPress={() => handleSelectPlayer(player.id)}
              testID={`select-player-${player.id}`}
            >
              <View style={styles.playerInfo}>
                <Text style={styles.playerName}>{player.firstName} {player.lastName}</Text>
                {player.handicap ? (
                  <Text style={styles.playerHandicap}>Handicap: {player.handicap}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.golf.background },
  scrollView: { flex: 1 },
  content: { padding: 20, gap: 32 },
  header: { alignItems: 'center', gap: 12, marginTop: 20 },
  title: { fontSize: 28, fontWeight: '700' as const, color: Colors.golf.text },
  subtitle: { fontSize: 16, color: Colors.golf.textLight, textAlign: 'center', lineHeight: 24, maxWidth: 320 },
  playersContainer: { gap: 16 },
  playerButton: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3, borderWidth: 2, borderColor: Colors.golf.primary },
  playerInfo: { alignItems: 'center', gap: 8 },
  playerName: { fontSize: 20, fontWeight: '700' as const, color: Colors.golf.text },
  playerHandicap: { fontSize: 15, fontWeight: '600' as const, color: Colors.golf.textLight },
});
