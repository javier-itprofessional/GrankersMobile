import { View, Text, StyleSheet, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { UserPlus, Mail, Globe, FileText, ChevronRight, Check } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { usePlayerAuth, PlayerSession } from '@/providers/PlayerAuthProvider';

export default function RegisterScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { saveSession } = usePlayerAuth();

  const [fullName, setFullName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [country, setCountry] = useState<string>('');
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);

  const googleRegisterMutation = useMutation({
    mutationFn: async () => {
      console.log('[Register] Google register pressed');
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
      console.log('[Register] Google register success');
      router.replace('/player-area');
    },
    onError: (error: Error) => {
      console.error('[Register] Google register error:', error);
      Alert.alert('Error', 'No se pudo registrar con Google');
    },
  });

  const emailRegisterMutation = useMutation({
    mutationFn: async () => {
      if (!fullName.trim()) {
        throw new Error('Por favor, introduce tu nombre completo');
      }
      if (!email.trim()) {
        throw new Error('Por favor, introduce tu correo electrónico');
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        throw new Error('Por favor, introduce un correo electrónico válido');
      }
      if (!country.trim()) {
        throw new Error('Por favor, introduce tu país de residencia');
      }
      if (!acceptedTerms) {
        throw new Error('Debes aceptar los términos de uso y la política de privacidad');
      }

      console.log('[Register] Email register with:', { fullName, email, country });
      const newSession: PlayerSession = {
        id: `email-${Date.now()}`,
        name: fullName.trim(),
        email: email.trim(),
        country: country.trim(),
        authMethod: 'email',
        createdAt: new Date().toISOString(),
      };
      await saveSession(newSession);
      return newSession;
    },
    onSuccess: () => {
      console.log('[Register] Email register success');
      router.replace('/player-area');
    },
    onError: (error: Error) => {
      Alert.alert('Error', error.message);
    },
  });

  const isFormValid = fullName.trim() && email.trim() && country.trim() && acceptedTerms;

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
            { paddingTop: Math.max(insets.top + 16, 50), paddingBottom: Math.max(insets.bottom + 20, 40) },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.topSection}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <UserPlus size={38} color={Colors.golf.primary} strokeWidth={1.8} />
              </View>
            </View>
            <Text style={styles.mainTitle}>¡Únete a Grankers!</Text>
            <Text style={styles.mainSubtitle}>
              Crea tu cuenta y comienza a encontrar y disfrutar eventos de golf
            </Text>
          </View>

          <View style={styles.sectionContainer}>
            <Text style={styles.sectionLabel}>Registrarse con Google</Text>
            <TouchableOpacity
              style={styles.googleButton}
              onPress={() => googleRegisterMutation.mutate()}
              disabled={googleRegisterMutation.isPending}
              activeOpacity={0.8}
              testID="google-register-button"
            >
              <View style={styles.googleIconContainer}>
                <Text style={styles.googleIconText}>G</Text>
              </View>
              <Text style={styles.googleButtonText}>
                {googleRegisterMutation.isPending ? 'Conectando...' : 'Regístrese con Google'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o continuar con email</Text>
            <View style={styles.dividerLine} />
          </View>

          <View style={styles.sectionContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Nombre completo</Text>
              <View style={styles.inputWrapper}>
                <UserPlus size={18} color={Colors.golf.textLight} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Tu nombre y apellidos"
                  placeholderTextColor="#AAAAAA"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  testID="register-name-input"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>Correo electrónico</Text>
              <View style={styles.inputWrapper}>
                <Mail size={18} color={Colors.golf.textLight} />
                <TextInput
                  style={styles.textInput}
                  placeholder="tu@correo.com"
                  placeholderTextColor="#AAAAAA"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="register-email-input"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.fieldLabel}>País de residencia</Text>
              <View style={styles.inputWrapper}>
                <Globe size={18} color={Colors.golf.textLight} />
                <TextInput
                  style={styles.textInput}
                  placeholder="España"
                  placeholderTextColor="#AAAAAA"
                  value={country}
                  onChangeText={setCountry}
                  autoCapitalize="words"
                  testID="register-country-input"
                />
              </View>
            </View>

            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAcceptedTerms(!acceptedTerms)}
              activeOpacity={0.7}
              testID="terms-checkbox"
            >
              <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
                {acceptedTerms && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
              </View>
              <Text style={styles.termsText}>
                Acepto los{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => router.push('/player-area/terms')}
                >
                  términos de uso
                </Text>
                {' '}y la{' '}
                <Text
                  style={styles.termsLink}
                  onPress={() => router.push('/player-area/privacy')}
                >
                  política de privacidad
                </Text>
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.registerButton, !isFormValid && styles.buttonDisabled]}
              onPress={() => emailRegisterMutation.mutate()}
              disabled={emailRegisterMutation.isPending || !isFormValid}
              activeOpacity={0.8}
              testID="register-submit-button"
            >
              <FileText size={20} color="#FFFFFF" />
              <Text style={styles.registerButtonText}>
                {emailRegisterMutation.isPending ? 'Registrando...' : 'Crear cuenta'}
              </Text>
              <ChevronRight size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSection}>
            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => router.back()}
              activeOpacity={0.7}
              testID="login-link"
            >
              <Text style={styles.loginQuestion}>¿Ya tienes una cuenta? </Text>
              <Text style={styles.loginAction}>Inicia sesión aquí</Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: 32,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E8F0EA',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.golf.primary,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.golf.primary,
    marginBottom: 10,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  mainSubtitle: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: Colors.golf.textLight,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  sectionContainer: {
    gap: 16,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1.5,
    borderColor: Colors.golf.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 14,
  },
  googleIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIconText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.text,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
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
    gap: 6,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.golf.text,
    marginLeft: 4,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: Colors.golf.border,
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400' as const,
    color: Colors.golf.text,
    paddingVertical: 13,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginTop: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.golf.border,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: Colors.golf.primary,
    borderColor: Colors.golf.primary,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '400' as const,
    color: Colors.golf.text,
    lineHeight: 20,
  },
  termsLink: {
    color: Colors.golf.primary,
    fontWeight: '600' as const,
    textDecorationLine: 'underline' as const,
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.golf.primary,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    marginTop: 4,
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  bottomSection: {
    alignItems: 'center',
    marginTop: 12,
  },
  loginLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  loginQuestion: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: Colors.golf.textLight,
  },
  loginAction: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
    textDecorationLine: 'underline' as const,
  },
});
