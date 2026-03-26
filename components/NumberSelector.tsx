import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Plus, Minus } from 'lucide-react-native';
import Colors from '../constants/colors';

interface NumberSelectorProps {
  value: number;
  min: number;
  max: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

export default function NumberSelector({
  value,
  min,
  max,
  onIncrement,
  onDecrement,
}: NumberSelectorProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[
          styles.button,
          value === min && styles.buttonDisabled,
        ]}
        onPress={onDecrement}
        disabled={value === min}
        testID="decrease-button"
      >
        <Minus size={32} color={value === min ? Colors.golf.textLight : Colors.golf.primary} />
      </TouchableOpacity>

      <View style={styles.display}>
        <Text style={styles.text}>{value}</Text>
      </View>

      {value < max && (
        <TouchableOpacity
          style={styles.button}
          onPress={onIncrement}
          testID="increase-button"
        >
          <Plus size={32} color={Colors.golf.primary} />
        </TouchableOpacity>
      )}
      {value === max && <View style={styles.buttonPlaceholder} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonPlaceholder: {
    width: 64,
    height: 64,
  },
  display: {
    width: 100,
    height: 100,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.golf.primary,
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 5,
  },
  text: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
  },
});
