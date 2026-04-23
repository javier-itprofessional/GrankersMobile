import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Colors from '../constants/colors';

interface SearchResultCardProps {
  firstName: string;
  lastName: string;
  license: string;
  handicap?: number;
  onPress: () => void;
  testID?: string;
}

export default function SearchResultCard({
  firstName,
  lastName,
  license,
  handicap,
  onPress,
  testID,
}: SearchResultCardProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      testID={testID}
    >
      <View style={styles.info}>
        <Text style={styles.name}>
          {firstName} {lastName}
        </Text>
        <Text style={styles.license}>Licencia: {license}</Text>
        {handicap !== undefined && (
          <Text style={styles.handicap}>Handicap: {handicap}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  info: {
    gap: 6,
  },
  name: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  license: {
    fontSize: 14,
    color: Colors.golf.primary,
    fontWeight: '600' as const,
  },
  handicap: {
    fontSize: 14,
    color: Colors.golf.textLight,
  },
});
