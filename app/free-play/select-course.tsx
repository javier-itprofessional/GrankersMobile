import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, Modal } from 'react-native';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { MapPin, ChevronDown, ArrowRight, Search, Users, X } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { listCourses } from '@/services/course-service';
import { listFreePlayGames } from '@/services/game-service';

export default function SelectCourseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [courses, setCourses] = useState<string[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [routes, setRoutes] = useState<string[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<string>('');
  
  const [showCourseDropdown, setShowCourseDropdown] = useState<boolean>(false);
  const [showRouteDropdown, setShowRouteDropdown] = useState<boolean>(false);
  
  const [courseSearchText, setCourseSearchText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingRoutes, setLoadingRoutes] = useState<boolean>(false);
  
  const [showActiveGamesModal, setShowActiveGamesModal] = useState<boolean>(false);
  const [activeGames, setActiveGames] = useState<string[]>([]);
  const [checkingGames, setCheckingGames] = useState<boolean>(false);
  const [selectedGame, setSelectedGame] = useState<string>('');
  const [showGroupsModal, setShowGroupsModal] = useState<boolean>(false);
  const [groups, setGroups] = useState<string[]>([]);
  const [loadingGroups, setLoadingGroups] = useState<boolean>(false);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const data = await listCourses();
      setCourses(data.map((c) => c.name));
    } catch (error) {
      console.error('Error loading courses:', error);
      Alert.alert('Error', 'No se pudieron cargar los campos de golf');
    } finally {
      setLoading(false);
    }
  };

  const loadRoutes = async (courseName: string) => {
    try {
      setLoadingRoutes(true);
      const data = await listCourses();
      const course = data.find((c) => c.name === courseName);
      setRoutes(course ? course.routes.map((r) => r.name) : []);
    } catch (error) {
      console.error('Error loading routes:', error);
      Alert.alert('Error', 'No se pudieron cargar los recorridos');
    } finally {
      setLoadingRoutes(false);
    }
  };

  const handleSelectCourse = (courseName: string) => {
    console.log('Course selected:', courseName);
    setSelectedCourse(courseName);
    setShowCourseDropdown(false);
    setCourseSearchText('');
    setSelectedRoute('');
    setRoutes([]);
    loadRoutes(courseName);
  };

  const handleSelectRoute = (routeName: string) => {
    console.log('Route selected:', routeName);
    setSelectedRoute(routeName);
    setShowRouteDropdown(false);
  };

  const checkActiveGames = async () => {
    try {
      setCheckingGames(true);
      const games = await listFreePlayGames(selectedCourse, selectedRoute);
      if (games.length > 0) {
        setActiveGames(games.map((g) => g.gameName));
        setShowActiveGamesModal(true);
      } else {
        proceedToCreateGame();
      }
    } catch (error) {
      console.error('Error checking active games:', error);
      proceedToCreateGame();
    } finally {
      setCheckingGames(false);
    }
  };

  const proceedToCreateGame = () => {
    console.log('No active games found, proceeding to create game screen');
    router.push({
      pathname: '/free-play/create-game',
      params: { 
        courseName: selectedCourse,
        routeName: selectedRoute,
      },
    });
  };

  const loadGroups = async (gameName: string) => {
    try {
      setLoadingGroups(true);
      const games = await listFreePlayGames(selectedCourse, selectedRoute);
      const game = games.find((g) => g.gameName === gameName);
      setGroups(game?.groups ?? []);
    } catch (error) {
      console.error('Error loading groups:', error);
      Alert.alert('Error', 'No se pudieron cargar los grupos');
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleJoinGame = async (gameName: string) => {
    console.log('Selected game:', gameName);
    setSelectedGame(gameName);
    setShowActiveGamesModal(false);
    await loadGroups(gameName);
    setShowGroupsModal(true);
  };

  const handleSelectGroup = async (groupName: string) => {
    console.log('Selected existing group:', groupName);
    setShowGroupsModal(false);

    try {
      const { getActiveGamePlayers } = await import('@/services/game-service');
      const gamePlayers = await getActiveGamePlayers(selectedCourse, selectedRoute, selectedGame, groupName);

      if (gamePlayers) {
        const playersArray = gamePlayers;

        router.push({
          pathname: '/free-play/select-device-player',
          params: {
            players: JSON.stringify(playersArray),
            courseName: selectedCourse,
            routeName: selectedRoute,
            gameName: selectedGame,
            groupName,
          },
        });
      } else {
        Alert.alert('Error', 'No se encontraron jugadores en este grupo');
      }
    } catch (error) {
      console.error('Error loading group players:', error);
      Alert.alert('Error', 'No se pudieron cargar los jugadores del grupo');
    }
  };

  const handleCreateNewGroup = () => {
    console.log('Creating new group for existing game');
    setShowGroupsModal(false);
    
    router.push({
      pathname: '/free-play/create-game',
      params: {
        courseName: selectedCourse,
        routeName: selectedRoute,
        gameName: selectedGame,
        existingGame: 'true',
      },
    });
  };

  const handleCreateNewGame = () => {
    console.log('Creating new game');
    setShowActiveGamesModal(false);
    proceedToCreateGame();
  };

  const handleContinue = () => {
    if (!selectedCourse) {
      Alert.alert('Error', 'Debes seleccionar un campo de golf');
      return;
    }
    
    if (!selectedRoute) {
      Alert.alert('Error', 'Debes seleccionar un recorrido');
      return;
    }

    checkActiveGames();
  };

  const filteredCourses = courses.filter((course) =>
    course.toLowerCase().includes(courseSearchText.toLowerCase())
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          title: 'Selección de Recorrido',
          headerStyle: { backgroundColor: Colors.golf.headerBg },
          headerTintColor: '#FFFFFF',
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <MapPin size={48} color={Colors.golf.primary} />
          <Text style={styles.title}>Selecciona el Recorrido</Text>
          <Text style={styles.subtitle}>
            Elige el campo de golf y el recorrido para la partida
          </Text>
        </View>

        <View style={styles.selectorsContainer}>
          <View style={styles.dropdownContainer}>
            <Text style={styles.label}>Campo de Golf</Text>
            
            <TouchableOpacity
              style={[styles.dropdown, showCourseDropdown && styles.dropdownOpen]}
              onPress={() => {
                setShowCourseDropdown(!showCourseDropdown);
                setShowRouteDropdown(false);
              }}
              testID="course-dropdown"
            >
              <Text style={[styles.dropdownText, !selectedCourse && styles.dropdownPlaceholder]}>
                {selectedCourse || 'Selecciona un campo'}
              </Text>
              <ChevronDown size={20} color={Colors.golf.textLight} />
            </TouchableOpacity>

            {showCourseDropdown && (
              <View style={styles.dropdownMenu}>
                <View style={styles.searchContainer}>
                  <Search size={18} color={Colors.golf.textLight} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar campo..."
                    placeholderTextColor={Colors.golf.textLight}
                    value={courseSearchText}
                    onChangeText={setCourseSearchText}
                    testID="course-search-input"
                  />
                </View>
                
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={Colors.golf.primary} />
                    <Text style={styles.loadingText}>Cargando campos...</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                    {filteredCourses.length > 0 ? (
                      filteredCourses.map((course) => (
                        <TouchableOpacity
                          key={course}
                          style={[
                            styles.dropdownItem,
                            selectedCourse === course && styles.dropdownItemSelected,
                          ]}
                          onPress={() => handleSelectCourse(course)}
                          testID={`course-item-${course}`}
                        >
                          <Text style={styles.dropdownItemText}>{course}</Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No se encontraron campos</Text>
                      </View>
                    )}
                  </ScrollView>
                )}
              </View>
            )}
          </View>

          <View style={styles.dropdownContainer}>
            <Text style={styles.label}>Recorrido</Text>
            
            <TouchableOpacity
              style={[
                styles.dropdown,
                showRouteDropdown && styles.dropdownOpen,
                !selectedCourse && styles.dropdownDisabled,
              ]}
              onPress={() => {
                if (selectedCourse) {
                  setShowRouteDropdown(!showRouteDropdown);
                  setShowCourseDropdown(false);
                }
              }}
              disabled={!selectedCourse}
              testID="route-dropdown"
            >
              <Text style={[styles.dropdownText, !selectedRoute && styles.dropdownPlaceholder]}>
                {selectedRoute || (selectedCourse ? 'Selecciona un recorrido' : 'Primero selecciona un campo')}
              </Text>
              <ChevronDown size={20} color={Colors.golf.textLight} />
            </TouchableOpacity>

            {showRouteDropdown && (
              <View style={styles.dropdownMenu}>
                {loadingRoutes ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={Colors.golf.primary} />
                    <Text style={styles.loadingText}>Cargando recorridos...</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                    {routes.length > 0 ? (
                      routes.map((route) => (
                        <TouchableOpacity
                          key={route}
                          style={[
                            styles.dropdownItem,
                            selectedRoute === route && styles.dropdownItemSelected,
                          ]}
                          onPress={() => handleSelectRoute(route)}
                          testID={`route-item-${route}`}
                        >
                          <Text style={styles.dropdownItemText}>{route}</Text>
                        </TouchableOpacity>
                      ))
                    ) : (
                      <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>No se encontraron recorridos</Text>
                      </View>
                    )}
                  </ScrollView>
                )}
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.continueButton,
            (!selectedCourse || !selectedRoute || checkingGames) && styles.continueButtonDisabled,
          ]}
          onPress={handleContinue}
          disabled={!selectedCourse || !selectedRoute || checkingGames}
          testID="continue-button"
        >
          {checkingGames ? (
            <>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.continueButtonText}>Verificando partidas...</Text>
            </>
          ) : (
            <>
              <Text style={styles.continueButtonText}>Continuar</Text>
              <ArrowRight size={20} color="#FFFFFF" />
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showActiveGamesModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActiveGamesModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Users size={32} color={Colors.golf.primary} />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowActiveGamesModal(false)}
                testID="close-modal"
              >
                <X size={24} color={Colors.golf.textLight} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>Partidas Activas</Text>
            <Text style={styles.modalSubtitle}>
              Se han encontrado {activeGames.length} {activeGames.length === 1 ? 'partida activa' : 'partidas activas'} en este recorrido
            </Text>

            <TouchableOpacity
              style={styles.createNewButton}
              onPress={handleCreateNewGame}
              testID="create-new-game"
            >
              <Text style={styles.createNewButtonText}>Crear Partida Nueva</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <Text style={styles.gamesListTitle}>O únete a una partida existente:</Text>

            <ScrollView style={styles.gamesList}>
              {activeGames.map((gameName) => (
                <TouchableOpacity
                  key={gameName}
                  style={styles.gameItem}
                  onPress={() => handleJoinGame(gameName)}
                  testID={`join-game-${gameName}`}
                >
                  <View style={styles.gameItemContent}>
                    <Users size={20} color={Colors.golf.primary} />
                    <Text style={styles.gameItemText}>{gameName}</Text>
                  </View>
                  <ArrowRight size={18} color={Colors.golf.textLight} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showGroupsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGroupsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Users size={32} color={Colors.golf.primary} />
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowGroupsModal(false)}
                testID="close-groups-modal"
              >
                <X size={24} color={Colors.golf.textLight} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>Seleccionar Grupo</Text>
            <Text style={styles.modalSubtitle}>
              Únete a un grupo existente o crea uno nuevo para la partida &ldquo;{selectedGame}&rdquo;
            </Text>

            <TouchableOpacity
              style={styles.createNewButton}
              onPress={handleCreateNewGroup}
              testID="create-new-group"
            >
              <Text style={styles.createNewButtonText}>Crear Grupo Nuevo</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            <Text style={styles.gamesListTitle}>O únete a un grupo existente:</Text>

            {loadingGroups ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={Colors.golf.primary} />
                <Text style={styles.loadingText}>Cargando grupos...</Text>
              </View>
            ) : (
              <ScrollView style={styles.gamesList}>
                {groups.length > 0 ? (
                  groups.map((groupName) => (
                    <TouchableOpacity
                      key={groupName}
                      style={styles.gameItem}
                      onPress={() => handleSelectGroup(groupName)}
                      testID={`select-group-${groupName}`}
                    >
                      <View style={styles.gameItemContent}>
                        <Users size={20} color={Colors.golf.primary} />
                        <Text style={styles.gameItemText}>{groupName}</Text>
                      </View>
                      <ArrowRight size={18} color={Colors.golf.textLight} />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>No se encontraron grupos</Text>
                  </View>
                )}
              </ScrollView>
            )}
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
  selectorsContainer: {
    gap: 24,
  },
  dropdownContainer: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.text,
    marginLeft: 4,
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.golf.border,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dropdownOpen: {
    borderColor: Colors.golf.primary,
  },
  dropdownDisabled: {
    backgroundColor: '#F5F5F5',
    opacity: 0.6,
  },
  dropdownText: {
    fontSize: 16,
    color: Colors.golf.text,
    flex: 1,
  },
  dropdownPlaceholder: {
    color: Colors.golf.textLight,
  },
  dropdownMenu: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.golf.border,
    marginTop: 8,
    maxHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.golf.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.golf.text,
    padding: 0,
  },
  dropdownScroll: {
    maxHeight: 240,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.golf.border,
  },
  dropdownItemSelected: {
    backgroundColor: Colors.golf.primary + '10',
  },
  dropdownItemText: {
    fontSize: 15,
    color: Colors.golf.text,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 24,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.golf.textLight,
  },
  emptyContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.golf.textLight,
  },
  continueButton: {
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
  continueButtonDisabled: {
    backgroundColor: Colors.golf.textLight,
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
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
    maxWidth: 500,
    maxHeight: '80%',
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
    fontSize: 24,
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
  createNewButton: {
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
  createNewButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.golf.border,
    marginVertical: 24,
  },
  gamesListTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.golf.textLight,
    marginBottom: 12,
  },
  gamesList: {
    maxHeight: 200,
  },
  gameItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F8F9FA',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.golf.border,
  },
  gameItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  gameItemText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.golf.text,
  },
});
