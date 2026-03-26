import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useState, useRef } from 'react';
import { useRouter, Stack } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import Colors from '../../constants/colors';
import { fetchCompetitionData } from '../../config/firebase';
import { CheckCircle } from 'lucide-react-native';

export default function CodeEntryScreen() {
  const router = useRouter();
  const [code, setCode] = useState<string[]>(['', '', '', '', '', '', '', '']);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const competitionMutation = useMutation({
    mutationFn: async (fullCode: string) => {
      console.log('Fetching competition with code:', fullCode);
      const data = await fetchCompetitionData(fullCode);
      if (!data) {
        throw new Error('No se encontró ninguna competición con este código');
      }
      return data;
    },
    onSuccess: (data) => {
      console.log('Competition found:', data);
      router.replace({
        pathname: '/competition/confirmation',
        params: {
          competitionData: JSON.stringify(data),
        },
      });
    },
    onError: (error: Error) => {
      console.error('Error fetching competition:', error);
      Alert.alert('Error', error.message || 'No se pudo cargar la competición');
    },
  });

  const handleCodeChange = (text: string, index: number) => {
    const newCode = [...code];
    newCode[index] = text.toUpperCase();
    setCode(newCode);

    if (text && index < 7) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleLoadCompetition = () => {
    const fullCode = code.join('');
    if (fullCode.length === 8) {
      competitionMutation.mutate(fullCode);
    } else {
      Alert.alert('Error', 'Por favor introduce los 8 caracteres del código');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Código de Competición',
          headerStyle: { backgroundColor: Colors.golf.headerBg },
          headerTintColor: '#FFFFFF',
        }}
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.iconWrap}>
            <Text style={styles.iconText}>#</Text>
          </View>
          <Text style={styles.title}>Introduce el código</Text>
          <Text style={styles.subtitle}>
            Introduce el código de 8 caracteres de tu competición
          </Text>
        </View>

        <View style={styles.codeWrapper}>
          <View style={styles.codeRow}>
            {code.slice(0, 4).map((char, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[styles.codeInput, char ? styles.codeInputFilled : null]}
                value={char}
                onChangeText={(text) => handleCodeChange(text, index)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index)}
                maxLength={1}
                autoCapitalize="characters"
                autoCorrect={false}
                keyboardType="default"
                selectTextOnFocus
                testID={`code-input-${index}`}
                editable={!competitionMutation.isPending}
              />
            ))}
          </View>
          <View style={styles.codeRow}>
            {code.slice(4, 8).map((char, index) => (
              <TextInput
                key={index + 4}
                ref={(ref) => { inputRefs.current[index + 4] = ref; }}
                style={[styles.codeInput, char ? styles.codeInputFilled : null]}
                value={char}
                onChangeText={(text) => handleCodeChange(text, index + 4)}
                onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, index + 4)}
                maxLength={1}
                autoCapitalize="characters"
                autoCorrect={false}
                keyboardType="default"
                selectTextOnFocus
                testID={`code-input-${index + 4}`}
                editable={!competitionMutation.isPending}
              />
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.loadButton, !code.every(c => c !== '') && styles.loadButtonDisabled]}
          onPress={handleLoadCompetition}
          disabled={!code.every(c => c !== '') || competitionMutation.isPending}
          testID="load-competition-button"
        >
          <CheckCircle size={20} color="#FFFFFF" />
          <Text style={styles.loadButtonText}>Cargar Competición</Text>
        </TouchableOpacity>

        {competitionMutation.isPending && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.golf.primary} />
            <Text style={styles.loadingText}>Cargando competición...</Text>
          </View>
        )}

        {competitionMutation.isError && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>
              {competitionMutation.error?.message || 'Error al cargar la competición'}
            </Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => setCode(['', '', '', '', '', '', '', ''])}
            >
              <Text style={styles.retryButtonText}>Intentar de nuevo</Text>
            </TouchableOpacity>
          </View>
        )}
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
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 36,
    gap: 10,
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: Colors.golf.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconText: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.golf.primary,
  },
  title: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.golf.textLight,
    lineHeight: 22,
    textAlign: 'center',
  },
  codeWrapper: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 32,
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  codeInput: {
    width: 48,
    height: 60,
    borderWidth: 1.5,
    borderColor: Colors.golf.border,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700' as const,
    textAlign: 'center',
    color: Colors.golf.text,
    backgroundColor: '#FFFFFF',
  },
  codeInputFilled: {
    borderColor: Colors.golf.primary,
    backgroundColor: Colors.golf.primary + '08',
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 12,
    marginTop: 20,
  },
  loadingText: {
    fontSize: 15,
    color: Colors.golf.textLight,
    fontWeight: '500' as const,
  },
  errorContainer: {
    alignItems: 'center',
    gap: 14,
    padding: 20,
    backgroundColor: Colors.golf.error + '0A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.golf.error + '20',
    marginTop: 20,
  },
  errorText: {
    fontSize: 15,
    color: Colors.golf.error,
    textAlign: 'center',
    fontWeight: '500' as const,
  },
  retryButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: Colors.golf.primary,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  loadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.golf.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 8,
    marginBottom: 20,
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loadButtonDisabled: {
    backgroundColor: Colors.golf.textLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  loadButtonText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
