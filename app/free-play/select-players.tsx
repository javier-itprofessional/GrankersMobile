import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Users, ArrowRight } from 'lucide-react-native';
import { useState } from 'react';
import Colors from '../../constants/colors';
import NumberSelector from '../../components/NumberSelector';

export default function SelectPlayersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    courseName?: string; 
    routeName?: string; 
    gameName?: string;
    groupName?: string;
    gameType?: string;
    gamePassword?: string;
  }>();
  const [numberOfPlayers, setNumberOfPlayers] = useState(4);

  const handleIncreaseNumber = () => {
    if (numberOfPlayers < 4) {
      setNumberOfPlayers(numberOfPlayers + 1);
    }
  };

  const handleDecreaseNumber = () => {
    if (numberOfPlayers > 1) {
      setNumberOfPlayers(numberOfPlayers - 1);
    }
  };

  const handleContinueToNames = () => {
    router.push({
      pathname: '/free-play/setup',
      params: { 
        numberOfPlayers: numberOfPlayers.toString(),
        courseName: params.courseName,
        routeName: params.routeName,
        gameName: params.gameName,
        groupName: params.groupName,
        gameType: params.gameType,
        gamePassword: params.gamePassword,
      },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Número de Jugadores',
          headerStyle: { backgroundColor: Colors.golf.headerBg },
          headerTintColor: '#FFFFFF',
        }}
      />

      <View style={styles.centerContent}>
        <View style={styles.header}>
          <Users size={56} color={Colors.golf.primary} />
          <Text style={styles.title}>Número de Jugadores</Text>
          <Text style={styles.subtitle}>
            Selecciona cuántos jugadores participarán en la partida
          </Text>
        </View>

        <NumberSelector
          value={numberOfPlayers}
          min={1}
          max={4}
          onIncrement={handleIncreaseNumber}
          onDecrement={handleDecreaseNumber}
        />

        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleContinueToNames}
          testID="continue-button"
        >
          <Text style={styles.continueButtonText}>Continuar</Text>
          <ArrowRight size={20} color="#FFFFFF" />
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
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 48,
  },
  header: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.golf.textLight,
    textAlign: 'center',
    lineHeight: 21,
  },
  continueButton: {
    backgroundColor: Colors.golf.primary,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
