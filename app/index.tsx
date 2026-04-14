import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Animated,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Trophy, Users, User, ChevronRight, Mail, UserPlus } from 'lucide-react-native';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../constants/colors';
import { useCompetition } from '../providers/CompetitionProvider';
import { useFreePlay } from '../providers/FreePlayProvider';
import { usePlayerAuth } from '../providers/PlayerAuthProvider';
import { loginWithGoogle } from '../services/auth';
import { findCompetitionByDeviceId, getPlayerHoleScores } from '../config/firebase';
import type { FoundCompetitionSession } from '../config/firebase';

type Screen = 'landing' | 'menu';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoaded: compLoaded, competition, currentScreen, deviceId, startCompetition, setDevicePlayerId, setScoringModeAndPlayers, goToHole, resetCompetition } = useCompetition();
  const { gameStarted, isLoaded: freePlayLoaded, currentScreen: freePlayScreen } = useFreePlay();
  const { isAuthenticated, isLoading: authLoading, reloadSession } = usePlayerAuth();
  const [screen, setScreen] = useState<Screen>('landing');

  const googleMutation = useMutation({
    mutationFn: async () => {
      await loginWithGoogle();
      await reloadSession();
    },
    onSuccess: () => setScreen('menu'),
    onError: (error: Error) => {
      Alert.alert('Error', error.message || 'No se pudo iniciar sesión con Google');
    },
  });
  const [isCheckingCompetition, setIsCheckingCompetition] = useState<boolean>(false);

  const isLoaded = compLoaded && freePlayLoaded && !authLoading;

  // Landing animations
  const logoAnim = useRef(new Animated.Value(0)).current;
  const taglineAnim = useRef(new Animated.Value(0)).current;
  const buttonsAnim = useRef(new Animated.Value(0)).current;

  // Menu animations
  const menuFadeAnim = useRef(new Animated.Value(0)).current;
  const menuSlideAnim = useRef(new Animated.Value(30)).current;
  const buttonAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  // Animate landing screen
  useEffect(() => {
    if (isLoaded && screen === 'landing') {
      Animated.stagger(180, [
        Animated.timing(logoAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(taglineAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(buttonsAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [isLoaded, screen]);

  // Animate main menu
  useEffect(() => {
    if (screen === 'menu') {
      menuFadeAnim.setValue(0);
      menuSlideAnim.setValue(20);
      buttonAnims.forEach(a => a.setValue(0));

      Animated.parallel([
        Animated.timing(menuFadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(menuSlideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start();

      buttonAnims.forEach((anim, i) => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 350,
          delay: 200 + i * 100,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [screen]);

  // Session restoration
  useEffect(() => {
    if (isLoaded && competition && currentScreen && deviceId) {
      router.replace(currentScreen as any);
    } else if (isLoaded && gameStarted && freePlayScreen) {
      router.replace(freePlayScreen as any);
    }
  }, [isLoaded, competition, currentScreen, deviceId, gameStarted, freePlayScreen, router]);

  // Auto-show menu if already authenticated
  useEffect(() => {
    if (isLoaded && isAuthenticated) {
      setScreen('menu');
    }
  }, [isLoaded, isAuthenticated]);

  const handleExitCompetitionFlow = useCallback(() => {
    Alert.alert(
      'Abandonar partida',
      '¿Vas a abandonar la partida, estás seguro?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Causa justificada',
              '¿Es el abandono por una causa justificada?',
              [
                {
                  text: 'Sí',
                  onPress: () => resetCompetition(),
                },
                {
                  text: 'No',
                  style: 'destructive',
                  onPress: () => {
                    Alert.alert(
                      'Descalificación',
                      'Va a ser descalificado de la competición',
                      [
                        { text: 'No', style: 'cancel' },
                        {
                          text: 'Sí, aceptar',
                          style: 'destructive',
                          onPress: () => resetCompetition(),
                        },
                      ]
                    );
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [resetCompetition]);

  const handleLoadCompetition = useCallback(async (session: FoundCompetitionSession) => {
    startCompetition({
      codigo_grupo: session.codigoGrupo,
      nombre_competicion: session.nombreCompeticion,
      nombre_prueba: session.nombrePrueba,
      jugadores: session.jugadores.map(j => ({
        id: j.id,
        nombre: j.nombre,
        apellido: j.apellido,
        licencia: j.licencia,
      })),
      campo: session.campo,
      recorrido: session.recorrido,
    });
    await setDevicePlayerId(session.playerId);
    const holeScores = await getPlayerHoleScores(session.codigoGrupo, session.playerId);
    let firstUnscoredHole = 1;
    for (let i = 1; i <= 18; i++) {
      const holeData = holeScores[`hoyo_${i}`];
      if (!holeData || (holeData.golpes_jugador === undefined && !Object.keys(holeData).some(k => k.startsWith('golpes')))) {
        firstUnscoredHole = i;
        break;
      }
      if (i === 18) firstUnscoredHole = 18;
    }
    goToHole(firstUnscoredHole);
    const myIndex = session.jugadores.findIndex(j => j.id === session.playerId);
    if (myIndex !== -1) {
      const nextIndex = (myIndex + 1) % session.jugadores.length;
      setScoringModeAndPlayers('partial', [session.playerId, session.jugadores[nextIndex].id]);
    }
    router.replace('/competition/scoring');
  }, [startCompetition, setDevicePlayerId, goToHole, setScoringModeAndPlayers, router]);

  const handleCompetitionPress = useCallback(async () => {
    if (!deviceId) {
      router.push('/competition/code-entry');
      return;
    }
    setIsCheckingCompetition(true);
    try {
      const session = await findCompetitionByDeviceId(deviceId);
      if (session) {
        Alert.alert(
          'Competición encontrada',
          `Se ha encontrado una competición en curso (${session.nombreCompeticion}) en la que está registrado como ${session.playerNombre} ${session.playerApellido}.`,
          [
            { text: 'Salir', style: 'destructive', onPress: handleExitCompetitionFlow },
            { text: 'Cargar competición', onPress: () => handleLoadCompetition(session) },
          ]
        );
      } else {
        router.push('/competition/code-entry');
      }
    } catch {
      router.push('/competition/code-entry');
    } finally {
      setIsCheckingCompetition(false);
    }
  }, [deviceId, router, handleExitCompetitionFlow, handleLoadCompetition]);

  if (!isLoaded) {
    return (
      <LinearGradient
        colors={['#0D1B12', '#2D5E2F']}
        style={styles.loadingContainer}
      >
        <Image
          source={require('../assets/images/grankers-logo.png')}
          style={styles.loadingLogo}
          resizeMode="contain"
        />
        <ActivityIndicator size="large" color="rgba(255,255,255,0.6)" style={{ marginTop: 40 }} />
      </LinearGradient>
    );
  }

  // ─── LANDING SCREEN ──────────────────────────────────────────────────────────
  if (screen === 'landing') {
    return (
      <LinearGradient
        colors={['#0D1B12', '#1A3520', '#2D5E2F']}
        style={styles.landingContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
      >
        {/* Top decorative circle */}
        <View style={styles.decorCircleTop} />
        <View style={styles.decorCircleBottom} />

        {/* Hero */}
        <View style={[styles.landingHero, { paddingTop: Math.max(insets.top + 48, 80) }]}>
          <Animated.View style={{ opacity: logoAnim, transform: [{ translateY: logoAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }] }}>
            <Image
              source={require('../assets/images/grankers-logo.png')}
              style={styles.landingLogo}
              resizeMode="contain"
            />
          </Animated.View>

          <Animated.View style={{ opacity: taglineAnim, transform: [{ translateY: taglineAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }], alignItems: 'center', gap: 12 }}>
            <View style={styles.taglineDivider} />
            <Text style={styles.landingTagline}>Golfers only beyond this point</Text>
          </Animated.View>
        </View>

        {/* Buttons */}
        <Animated.View
          style={[
            styles.landingButtons,
            { paddingBottom: Math.max(insets.bottom + 32, 48) },
            { opacity: buttonsAnim, transform: [{ translateY: buttonsAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] },
          ]}
        >
          {/* Google Sign-In */}
          <TouchableOpacity
            style={[styles.btnGoogle, googleMutation.isPending && styles.btnDisabled]}
            onPress={() => googleMutation.mutate()}
            disabled={googleMutation.isPending}
            activeOpacity={0.85}
            testID="landing-google-button"
          >
            {googleMutation.isPending ? (
              <ActivityIndicator size="small" color={Colors.golf.text} />
            ) : (
              <View style={styles.googleIcon}>
                <Text style={styles.googleIconLetter}>G</Text>
              </View>
            )}
            <Text style={styles.btnGoogleText}>
              {googleMutation.isPending ? 'Conectando...' : 'Continuar con Google'}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>o</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Email row */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btnHalf, styles.btnHalfPrimary]}
              onPress={() => router.push('/player-area/login')}
              activeOpacity={0.85}
              testID="landing-login-button"
            >
              <Mail size={18} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.btnHalfPrimaryText}>Iniciar sesión</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnHalf, styles.btnHalfSecondary]}
              onPress={() => router.push('/player-area/register')}
              activeOpacity={0.85}
              testID="landing-register-button"
            >
              <UserPlus size={18} color={Colors.golf.primary} strokeWidth={2} />
              <Text style={styles.btnHalfSecondaryText}>Crear cuenta</Text>
            </TouchableOpacity>
          </View>

          {/* Guest */}
          <TouchableOpacity
            style={styles.btnGhost}
            onPress={() => setScreen('menu')}
            activeOpacity={0.7}
            testID="landing-guest-button"
          >
            <Text style={styles.btnGhostText}>Continuar sin cuenta</Text>
            <ChevronRight size={16} color="rgba(255,255,255,0.5)" />
          </TouchableOpacity>
        </Animated.View>
      </LinearGradient>
    );
  }

  // ─── MAIN MENU ───────────────────────────────────────────────────────────────
  const menuItems = [
    {
      icon: <User size={24} color={Colors.golf.primary} strokeWidth={2} />,
      title: 'Área del Jugador',
      subtitle: isAuthenticated ? 'Tu perfil y estadísticas' : 'Iniciar sesión para acceder',
      onPress: () => router.push('/player-area'),
      testID: 'player-area-button',
      disabled: false,
    },
    {
      icon: <Trophy size={24} color={Colors.golf.accent} strokeWidth={2} />,
      title: 'Competición',
      subtitle: isCheckingCompetition ? 'Comprobando...' : 'Introducir código de prueba',
      onPress: handleCompetitionPress,
      testID: 'competition-button',
      disabled: isCheckingCompetition,
    },
    {
      icon: <Users size={24} color={Colors.golf.water} strokeWidth={2} />,
      title: 'Partida Libre',
      subtitle: 'Empezar una nueva partida',
      onPress: () => router.push('/free-play/select-course'),
      testID: 'free-play-button',
      disabled: false,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.heroSection, { paddingTop: Math.max(insets.top + 20, 60) }]}>
        <Animated.View style={[styles.heroContent, { opacity: menuFadeAnim, transform: [{ translateY: menuSlideAnim }] }]}>
          <Image
            source={require('../assets/images/grankers-logo.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.tagline}>Golfers only beyond this point</Text>
        </Animated.View>
      </View>

      <View style={[styles.menuSection, { paddingBottom: Math.max(insets.bottom + 16, 32) }]}>
        <Text style={styles.sectionLabel}>¿Qué quieres hacer?</Text>

        {menuItems.map((item, index) => (
          <Animated.View
            key={item.testID}
            style={{
              opacity: buttonAnims[index],
              transform: [{
                translateY: buttonAnims[index].interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              }],
            }}
          >
            <TouchableOpacity
              style={[styles.menuCard, item.disabled && styles.menuCardDisabled]}
              onPress={item.onPress}
              disabled={item.disabled}
              activeOpacity={0.7}
              testID={item.testID}
            >
              <View style={styles.menuIconWrap}>
                {item.icon}
              </View>
              <View style={styles.menuTextWrap}>
                <Text style={styles.menuTitle}>{item.title}</Text>
                <Text style={styles.menuSubtitle}>{item.subtitle}</Text>
              </View>
              <ChevronRight size={20} color={Colors.golf.border} />
            </TouchableOpacity>
          </Animated.View>
        ))}

        {!isAuthenticated && (
          <Animated.View style={{ opacity: menuFadeAnim }}>
            <TouchableOpacity
              style={styles.loginPrompt}
              onPress={() => setScreen('landing')}
              activeOpacity={0.7}
            >
              <Text style={styles.loginPromptText}>Inicia sesión para acceder a todas las funciones</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ─── Loading ───────────────────────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: 180,
    height: 50,
    opacity: 0.9,
  },

  // ─── Landing ───────────────────────────────────────────────────────────────
  landingContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  decorCircleTop: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
    backgroundColor: 'rgba(61,123,63,0.12)',
    top: -120,
    right: -100,
  },
  decorCircleBottom: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(245,166,35,0.07)',
    bottom: 80,
    left: -80,
  },
  landingHero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 28,
  },
  landingLogo: {
    width: 240,
    height: 66,
  },
  taglineDivider: {
    width: 40,
    height: 1.5,
    backgroundColor: Colors.golf.accent,
    borderRadius: 1,
    opacity: 0.8,
  },
  landingTagline: {
    fontSize: 14,
    fontWeight: '400' as const,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
    textAlign: 'center',
  },
  landingButtons: {
    paddingHorizontal: 24,
    gap: 12,
  },
  btnGoogle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  googleIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#4285F4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleIconLetter: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  btnGoogleText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.4)',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnHalf: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 15,
    gap: 8,
  },
  btnHalfPrimary: {
    backgroundColor: Colors.golf.primary,
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  btnHalfPrimaryText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  btnHalfSecondary: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  btnHalfSecondaryText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.golf.primary,
  },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 4,
  },
  btnGhostText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.5)',
  },

  // ─── Main menu ─────────────────────────────────────────────────────────────
  container: {
    flex: 1,
    backgroundColor: Colors.golf.background,
  },
  heroSection: {
    backgroundColor: Colors.golf.headerBg,
    paddingBottom: 40,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  heroContent: {
    alignItems: 'center',
    gap: 12,
  },
  logoImage: {
    width: 220,
    height: 60,
    marginBottom: 4,
  },
  tagline: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.3,
  },
  menuSection: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.8,
    marginBottom: 4,
    marginLeft: 4,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  menuCardDisabled: {
    opacity: 0.6,
  },
  menuIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: Colors.golf.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextWrap: {
    flex: 1,
    gap: 2,
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.golf.text,
  },
  menuSubtitle: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: Colors.golf.textLight,
  },
  loginPrompt: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  loginPromptText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.golf.primary,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
});
