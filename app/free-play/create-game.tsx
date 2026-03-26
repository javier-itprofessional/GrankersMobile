import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, Modal, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Users, Lock, Unlock, ArrowRight, X } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { createFreePlayGame, addGroupToExistingGame } from '@/config/firebase';

export default function CreateGameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ 
    courseName?: string; 
    routeName?: string; 
    gameName?: string;
    existingGame?: string;
  }>();
  
  const [gameName, setGameName] = useState<string>('');
  const [groupName, setGroupName] = useState<string>('');
  const [gameType, setGameType] = useState<'public' | 'private'>('public');
  const [showPasswordModal, setShowPasswordModal] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [isCreating, setIsCreating] = useState<boolean>(false);

  useEffect(() => {
    if (params.existingGame === 'true' && params.gameName) {
      console.log('[CreateGame] Joining existing game:', params.gameName);
      setGameName(params.gameName);
      setGroupName('Grupo_1');
    } else if (params.courseName) {
      const defaultGameName = `${params.courseName}_1`;
      setGameName(defaultGameName);
      console.log('[CreateGame] Default game name set:', defaultGameName);
      setGroupName('Grupo_1');
    }
  }, [params.courseName, params.gameName, params.existingGame]);

  const handleCreateGame = async () => {
    if (!gameName.trim()) {
      Alert.alert('Error', 'Debes introducir un nombre de partida');
      return;
    }

    if (!groupName.trim()) {
      Alert.alert('Error', 'Debes introducir un nombre de grupo');
      return;
    }

    console.log('[CreateGame] Creating game:', { gameName, groupName, gameType });

    if (gameType === 'private') {
      setShowPasswordModal(true);
    } else {
      await saveGameToFirebase();
    }
  };

  const handlePasswordSubmit = async () => {
    if (password.length !== 4 || !/^\d{4}$/.test(password)) {
      Alert.alert('Error', 'La contraseña debe tener exactamente 4 dígitos numéricos');
      return;
    }

    console.log('[CreateGame] Password set:', password);
    setShowPasswordModal(false);
    await saveGameToFirebase();
  };

  const saveGameToFirebase = async () => {
    if (!params.courseName || !params.routeName) {
      Alert.alert('Error', 'Faltan datos del campo o recorrido');
      return;
    }

    setIsCreating(true);
    try {
      if (params.existingGame !== 'true') {
        await createFreePlayGame(
          params.courseName,
          params.routeName,
          gameName,
          groupName,
          gameType === 'private' ? password : undefined
        );
        console.log('[CreateGame] Game saved to Firebase successfully');
      } else {
        await addGroupToExistingGame(
          params.courseName,
          params.routeName,
          gameName,
          groupName
        );
        console.log('[CreateGame] Group added to existing game successfully');
      }
      
      proceedToNextScreen();
    } catch (error) {
      console.error('[CreateGame] Error saving game to Firebase:', error);
      Alert.alert(
        'Error',
        'No se pudo crear la partida. Verifica tu conexión a internet.'
      );
    } finally {
      setIsCreating(false);
    }
  };

  const proceedToNextScreen = () => {
    console.log('[CreateGame] Proceeding to player selection');
    router.push({
      pathname: '/free-play/select-players',
      params: {
        courseName: params.courseName,
        routeName: params.routeName,
        gameName,
        groupName,
        gameType,
        ...(gameType === 'private' ? { gamePassword: password } : {}),
      },
    });
  };

  const handleCancel = () => {
    console.log('[CreateGame] Canceling game creation');
    router.back();
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
            Configura los detalles de tu partida
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nombre de la Partida</Text>
            <TextInput
              style={[styles.input, params.existingGame === 'true' && styles.inputDisabled]}
              value={gameName}
              onChangeText={setGameName}
              placeholder={`${params.courseName || 'Campo'}_1`}
              placeholderTextColor={Colors.golf.textLight}
              testID="game-name-input"
              editable={params.existingGame !== 'true'}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.label}>Nombre del Grupo</Text>
            <TextInput
              style={styles.input}
              value={groupName}
              onChangeText={setGroupName}
              placeholder="Grupo_1"
              placeholderTextColor={Colors.golf.textLight}
              testID="group-name-input"
            />
          </View>

          <View style={styles.gameTypeContainer}>
            <Text style={styles.label}>Tipo de Partida</Text>
            
            <TouchableOpacity
              style={[
                styles.gameTypeOption,
                gameType === 'public' && styles.gameTypeOptionSelected,
                params.existingGame === 'true' && styles.gameTypeOptionDisabled,
              ]}
              onPress={() => setGameType('public')}
              testID="public-game-option"
              disabled={params.existingGame === 'true'}
            >
              <View style={styles.gameTypeIconContainer}>
                <Unlock size={24} color={gameType === 'public' ? '#FFFFFF' : Colors.golf.primary} />
              </View>
              <View style={styles.gameTypeTextContainer}>
                <Text style={[
                  styles.gameTypeTitle,
                  gameType === 'public' && styles.gameTypeTextSelected,
                ]}>
                  Partida Pública
                </Text>
                <Text style={[
                  styles.gameTypeDescription,
                  gameType === 'public' && styles.gameTypeTextSelected,
                ]}>
                  Cualquiera puede unirse
                </Text>
              </View>
              <View style={[
                styles.radioOuter,
                gameType === 'public' && styles.radioOuterSelected,
              ]}>
                {gameType === 'public' && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.gameTypeOption,
                gameType === 'private' && styles.gameTypeOptionSelected,
                params.existingGame === 'true' && styles.gameTypeOptionDisabled,
              ]}
              onPress={() => setGameType('private')}
              testID="private-game-option"
              disabled={params.existingGame === 'true'}
            >
              <View style={styles.gameTypeIconContainer}>
                <Lock size={24} color={gameType === 'private' ? '#FFFFFF' : Colors.golf.primary} />
              </View>
              <View style={styles.gameTypeTextContainer}>
                <Text style={[
                  styles.gameTypeTitle,
                  gameType === 'private' && styles.gameTypeTextSelected,
                ]}>
                  Partida Privada
                </Text>
                <Text style={[
                  styles.gameTypeDescription,
                  gameType === 'private' && styles.gameTypeTextSelected,
                ]}>
                  Requiere contraseña
                </Text>
              </View>
              <View style={[
                styles.radioOuter,
                gameType === 'private' && styles.radioOuterSelected,
              ]}>
                {gameType === 'private' && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.createButton, isCreating && styles.createButtonDisabled]}
          onPress={handleCreateGame}
          disabled={isCreating}
          testID="create-game-button"
        >
          {isCreating ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Text style={styles.createButtonText}>Crear Partida</Text>
              <ArrowRight size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          testID="cancel-button"
        >
          <Text style={styles.cancelButtonText}>Cancelar</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Lock size={32} color={Colors.golf.primary} />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowPasswordModal(false)}
                testID="close-password-modal"
              >
                <X size={24} color={Colors.golf.textLight} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>Contraseña de la Partida</Text>
            <Text style={styles.modalSubtitle}>
              Introduce una contraseña numérica de 4 dígitos
            </Text>

            <TextInput
              style={styles.passwordInput}
              value={password}
              onChangeText={setPassword}
              placeholder="••••"
              placeholderTextColor={Colors.golf.textLight}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              testID="password-input"
            />

            <TouchableOpacity
              style={[
                styles.submitPasswordButton,
                (password.length !== 4 || isCreating) && styles.submitPasswordButtonDisabled,
              ]}
              onPress={handlePasswordSubmit}
              disabled={password.length !== 4 || isCreating}
              testID="submit-password-button"
            >
              {isCreating ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.submitPasswordButtonText}>Confirmar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.golf.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 32,
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
  form: {
    gap: 24,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.text,
    marginLeft: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.golf.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.golf.text,
  },
  inputDisabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.6,
  },
  gameTypeContainer: {
    gap: 12,
  },
  gameTypeOption: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.golf.border,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gameTypeOptionDisabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.6,
  },
  gameTypeOptionSelected: {
    backgroundColor: Colors.golf.primary,
    borderColor: Colors.golf.primary,
  },
  gameTypeIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameTypeTextContainer: {
    flex: 1,
    gap: 4,
  },
  gameTypeTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.text,
  },
  gameTypeDescription: {
    fontSize: 13,
    color: Colors.golf.textLight,
  },
  gameTypeTextSelected: {
    color: '#FFFFFF',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.golf.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: '#FFFFFF',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  createButton: {
    backgroundColor: Colors.golf.primary,
    borderRadius: 14,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.golf.border,
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.golf.textLight,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    padding: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    color: Colors.golf.textLight,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  passwordInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.golf.border,
    paddingHorizontal: 24,
    paddingVertical: 20,
    fontSize: 24,
    color: Colors.golf.text,
    textAlign: 'center',
    letterSpacing: 12,
    fontWeight: '600' as const,
    marginBottom: 20,
  },
  submitPasswordButton: {
    backgroundColor: Colors.golf.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitPasswordButtonDisabled: {
    backgroundColor: Colors.golf.textLight,
    opacity: 0.5,
  },
  submitPasswordButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
