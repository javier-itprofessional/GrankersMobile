import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Users, ArrowRight } from 'lucide-react-native';
import Colors from '../../constants/colors';

export default function CreateGameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    courseUuid?: string;
    routeUuid?: string;
    courseName?: string;
    routeName?: string;
  }>();

  const [gameName, setGameName] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const handleContinue = () => {
    if (!params.courseUuid) {
      Alert.alert('Error', 'Faltan datos del campo. Vuelve atrás y selecciona de nuevo.');
      return;
    }
    setIsCreating(true);
    router.push({
      pathname: '/free-play/setup',
      params: {
        courseUuid: params.courseUuid,
        routeUuid: params.routeUuid ?? '',
        courseName: params.courseName ?? '',
        routeName: params.routeName ?? '',
        gameName: gameName.trim() || `${params.courseName ?? 'Partida'}_${Date.now()}`,
        numberOfPlayers: '2',
      },
    });
    setIsCreating(false);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          title: 'Crear Partida',
          headerStyle: { backgroundColor: Colors.golf.headerBg },
          headerTintColor: '#FFFFFF',
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Users size={48} color={Colors.golf.primary} />
          <Text style={styles.title}>Crear Nueva Partida</Text>
          <Text style={styles.subtitle}>
            Dale un nombre a tu partida (opcional)
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nombre de la Partida</Text>
            <TextInput
              style={styles.input}
              value={gameName}
              onChangeText={setGameName}
              placeholder={`${params.courseName || 'Campo'}_partida`}
              placeholderTextColor={Colors.golf.textLight}
              testID="game-name-input"
              maxLength={80}
            />
          </View>

          {params.courseName ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Campo:</Text>
              <Text style={styles.infoValue}>{params.courseName}</Text>
            </View>
          ) : null}
          {params.routeName ? (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Recorrido:</Text>
              <Text style={styles.infoValue}>{params.routeName}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.createButton, isCreating && styles.createButtonDisabled]}
          onPress={handleContinue}
          disabled={isCreating}
          testID="create-game-button"
        >
          {isCreating ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={styles.createButtonText}>Añadir Jugadores</Text>
              <ArrowRight size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()} testID="cancel-button">
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.golf.background },
  scrollView: { flex: 1 },
  content: { padding: 20, gap: 32 },
  header: { alignItems: 'center', gap: 12 },
  title: { fontSize: 26, fontWeight: '700' as const, color: Colors.golf.text },
  subtitle: { fontSize: 15, color: Colors.golf.textLight, textAlign: 'center', lineHeight: 21 },
  form: { gap: 20 },
  inputContainer: { gap: 8 },
  label: { fontSize: 16, fontWeight: '600' as const, color: Colors.golf.text, marginLeft: 4 },
  input: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 2, borderColor: Colors.golf.border, paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, color: Colors.golf.text },
  infoRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
  infoLabel: { fontSize: 14, fontWeight: '600' as const, color: Colors.golf.textLight },
  infoValue: { fontSize: 14, color: Colors.golf.text },
  createButton: { backgroundColor: Colors.golf.primary, borderRadius: 14, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: Colors.golf.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  createButtonText: { fontSize: 18, fontWeight: '700' as const, color: '#FFFFFF' },
  createButtonDisabled: { opacity: 0.6 },
  cancelButton: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: Colors.golf.border },
  cancelButtonText: { fontSize: 18, fontWeight: '700' as const, color: Colors.golf.textLight },
});
