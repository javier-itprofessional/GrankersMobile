import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Users, ArrowRight, Globe, Lock, Minus, Plus } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { FontFamily } from '../../constants/Typography';

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
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [numPlayers, setNumPlayers] = useState<number>(2);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const handleContinue = () => {
    if (!params.courseUuid) {
      Alert.alert('Error', 'Faltan datos del campo. Vuelve atrás y selecciona de nuevo.');
      return;
    }
    if (isPrivate && !password.trim()) {
      Alert.alert('Error', 'Introduce una contraseña para la partida privada.');
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
        numberOfPlayers: String(numPlayers),
        isPrivate: isPrivate ? '1' : '0',
        gamePassword: isPrivate ? password.trim() : '',
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
          <Text style={styles.subtitle}>Configura los detalles de tu partida</Text>
        </View>

        <View style={styles.form}>
          {/* Nombre de partida */}
          <View style={styles.fieldGroup}>
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

          {/* Número de jugadores */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Jugadores por grupo</Text>
            <View style={styles.counterRow}>
              <TouchableOpacity
                style={[styles.counterBtn, numPlayers <= 1 && styles.counterBtnDisabled]}
                onPress={() => setNumPlayers((n) => Math.max(1, n - 1))}
                disabled={numPlayers <= 1}
                testID="players-minus"
              >
                <Minus size={20} color={numPlayers <= 1 ? Colors.golf.textLight : Colors.golf.primary} />
              </TouchableOpacity>
              <View style={styles.counterValue}>
                <Text style={styles.counterText}>{numPlayers}</Text>
                <Text style={styles.counterSubtext}>
                  {numPlayers === 1 ? 'jugador' : 'jugadores'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.counterBtn, numPlayers >= 4 && styles.counterBtnDisabled]}
                onPress={() => setNumPlayers((n) => Math.min(4, n + 1))}
                disabled={numPlayers >= 4}
                testID="players-plus"
              >
                <Plus size={20} color={numPlayers >= 4 ? Colors.golf.textLight : Colors.golf.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Tipo de partida: pública / privada */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Tipo de partida</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleBtn, !isPrivate && styles.toggleBtnActive]}
                onPress={() => setIsPrivate(false)}
                testID="toggle-public"
              >
                <Globe size={18} color={!isPrivate ? '#FFFFFF' : Colors.golf.textLight} />
                <Text style={[styles.toggleBtnText, !isPrivate && styles.toggleBtnTextActive]}>
                  Pública
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, isPrivate && styles.toggleBtnActive]}
                onPress={() => setIsPrivate(true)}
                testID="toggle-private"
              >
                <Lock size={18} color={isPrivate ? '#FFFFFF' : Colors.golf.textLight} />
                <Text style={[styles.toggleBtnText, isPrivate && styles.toggleBtnTextActive]}>
                  Privada
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.toggleHint}>
              {isPrivate
                ? 'Solo los jugadores con la contraseña podrán unirse.'
                : 'Cualquier jugador del campo puede unirse a la partida.'}
            </Text>
          </View>

          {/* Contraseña (solo si privada) */}
          {isPrivate && (
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Contraseña</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Introduce una contraseña"
                placeholderTextColor={Colors.golf.textLight}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                testID="game-password-input"
                maxLength={20}
              />
            </View>
          )}

          {/* Info del campo */}
          {(params.courseName || params.routeName) && (
            <View style={styles.infoBox}>
              {params.courseName && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Campo:</Text>
                  <Text style={styles.infoValue}>{params.courseName}</Text>
                </View>
              )}
              {params.routeName && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Recorrido:</Text>
                  <Text style={styles.infoValue}>{params.routeName}</Text>
                </View>
              )}
            </View>
          )}
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
  content: { padding: 20, gap: 28 },
  header: { alignItems: 'center', gap: 12 },
  title: { fontFamily: FontFamily.heading, fontSize: 26, fontWeight: '700' as const, color: Colors.golf.text },
  subtitle: { fontFamily: FontFamily.body, fontSize: 15, color: Colors.golf.textLight, textAlign: 'center', lineHeight: 21 },
  form: { gap: 20 },
  fieldGroup: { gap: 8 },
  label: { fontFamily: FontFamily.bodySemi, fontSize: 15, fontWeight: '600' as const, color: Colors.golf.text, marginLeft: 4 },
  input: { fontFamily: FontFamily.body, backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 2, borderColor: Colors.golf.border, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: Colors.golf.text },
  counterRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 2, borderColor: Colors.golf.border, overflow: 'hidden' },
  counterBtn: { width: 52, height: 52, justifyContent: 'center', alignItems: 'center' },
  counterBtnDisabled: { opacity: 0.4 },
  counterValue: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, borderLeftWidth: 1, borderRightWidth: 1, borderColor: Colors.golf.border },
  counterText: { fontFamily: FontFamily.headingBold, fontSize: 22, fontWeight: '700' as const, color: Colors.golf.text },
  counterSubtext: { fontFamily: FontFamily.body, fontSize: 12, color: Colors.golf.textLight, marginTop: 1 },
  toggleRow: { flexDirection: 'row', borderRadius: 12, borderWidth: 2, borderColor: Colors.golf.border, overflow: 'hidden', backgroundColor: '#FFFFFF' },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  toggleBtnActive: { backgroundColor: Colors.golf.primary },
  toggleBtnText: { fontFamily: FontFamily.bodySemi, fontSize: 15, fontWeight: '600' as const, color: Colors.golf.textLight },
  toggleBtnTextActive: { color: '#FFFFFF' },
  toggleHint: { fontFamily: FontFamily.body, fontSize: 13, color: Colors.golf.textLight, marginLeft: 4, lineHeight: 18 },
  infoBox: { backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: Colors.golf.border, padding: 16, gap: 8 },
  infoRow: { flexDirection: 'row', gap: 8 },
  infoLabel: { fontFamily: FontFamily.bodySemi, fontSize: 14, fontWeight: '600' as const, color: Colors.golf.textLight },
  infoValue: { fontFamily: FontFamily.body, fontSize: 14, color: Colors.golf.text },
  createButton: { backgroundColor: Colors.golf.primary, borderRadius: 14, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: Colors.golf.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  createButtonText: { fontFamily: FontFamily.bodyBold, fontSize: 18, fontWeight: '700' as const, color: '#FFFFFF' },
  createButtonDisabled: { opacity: 0.6 },
  cancelButton: { backgroundColor: '#FFFFFF', borderRadius: 14, paddingVertical: 18, alignItems: 'center', borderWidth: 2, borderColor: Colors.golf.border },
  cancelButtonText: { fontFamily: FontFamily.bodyBold, fontSize: 18, fontWeight: '700' as const, color: Colors.golf.textLight },
});
