import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Search, Check, X } from 'lucide-react-native';
import Colors from '../constants/colors';

interface PlayerCardProps {
  index: number;
  firstName: string;
  lastName: string;
  license?: string;
  handicap?: string;
  status?: 'ready' | 'not_present' | 'not_ready' | null;
  isCompetition?: boolean;
  onChangeFirstName: (text: string) => void;
  onChangeLastName: (text: string) => void;
  onChangeHandicap?: (text: string) => void;
  onSearchLicense: () => void;
  onMarkReady?: () => void;
  onMarkNotPresent?: () => void;
}

export default function PlayerCard({
  index,
  firstName,
  lastName,
  license,
  handicap,
  status,
  isCompetition = false,
  onChangeFirstName,
  onChangeLastName,
  onChangeHandicap,
  onSearchLicense,
  onMarkReady,
  onMarkNotPresent,
}: PlayerCardProps) {
  const isReady = status === 'ready';
  const isDisabled = status === 'ready' || status === 'not_present';
  return (
    <View style={styles.playerCard}>
      <View style={styles.playerHeader}>
        <Text style={styles.playerLabel}>
          {license ? `Licencia ${license}` : `Jugador ${index + 1}`}
        </Text>
        {!isCompetition && (
          <TouchableOpacity
            style={styles.searchLicenseButton}
            onPress={onSearchLicense}
            testID={`search-license-${index + 1}`}
          >
            <Search size={18} color={Colors.golf.primary} />
            <Text style={styles.searchLicenseText}>Buscar licencia</Text>
          </TouchableOpacity>
        )}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Nombre"
        value={firstName}
        onChangeText={onChangeFirstName}
        testID={`firstName-${index + 1}`}
        editable={!isCompetition}
      />

      <TextInput
        style={styles.input}
        placeholder="Apellido"
        value={lastName}
        onChangeText={onChangeLastName}
        testID={`lastName-${index + 1}`}
        editable={!isCompetition}
      />

      {!isCompetition && (
        <TextInput
          style={styles.input}
          placeholder="Handicap"
          value={handicap}
          onChangeText={onChangeHandicap}
          testID={`handicap-${index + 1}`}
          keyboardType="numeric"
        />
      )}

      {isCompetition && (
        <View style={styles.competitionButtons}>
          <TouchableOpacity
            style={[styles.statusButton, styles.readyButton, isDisabled && styles.disabledButton]}
            onPress={onMarkReady}
            testID={`ready-${index + 1}`}
            disabled={isDisabled}
          >
            <Check size={18} color="#FFFFFF" />
            <Text style={styles.statusButtonText}>Preparado</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.statusButton, styles.notPresentButton, isDisabled && styles.disabledButton]}
            onPress={onMarkNotPresent}
            testID={`not-present-${index + 1}`}
            disabled={isDisabled}
          >
            <X size={18} color="#FFFFFF" />
            <Text style={styles.statusButtonText}>No presentado</Text>
          </TouchableOpacity>
        </View>
      )}

      {isReady && (
        <View style={styles.watermarkContainer}>
          <View style={styles.watermark}>
            <Text style={styles.watermarkText}>Preparado</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  playerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    overflow: 'hidden',
    position: 'relative',
  },
  playerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  playerLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
  },
  searchLicenseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.golf.background,
    borderWidth: 1,
    borderColor: Colors.golf.primary,
  },
  searchLicenseText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.golf.primary,
  },
  input: {
    backgroundColor: Colors.golf.background,
    borderWidth: 1,
    borderColor: Colors.golf.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.golf.text,
  },
  competitionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  readyButton: {
    backgroundColor: Colors.golf.primary,
  },
  notPresentButton: {
    backgroundColor: '#EF4444',
  },
  statusButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  watermarkContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  watermark: {
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    paddingHorizontal: 60,
    paddingVertical: 12,
    transform: [{ rotate: '-35deg' }],
    borderWidth: 3,
    borderColor: 'rgba(34, 197, 94, 0.5)',
  },
  watermarkText: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: 'rgba(34, 197, 94, 0.8)',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  disabledButton: {
    opacity: 0.4,
  },
});
