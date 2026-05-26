import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter, Stack, useLocalSearchParams } from 'expo-router';
import { Users } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { FontFamily } from '../../constants/Typography';
import { useFreePlay } from '../../providers/FreePlayProvider';
import { usePlayerAuth } from '../../providers/PlayerAuthProvider';
import { createFreePlayGame } from '@/services/game-service';
import PlayerCard from '../../components/PlayerCard';


export default function FreePlaySetupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    numberOfPlayers?: string;
    selectedPlayerIndex?: string;
    selectedPlayerId?: string;
    selectedPlayerFirstName?: string;
    selectedPlayerLastName?: string;
    selectedPlayerLicense?: string;
    selectedPlayerHandicap?: string;
    existingPlayers?: string;
    courseUuid?: string;
    routeUuid?: string;
    courseName?: string;
    routeName?: string;
    gameName?: string;
    isPrivate?: string;
    gamePassword?: string;
  }>();
  const { resetFreePlay, setCourseInfo } = useFreePlay();
  const { isAuthenticated, userProfile, userLicenses } = usePlayerAuth();
  const [players, setPlayers] = useState<{ id: string; firstName: string; lastName: string; license?: string; handicap?: string }[]>(() => {
    if (params.existingPlayers) {
      try { return JSON.parse(params.existingPlayers); } catch {}
    }
    const n = Math.max(1, Math.min(4, parseInt(params.numberOfPlayers ?? '2', 10)));
    return Array.from({ length: n }, (_, i) => ({
      id: `${i + 1}`,
      firstName: '',
      lastName: '',
      license: undefined,
      handicap: undefined,
    }));
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Pre-fill Player 1 with the logged-in user's profile when it loads
  useEffect(() => {
    if (!isAuthenticated || !userProfile) return;
    setPlayers((prev) => {
      if (prev[0]?.firstName) return prev; // already filled, don't overwrite
      const primaryLicense = userLicenses?.[0];
      const updated = [...prev];
      updated[0] = {
        ...updated[0],
        firstName: userProfile.first_name,
        lastName: userProfile.last_name,
        license: primaryLicense?.license_number,
        handicap: primaryLicense?.handicap != null ? String(primaryLicense.handicap) : '',
      };
      return updated;
    });
  }, [isAuthenticated, userProfile, userLicenses]);

  useEffect(() => {
    const selectedPlayerId = params.selectedPlayerId;
    const selectedIndex = params.selectedPlayerIndex;
    const selectedFirstName = params.selectedPlayerFirstName;
    const selectedLastName = params.selectedPlayerLastName;
    const selectedLicense = params.selectedPlayerLicense;
    const selectedHandicap = params.selectedPlayerHandicap;

    if (selectedFirstName && selectedLastName && selectedIndex) {
      console.log('=== UPDATING PLAYER DATA ===');
      console.log('Player ID:', selectedPlayerId);
      console.log('Player Index:', selectedIndex);
      console.log('First name:', selectedFirstName);
      console.log('Last name:', selectedLastName);
      console.log('License:', selectedLicense);
      console.log('Handicap:', selectedHandicap);
      console.log('Current players before update:', JSON.stringify(players));
      
      const playerIndex = parseInt(selectedIndex, 10);
      
      setPlayers((prev) => {
        console.log('Previous players state:', JSON.stringify(prev));
        
        if (playerIndex >= 1 && playerIndex <= prev.length) {
          const updated = [...prev];
          const targetIndex = playerIndex - 1;
          
          updated[targetIndex] = {
            ...updated[targetIndex],
            firstName: selectedFirstName,
            lastName: selectedLastName,
            license: selectedLicense,
            handicap: selectedHandicap,
          };
          
          console.log('Updated players:', JSON.stringify(updated));
          return updated;
        }
        
        console.log('Player index out of range:', playerIndex, 'array length:', prev.length);
        return prev;
      });
        
      setTimeout(() => {
        router.setParams({
          selectedPlayerIndex: undefined,
          selectedPlayerId: undefined,
          selectedPlayerFirstName: undefined,
          selectedPlayerLastName: undefined,
          selectedPlayerLicense: undefined,
          selectedPlayerHandicap: undefined,
        });
      }, 100);
    }
  }, [params.selectedPlayerIndex, params.selectedPlayerId, params.selectedPlayerFirstName, params.selectedPlayerLastName, params.selectedPlayerLicense, params.selectedPlayerHandicap, router]);









  const handleUpdatePlayer = (id: string, field: 'firstName' | 'lastName' | 'handicap', value: string) => {
    setPlayers(players.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
  };



  const handleSearchLicense = (playerIndex: string) => {
    const allPlayersData = players.map(p => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      license: p.license || '',
      handicap: p.handicap || '',
    }));
    
    router.push({
      pathname: '/free-play/search-license',
      params: {
        playerIndex,
        numberOfPlayers: params.numberOfPlayers,
        existingPlayers: JSON.stringify(allPlayersData),
        courseUuid: params.courseUuid,
        routeUuid: params.routeUuid,
        courseName: params.courseName,
        routeName: params.routeName,
        gameName: params.gameName,
        isPrivate: params.isPrivate,
        gamePassword: params.gamePassword,
      },
    });
  };

  const handleNext = async () => {
    const validPlayers = players.filter((p) => p.firstName.trim() && p.lastName.trim());
    
    if (validPlayers.length === 0) {
      Alert.alert('Error', 'Debes añadir al menos un jugador con nombre y apellido');
      return;
    }

    console.log('=== SAVING PLAYERS TO FIREBASE ===');
    console.log('[FreePlay] Going to select device player with valid players:', validPlayers);
    console.log('[FreePlay] Course:', params.courseName);
    console.log('[FreePlay] Route:', params.routeName);
    console.log('[FreePlay] Game:', params.gameName);
    console.log('[FreePlay] All params:', JSON.stringify(params, null, 2));
    
    if (!params.courseUuid) {
      Alert.alert('Error', 'Faltan datos del campo. Por favor, vuelve atrás y selecciona de nuevo.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
      return;
    }

    if (params.courseName && params.routeName) {
      setCourseInfo(params.courseName, params.routeName);
    }

    const playersData = validPlayers.map(p => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      handicap: p.handicap || '0',
      license: p.license,
    }));

    setIsSaving(true);
    let sessionUuid: string | undefined;
    try {
      const session = await createFreePlayGame(
        params.courseUuid,
        [],
        { routeUuid: params.routeUuid || undefined, gameName: params.gameName }
      );
      sessionUuid = session.uuid;
      console.log('[FreePlay] ✅ Session created successfully, uuid:', sessionUuid);
    } catch (error) {
      console.error('[FreePlay] ❌ Error creating session:', error);
      if ((error as Error)?.message === 'SESSION_EXPIRED') {
        Alert.alert(
          'Sesión expirada',
          'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.',
          [{ text: 'Iniciar sesión', onPress: () => router.replace('/player-area/login') }]
        );
        setIsSaving(false);
        return;
      }
      Alert.alert('Error', 'No se pudo crear la partida. Verifica tu conexión a internet.', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Continuar sin guardar', onPress: () => proceedToNextScreen(playersData, undefined) },
      ]);
      setIsSaving(false);
      return;
    } finally {
      setIsSaving(false);
    }

    if (isAuthenticated) {
      router.push({
        pathname: '/free-play/waiting-players',
        params: {
          players: JSON.stringify(playersData),
          sessionUuid: sessionUuid ?? '',
          devicePlayerId: playersData[0]?.id ?? '1',
          courseName: params.courseName,
          routeName: params.routeName,
          gameName: params.gameName,
          isPrivate: params.isPrivate,
          gamePassword: params.gamePassword,
        },
      });
    } else {
      proceedToNextScreen(playersData, sessionUuid);
    }
  };

  const proceedToNextScreen = (playersData: { id: string; firstName: string; lastName: string; handicap: string; license?: string }[], sessionUuid: string | undefined) => {
    router.push({
      pathname: '/free-play/select-device-player',
      params: {
        players: JSON.stringify(playersData),
        sessionUuid: sessionUuid ?? '',
        courseUuid: params.courseUuid,
        routeUuid: params.routeUuid,
        courseName: params.courseName,
        routeName: params.routeName,
        gameName: params.gameName,
        isPrivate: params.isPrivate,
        gamePassword: params.gamePassword,
      },
    });
  };

  const handleCancel = () => {
    console.log('[FreePlay] Canceling game setup...');
    resetFreePlay();
    router.replace('/');
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Configurar Jugadores',
          headerStyle: { backgroundColor: Colors.golf.headerBg },
          headerTintColor: '#FFFFFF',
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Users size={48} color={Colors.golf.primary} />
          <Text style={styles.title}>Datos de Jugadores</Text>
          <Text style={styles.subtitle}>
            Introduce el nombre y apellido de cada jugador
          </Text>
        </View>

        <View style={styles.playersContainer}>
          {players.map((player, index) => (
            <PlayerCard
              key={player.id}
              index={index}
              firstName={player.firstName}
              lastName={player.lastName}
              license={player.license}
              handicap={player.handicap}
              status={undefined}
              isCompetition={false}
              onChangeFirstName={(text) => handleUpdatePlayer(player.id, 'firstName', text)}
              onChangeLastName={(text) => handleUpdatePlayer(player.id, 'lastName', text)}
              onChangeHandicap={(text) => handleUpdatePlayer(player.id, 'handicap', text)}
              onSearchLicense={() => handleSearchLicense(`${index + 1}`)}
              onMarkReady={() => {}}
              onMarkNotPresent={() => {}}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.nextButton, isSaving && styles.nextButtonDisabled]}
          onPress={handleNext}
          disabled={isSaving}
          testID="next-button"
        >
          {isSaving ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.nextButtonText}>Siguiente</Text>
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
    gap: 24,
  },
  header: {
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontFamily: FontFamily.heading,
    fontSize: 26,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  subtitle: {
    fontFamily: FontFamily.body,
    fontSize: 15,
    color: Colors.golf.textLight,
    textAlign: 'center',
    lineHeight: 21,
  },
  playersContainer: {
    gap: 24,
  },
  nextButton: {
    backgroundColor: Colors.golf.primary,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: Colors.golf.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextButtonText: {
    fontFamily: FontFamily.bodyBold,
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  nextButtonDisabled: {
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
    fontFamily: FontFamily.bodyBold,
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.golf.textLight,
  },
});
