import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import Colors from '../../constants/colors';
import { useGame } from '../../providers/GameProvider';

export default function ReviewScreen() {
  const router = useRouter();
  const { goToHole } = useGame();

  const handleHoleSelect = (holeNumber: number) => {
    goToHole(holeNumber);
    router.back();
  };

  const holes = Array.from({ length: 18 }, (_, i) => i + 1);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Revisar Tarjeta',
          headerStyle: { backgroundColor: Colors.golf.headerBg },
          headerTintColor: '#FFFFFF',
        }}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Selecciona un hoyo</Text>
          <Text style={styles.subtitle}>
            Elige el hoyo que quieres revisar o editar
          </Text>
        </View>

        <View style={styles.grid}>
          {holes.map((hole) => (
            <TouchableOpacity
              key={hole}
              style={styles.holeButton}
              onPress={() => handleHoleSelect(hole)}
              testID={`hole-${hole}`}
            >
              <Text style={styles.holeNumber}>{hole}</Text>
            </TouchableOpacity>
          ))}
        </View>
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
    padding: 20,
    gap: 24,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.golf.textLight,
    lineHeight: 22,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  holeButton: {
    width: '22%',
    aspectRatio: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.golf.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  holeNumber: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
  },
});
