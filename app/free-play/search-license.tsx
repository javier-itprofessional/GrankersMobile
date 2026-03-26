import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useState } from 'react';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { Search } from 'lucide-react-native';
import Colors from '../../constants/colors';
import { searchPlayerLicenses } from '@/config/firebase';
import SearchResultCard from '../../components/SearchResultCard';

interface LicensePlayer {
  licencia: string;
  nombre: string;
  apellido: string;
  handicap?: number;
}

export default function SearchLicenseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ 
    playerIndex: string; 
    numberOfPlayers?: string;
    existingPlayers?: string;
    courseName?: string;
    routeName?: string;
    gameName?: string;
    groupName?: string;
  }>();
  const playerIndex = params.playerIndex || '1';
  
  const [licencia, setLicencia] = useState('');
  const [nombre, setNombre] = useState('');
  const [apellido, setApellido] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<LicensePlayer[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!licencia.trim() && !nombre.trim() && !apellido.trim()) {
      Alert.alert('Error', 'Debes introducir al menos un criterio de búsqueda');
      return;
    }

    setSearching(true);
    setHasSearched(false);
    setResults([]);
    
    try {
      console.log('Searching with params:', {
        licencia: licencia.trim(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        codigoGrupo: 'GLOBAL'
      });
      
      const searchResults = await searchPlayerLicenses({
        licencia: licencia.trim(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        codigoGrupo: 'GLOBAL',
      });
      
      console.log('Search results:', searchResults);
      setResults(searchResults);
      
      if (searchResults.length === 0) {
        Alert.alert('Sin resultados', 'No se encontraron jugadores con esos criterios');
      }
    } catch (error) {
      console.error('Error searching licenses:', error);
      Alert.alert('Error', 'No se pudo buscar en la base de datos. Verifica tu conexión a internet.');
      setResults([]);
    } finally {
      setSearching(false);
      setHasSearched(true);
    }
  };

  const handleSelectPlayer = (player: LicensePlayer) => {
    console.log('Player selected:', player);
    console.log('Player index:', playerIndex);
    console.log('Existing players:', params.existingPlayers);
    
    let existingPlayersData = [];
    try {
      if (params.existingPlayers) {
        existingPlayersData = JSON.parse(params.existingPlayers);
        console.log('Parsed existing players:', existingPlayersData);
      }
    } catch (e) {
      console.error('Error parsing existing players:', e);
    }
    
    const updatedPlayers = existingPlayersData.map((p: any, index: number) => {
      if ((index + 1).toString() === playerIndex) {
        return {
          ...p,
          nombre: player.nombre,
          apellido: player.apellido,
          licencia: player.licencia,
          handicap: player.handicap?.toString() || '',
        };
      }
      return p;
    });
    
    console.log('Updated players with selection:', updatedPlayers);
    
    router.push({
      pathname: '/free-play/setup',
      params: {
        numberOfPlayers: params.numberOfPlayers,
        selectedPlayerIndex: playerIndex,
        selectedPlayerNombre: player.nombre,
        selectedPlayerApellido: player.apellido,
        selectedPlayerLicencia: player.licencia,
        selectedPlayerHandicap: player.handicap?.toString() || '',
        existingPlayers: JSON.stringify(updatedPlayers),
        courseName: params.courseName,
        routeName: params.routeName,
        gameName: params.gameName,
        groupName: params.groupName,
      },
    });
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: `Jugador ${playerIndex}`,
          headerStyle: { backgroundColor: Colors.golf.headerBg },
          headerTintColor: '#FFFFFF',
        }}
      />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.searchCard}>
          <View style={styles.searchHeader}>
            <Search size={32} color={Colors.golf.primary} />
            <Text style={styles.searchTitle}>Buscar Licencia</Text>
          </View>

          <View style={styles.inputsContainer}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Licencia</Text>
              <TextInput
                style={styles.input}
                placeholder="Introduce la licencia"
                value={licencia}
                onChangeText={setLicencia}
                autoCapitalize="characters"
                testID="licencia-input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nombre</Text>
              <TextInput
                style={styles.input}
                placeholder="Introduce el nombre"
                value={nombre}
                onChangeText={setNombre}
                testID="nombre-input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Apellido</Text>
              <TextInput
                style={styles.input}
                placeholder="Introduce el apellido"
                value={apellido}
                onChangeText={setApellido}
                testID="apellido-input"
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.searchButton,
              (!licencia.trim() && !nombre.trim() && !apellido.trim()) && styles.searchButtonDisabled,
            ]}
            onPress={handleSearch}
            disabled={!licencia.trim() && !nombre.trim() && !apellido.trim()}
            testID="search-button"
          >
            {searching ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Search size={20} color="#FFFFFF" />
                <Text style={styles.searchButtonText}>Buscar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {hasSearched && (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultsTitle}>
              {results.length > 0
                ? `${results.length} resultado${results.length !== 1 ? 's' : ''} encontrado${results.length !== 1 ? 's' : ''}`
                : 'No se encontraron resultados'}
            </Text>

            {results.map((player, index) => (
              <SearchResultCard
                key={`${player.licencia}-${index}`}
                nombre={player.nombre}
                apellido={player.apellido}
                licencia={player.licencia}
                handicap={player.handicap}
                onPress={() => handleSelectPlayer(player)}
                testID={`player-result-${index}`}
              />
            ))}
          </View>
        )}
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
    gap: 20,
  },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    gap: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.golf.text,
  },
  inputsContainer: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.golf.text,
  },
  input: {
    backgroundColor: Colors.golf.background,
    borderWidth: 1,
    borderColor: Colors.golf.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.golf.text,
  },
  searchButton: {
    backgroundColor: Colors.golf.primary,
    borderRadius: 12,
    paddingVertical: 16,
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
  searchButtonDisabled: {
    backgroundColor: Colors.golf.textLight,
    opacity: 0.5,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  resultsContainer: {
    gap: 12,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.golf.text,
    marginBottom: 8,
  },
});
