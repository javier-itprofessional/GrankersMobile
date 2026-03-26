import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Animated, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Trophy, Users, User, ChevronRight } from 'lucide-react-native';
import { useEffect, useState, useCallback, useRef } from 'react';
import Colors from '../constants/colors';
import { useCompetition } from '../providers/CompetitionProvider';
import { useFreePlay } from '../providers/FreePlayProvider';
import { findCompetitionByDeviceId, getPlayerHoleScores } from '../config/firebase';
import type { FoundCompetitionSession } from '../config/firebase';

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoaded: compLoaded, competition, currentScreen, deviceId, startCompetition, setDevicePlayerId, setScoringModeAndPlayers, goToHole, resetCompetition } = useCompetition();
  const { gameStarted, isLoaded: freePlayLoaded, currentScreen: freePlayScreen } = useFreePlay();
  const [isCheckingCompetition, setIsCheckingCompetition] = useState<boolean>(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const buttonAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const isLoaded = compLoaded && freePlayLoaded;

  useEffect(() => {
    if (isLoaded) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();

      buttonAnims.forEach((anim, i) => {
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          delay: 300 + i * 120,
          useNativeDriver: true,
        }).start();
      });
    }
  }, [isLoaded, fadeAnim, slideAnim, buttonAnims]);

  useEffect(() => {
    if (isLoaded && competition && currentScreen && deviceId) {
      console.log('[Competition] Restoring session:', { currentScreen, deviceId });
      router.replace(currentScreen as any);
    } else if (isLoaded && gameStarted && freePlayScreen) {
      console.log('[FreePlay] Restoring free play session to:', freePlayScreen);
      router.replace(freePlayScreen as any);
    }
  }, [isLoaded, competition, currentScreen, deviceId, gameStarted, freePlayScreen, router]);

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
                  onPress: () => {
                    console.log('[Home] Player abandoned with justified cause');
                    resetCompetition();
                  },
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
                          onPress: () => {
                            console.log('[Home] Player disqualified from competition');
                            resetCompetition();
                          },
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
    console.log('[Home] Loading existing competition:', session.codigoGrupo);

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
      if (i === 18) {
        firstUnscoredHole = 18;
      }
    }

    console.log('[Home] First unscored hole:', firstUnscoredHole);
    goToHole(firstUnscoredHole);

    const myIndex = session.jugadores.findIndex(j => j.id === session.playerId);
    if (myIndex !== -1) {
      const nextIndex = (myIndex + 1) % session.jugadores.length;
      const ids = [session.playerId, session.jugadores[nextIndex].id];
      setScoringModeAndPlayers('partial', ids);
    }

    router.replace('/competition/scoring');
  }, [startCompetition, setDevicePlayerId, goToHole, setScoringModeAndPlayers, router]);

  const handleCompetitionPress = useCallback(async () => {
    if (!deviceId) {
      console.log('[Home] No device ID yet, going to code entry');
      router.push('/competition/code-entry');
      return;
    }

    setIsCheckingCompetition(true);
    try {
      console.log('[Home] Checking if device is registered in any competition...');
      const session = await findCompetitionByDeviceId(deviceId);

      if (session) {
        console.log('[Home] Found existing competition session:', session.codigoGrupo);
        Alert.alert(
          'Competición encontrada',
          `Se ha encontrado una competición en curso (${session.nombreCompeticion}) en la que está registrado como ${session.playerNombre} ${session.playerApellido}.`,
          [
            {
              text: 'Salir',
              style: 'destructive',
              onPress: handleExitCompetitionFlow,
            },
            {
              text: 'Cargar competición',
              onPress: () => handleLoadCompetition(session),
            },
          ]
        );
      } else {
        console.log('[Home] No existing competition found, going to code entry');
        router.push('/competition/code-entry');
      }
    } catch (error) {
      console.error('[Home] Error checking competition:', error);
      router.push('/competition/code-entry');
    } finally {
      setIsCheckingCompetition(false);
    }
  }, [deviceId, router, handleExitCompetitionFlow, handleLoadCompetition]);

  if (!isLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.golf.primary} />
        <Text style={styles.loadingText}>Cargando...</Text>
      </View>
    );
  }

  const menuItems = [
    {
      icon: <User size={24} color={Colors.golf.primary} strokeWidth={2} />,
      title: 'Área del Jugador',
      subtitle: 'Tu perfil y estadísticas',
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
        <Animated.View style={[styles.heroContent, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.golf.background,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.golf.textLight,
    fontWeight: '500' as const,
  },
});
