import { View, Text, StyleSheet } from 'react-native';
import { WifiOff } from 'lucide-react-native';

interface ConnectionStatusProps {
  isOnline: boolean;
}

export default function ConnectionStatus({ isOnline }: ConnectionStatusProps) {
  if (isOnline) {
    return null;
  }

  return (
    <View style={styles.container}>
      <WifiOff size={16} color="#fff" />
      <Text style={styles.text}>Sin conexión - Los datos se sincronizarán automáticamente</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ff9800',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
});
