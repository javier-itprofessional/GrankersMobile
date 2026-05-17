import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import {
  Bell, Lock, Shield, ChevronRight, Smartphone, Globe, Moon,
} from 'lucide-react-native';
import Colors from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/Typography';

interface ToggleRowProps {
  label: string;
  subtitle?: string;
  value: boolean;
  onToggle: (v: boolean) => void;
}

function ToggleRow({ label, subtitle, value, onToggle }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: Colors.golf.border, true: Colors.golf.primary + '80' }}
        thumbColor={value ? Colors.golf.primary : Colors.golf.textMuted}
      />
    </View>
  );
}

interface NavRowProps {
  label: string;
  subtitle?: string;
  onPress: () => void;
}

function NavRow({ label, subtitle, onPress }: NavRowProps) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <ChevronRight size={16} color={Colors.golf.border} />
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Notification preferences (local state only — no backend endpoint yet)
  const [notifCompetitions, setNotifCompetitions] = useState(true);
  const [notifResults, setNotifResults] = useState(true);
  const [notifTournaments, setNotifTournaments] = useState(true);
  const [notifMarketing, setNotifMarketing] = useState(false);

  // App preferences
  const [darkMode, setDarkMode] = useState(false);

  const handleDeleteAccount = () => {
    Alert.alert(
      'Eliminar cuenta',
      'Esta acción es irreversible. Todos tus datos serán eliminados permanentemente. ¿Deseas continuar?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Confirmación final',
              'Para confirmar, escribe a soporte@grankers.com con el asunto "Eliminar cuenta".',
              [{ text: 'Entendido' }]
            ),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: 'Ajustes',
        headerStyle: { backgroundColor: Colors.golf.headerBg },
        headerTintColor: '#FFFFFF',
      }} />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Notifications */}
        <View style={styles.sectionHeader}>
          <Bell size={14} color={Colors.golf.textLight} />
          <Text style={styles.sectionTitle}>Notificaciones</Text>
        </View>
        <View style={styles.card}>
          <ToggleRow
            label="Competiciones"
            subtitle="Cambios en tus inscripciones y resultados"
            value={notifCompetitions}
            onToggle={setNotifCompetitions}
          />
          <View style={styles.separator} />
          <ToggleRow
            label="Resultados"
            subtitle="Cuando se publiquen tus puntuaciones"
            value={notifResults}
            onToggle={setNotifResults}
          />
          <View style={styles.separator} />
          <ToggleRow
            label="Torneos disponibles"
            subtitle="Nuevos eventos en tus clubes"
            value={notifTournaments}
            onToggle={setNotifTournaments}
          />
          <View style={styles.separator} />
          <ToggleRow
            label="Comunicaciones"
            subtitle="Novedades y promociones de Grankers"
            value={notifMarketing}
            onToggle={setNotifMarketing}
          />
        </View>

        {/* App preferences */}
        <View style={styles.sectionHeader}>
          <Smartphone size={14} color={Colors.golf.textLight} />
          <Text style={styles.sectionTitle}>Aplicación</Text>
        </View>
        <View style={styles.card}>
          <ToggleRow
            label="Modo oscuro"
            subtitle="Tema oscuro para la interfaz"
            value={darkMode}
            onToggle={setDarkMode}
          />
          <View style={styles.separator} />
          <NavRow
            label="Idioma"
            subtitle="Gestiona tu idioma en el perfil"
            onPress={() => router.push('/player-area/profile')}
          />
        </View>

        {/* Privacy */}
        <View style={styles.sectionHeader}>
          <Shield size={14} color={Colors.golf.textLight} />
          <Text style={styles.sectionTitle}>Privacidad y seguridad</Text>
        </View>
        <View style={styles.card}>
          <NavRow
            label="Política de privacidad"
            onPress={() => router.push('/player-area/privacy')}
          />
          <View style={styles.separator} />
          <NavRow
            label="Términos de uso"
            onPress={() => router.push('/player-area/terms')}
          />
          <View style={styles.separator} />
          <NavRow
            label="Mis datos"
            subtitle="Descarga una copia de tus datos"
            onPress={() =>
              Alert.alert(
                'Exportar datos',
                'Envíanos un email a soporte@grankers.com con el asunto "Exportar datos".',
                [{ text: 'Entendido' }]
              )
            }
          />
        </View>

        {/* Danger zone */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.dangerRow} onPress={handleDeleteAccount} activeOpacity={0.7}>
            <Text style={styles.dangerText}>Eliminar cuenta</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.versionText}>Grankers Mobile · v1.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.golf.background },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginBottom: 8, marginLeft: 4,
  },
  sectionTitle: {
    fontSize: 11, fontFamily: FontFamily.bodySemi,
    color: Colors.golf.textLight, textTransform: 'uppercase', letterSpacing: 0.8,
  },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
  },
  rowText: { flex: 1, paddingRight: 8 },
  rowLabel: {
    fontSize: FontSize.bodyM, fontFamily: FontFamily.bodyMedium, color: Colors.golf.text,
  },
  rowSubtitle: {
    fontSize: FontSize.caption, fontFamily: FontFamily.body,
    color: Colors.golf.textMuted, marginTop: 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth, backgroundColor: Colors.golf.border, marginLeft: 16,
  },
  dangerRow: { paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  dangerText: {
    fontSize: FontSize.bodyM, fontFamily: FontFamily.bodySemi, color: Colors.golf.error,
  },
  versionText: {
    fontSize: FontSize.caption, fontFamily: FontFamily.body,
    color: Colors.golf.textMuted, textAlign: 'center', marginBottom: 8,
  },
});
