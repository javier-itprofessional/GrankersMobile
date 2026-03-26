import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Mail, ChevronRight } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePlayerAuth, PlayerSession } from '@/providers/PlayerAuthProvider';

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { saveSession } = usePlayerAuth();
  const [email, setEmail] = useState<string>('');

  const googleLoginMutation = useMutation({
    mutationFn: async () => {
      console.log('[Login] Google login pressed');
      const mockSession: PlayerSession = {
        id: `google-${Date.now()}`,
        name: 'Jugador Google',
        email: 'jugador@gmail.com',
        country: 'España',
        authMethod: 'google',
        createdAt: new Date().toISOString(),
      };
      await saveSession(mockSession);
      return mockSession;
    },
    onSuccess: () => {
      console.log('[Login] Google login success, navigating to player area');
      router.replace('/player-area');
    },
    onError: (error: Error) => {
      console.error('[Login] Google login error:', error);
      Alert.alert('Error', 'No se pudo iniciar sesión con Google');
    },
  });

  const emailLoginMutation = useMutation({
    mutationFn: async () => {
      if (!email.trim()) {
        throw new Error('Por favor, introduce tu correo electrónico');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        throw new Error('Por favor, introduce un correo electrónico válido');
      }
      console.log('[Login] Email login with:', email);
      const mockSession: PlayerSession = {
        id: `email-${Date.now()}`,
        name: email.split('@')[0],
        email: email.trim(),
        country: '',
        authMethod: 'email',
        createdAt: new Date().toISOString(),
      };
      await saveSession(mockSession);
      return mockSession;
    },
    onSuccess: () => {
      console.log('[Login] Email login success');
      router.replace('/player-area');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: Math.max(insets.top + 20, 60), paddingBottom: Math.max(insets.bottom + 20, 40) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topSection}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>G</Text>
            </View>
            <Text style={styles.welcomeTitle}>Bienvenido</Text>
            <Text style={styles.welcomeSubtitle}>
              Inicia sesión para acceder a tu área de jugador
            </Text>
          </View>

          <View style={styles.formSection}>
            <TouchableOpacity
              style={styles.googleButton}
              onPress={() => googleLoginMutation.mutate()}
              disabled={googleLoginMutation.isPending}
              activeOpacity={0.8}
              testID="google-login-button"
            >
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleIconText}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>
                {googleLoginMutation.isPending ? 'Conectando...' : 'Iniciar sesión con Google'}
              </Text>
            </TouchableOpacity>

            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o continuar con email</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputWrapper}>
                <Mail size={18} color={Colors.golf.textLight} />
                <TextInput
                  style={styles.textInput}
                  placeholder="tu@correo.com"
                  placeholderTextColor={Colors.golf.textLight}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="email-input"
                />
              </View>
              <TouchableOpacity
                style={[styles.emailLoginButton, (!email.trim()) && styles.buttonDisabled]}
                onPress={() => emailLoginMutation.mutate()}
                disabled={emailLoginMutation.isPending || !email.trim()}
                activeOpacity={0.8}
                testID="email-login-button"
              >
                <Text style={styles.emailLoginButtonText}>
                  {emailLoginMutation.isPending ? 'Iniciando sesión...' : 'Iniciar sesión'}
                </Text>
                <ChevronRight size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={styles.registerLink}
              onPress={() => router.push('/player-area/register')}
              activeOpacity={0.7}
              testID="register-link"
            >
              <Text style={styles.registerQuestion}>¿No tienes una cuenta? </Text>
              <Text style={styles.registerAction}>Regístrese aquí</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backButtonText}>Volver</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.golf.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    flexGrow: 1,
  },
  topSection: {
    alignItems: 'center',
    marginBottom: 36,
  },
  logoBadge: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.golf.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  logoText: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  welcomeSubtitle: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: Colors.golf.textLight,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },
  formSection: {
    gap: 20,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.golf.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
    gap: 14,
  },
  googleIconContainer: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIconText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.golf.text,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.golf.border,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.golf.textLight,
  },
  inputGroup: {
    gap: 12,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.golf.border,
    gap: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400' as const,
    color: Colors.golf.text,
    paddingVertical: 14,
  },
  emailLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.golf.primary,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  emailLoginButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  bottomSection: {
    alignItems: 'center',
    marginTop: 28,
  },
  registerLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  registerQuestion: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: Colors.golf.textLight,
  },
  registerAction: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
    textDecorationLine: 'underline',
  },
  backButton: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 12,
  },
  backButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.golf.textLight,
  },
});
