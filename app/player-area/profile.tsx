import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, Alert, Modal, FlatList,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ChevronDown, Check, X } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/Typography';
import { usePlayerAuth } from '@/providers/PlayerAuthProvider';
import {
  updateProfile, createLicense, updateLicense, deleteLicense,
  getGolfFederations, lookupFederationHandicap, UserLicense, GolfFederation,
} from '@/services/user-service';

type Tab = 'personal' | 'golf';

const GENDER_OPTIONS = [
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Femenino' },
  { value: 'other', label: 'Otro' },
  { value: 'not_specified', label: 'No especificado' },
  { value: 'prefer_not_to_say', label: 'Prefiero no decirlo' },
];

const LANGUAGE_OPTIONS = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'ca', label: 'Català' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'it', label: 'Italiano' },
  { value: 'pt', label: 'Português' },
];

interface SelectModalProps {
  visible: boolean;
  title: string;
  options: { value: string; label: string }[];
  selected: string | null;
  onSelect: (value: string) => void;
  onClose: () => void;
}

function SelectModal({ visible, title, options, selected, onSelect, onClose }: SelectModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <X size={20} color={Colors.golf.textLight} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item.value}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={modalStyles.option}
                onPress={() => { onSelect(item.value); onClose(); }}
              >
                <Text style={modalStyles.optionText}>{item.label}</Text>
                {selected === item.value && <Check size={16} color={Colors.golf.primary} />}
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

interface LicenseFormProps {
  federations: GolfFederation[];
  onSave: (data: { license_number: string; golf_federation_uuid: string; handicap: number | null }) => void;
  onCancel: () => void;
  initial?: UserLicense | null;
}

function LicenseForm({ federations, onSave, onCancel, initial }: LicenseFormProps) {
  const [licenseNumber, setLicenseNumber] = useState(initial?.license_number ?? '');
  const [selectedFed, setSelectedFed] = useState<GolfFederation | null>(
    initial ? federations.find((f) => f.uuid === initial.golf_federation_uuid) ?? null : null
  );
  const [handicap, setHandicap] = useState(initial?.handicap != null ? String(initial.handicap) : '');
  const [fedPickerVisible, setFedPickerVisible] = useState(false);
  const [fetchingHandicap, setFetchingHandicap] = useState(false);

  // Auto-fetch handicap from federation API after 800 ms of inactivity
  useEffect(() => {
    const trimmed = licenseNumber.trim();
    if (trimmed.length < 3 || !selectedFed) return;
    const timer = setTimeout(async () => {
      setFetchingHandicap(true);
      const value = await lookupFederationHandicap(trimmed, selectedFed.code);
      if (value != null) setHandicap(String(value));
      setFetchingHandicap(false);
    }, 800);
    return () => clearTimeout(timer);
  }, [licenseNumber, selectedFed]);

  const fedOptions = federations.map((f) => ({ value: f.uuid, label: `${f.name} (${f.code})` }));

  return (
    <View style={licenseFormStyles.container}>
      <View style={licenseFormStyles.header}>
        <Text style={licenseFormStyles.title}>{initial ? 'Editar licencia' : 'Nueva licencia'}</Text>
      </View>

      <Text style={styles.fieldLabel}>Federación</Text>
      <TouchableOpacity style={styles.selectButton} onPress={() => setFedPickerVisible(true)}>
        <Text style={selectedFed ? styles.selectText : styles.selectPlaceholder}>
          {selectedFed ? `${selectedFed.name} (${selectedFed.code})` : 'Selecciona federación'}
        </Text>
        <ChevronDown size={16} color={Colors.golf.textLight} />
      </TouchableOpacity>

      <Text style={styles.fieldLabel}>Número de licencia</Text>
      <TextInput
        style={styles.input}
        value={licenseNumber}
        onChangeText={setLicenseNumber}
        placeholder="Ej. 12345678A"
        placeholderTextColor={Colors.golf.textMuted}
        autoCapitalize="characters"
      />

      <View style={licenseFormStyles.handicapLabelRow}>
        <Text style={styles.fieldLabel}>Hándicap</Text>
        {fetchingHandicap && <ActivityIndicator size="small" color={Colors.golf.primary} />}
      </View>
      <TextInput
        style={styles.input}
        value={handicap}
        onChangeText={setHandicap}
        placeholder={fetchingHandicap ? 'Buscando…' : 'Ej. 18.4'}
        placeholderTextColor={Colors.golf.textMuted}
        keyboardType="decimal-pad"
        editable={!fetchingHandicap}
      />

      <View style={licenseFormStyles.actions}>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={onCancel}>
          <Text style={styles.btnSecondaryText}>Cancelar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnPrimary]}
          onPress={() => {
            if (!licenseNumber.trim() || !selectedFed) return;
            onSave({
              license_number: licenseNumber.trim(),
              golf_federation_uuid: selectedFed.uuid,
              handicap: handicap ? parseFloat(handicap) : 0,
            });
          }}
        >
          <Text style={styles.btnPrimaryText}>Guardar</Text>
        </TouchableOpacity>
      </View>

      <SelectModal
        visible={fedPickerVisible}
        title="Selecciona federación"
        options={fedOptions}
        selected={selectedFed?.uuid ?? null}
        onSelect={(uuid) => setSelectedFed(federations.find((f) => f.uuid === uuid) ?? null)}
        onClose={() => setFedPickerVisible(false)}
      />
    </View>
  );
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, userProfile, userLicenses, updateCachedProfile, updateCachedLicenses } = usePlayerAuth();
  const [tab, setTab] = useState<Tab>('personal');
  const [saving, setSaving] = useState(false);

  // Personal tab fields
  const [firstName, setFirstName] = useState(userProfile?.first_name ?? '');
  const [lastName, setLastName] = useState(userProfile?.last_name ?? '');
  const [phone, setPhone] = useState(userProfile?.phone_number ?? '');
  const [dob, setDob] = useState(userProfile?.dob ?? '');
  const [genderPickerVisible, setGenderPickerVisible] = useState(false);
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [gender, setGender] = useState(userProfile?.gender ?? '');
  const [language, setLanguage] = useState(userProfile?.language ?? '');

  // Golf tab
  const [federations, setFederations] = useState<GolfFederation[]>([]);
  const [fedLoading, setFedLoading] = useState(false);
  const [showLicenseForm, setShowLicenseForm] = useState(false);
  const [editingLicense, setEditingLicense] = useState<UserLicense | null>(null);

  useEffect(() => {
    if (userProfile) {
      setFirstName(userProfile.first_name ?? '');
      setLastName(userProfile.last_name ?? '');
      setPhone(userProfile.phone_number ?? '');
      setDob(userProfile.dob ?? '');
      setGender(userProfile.gender ?? '');
      setLanguage(userProfile.language ?? '');
    }
  }, [userProfile]);

  const loadFederations = useCallback(async () => {
    if (federations.length > 0) return;
    setFedLoading(true);
    try {
      const feds = await getGolfFederations();
      setFederations(feds);
    } catch {}
    finally { setFedLoading(false); }
  }, [federations.length]);

  useEffect(() => {
    if (tab === 'golf') loadFederations();
  }, [tab, loadFederations]);

  const handleSavePersonal = async () => {
    if (!userProfile?.uuid) return;
    setSaving(true);
    try {
      const updated = await updateProfile(userProfile.uuid, {
        first_name: firstName,
        last_name: lastName,
        phone_number: phone || null,
        dob: dob || null,
        gender: gender || null,
        language: language || null,
      } as any);
      // Backend response is the source of truth — update cache and context directly
      await updateCachedProfile(updated);
      Alert.alert('Guardado', 'Perfil actualizado correctamente.');
    } catch {
      Alert.alert('Error', 'No se pudo guardar el perfil.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateLicense = async (data: { license_number: string; golf_federation_uuid: string; handicap: number | null }) => {
    try {
      const lic = await createLicense(data);
      await updateCachedLicenses([...userLicenses, lic]);
      setShowLicenseForm(false);
    } catch (err) {
      const msg = (err as Error)?.message;
      Alert.alert('Error', msg && !msg.startsWith('HTTP') ? msg : 'No se pudo crear la licencia. Verifica los datos e inténtalo de nuevo.');
    }
  };

  const handleUpdateLicense = async (data: { license_number: string; golf_federation_uuid: string; handicap: number | null }) => {
    if (!editingLicense) return;
    try {
      const updated = await updateLicense(editingLicense.uuid, data);
      await updateCachedLicenses(userLicenses.map((l) => l.uuid === updated.uuid ? updated : l));
      setEditingLicense(null);
    } catch {
      Alert.alert('Error', 'No se pudo actualizar la licencia.');
    }
  };

  const handleDeleteLicense = (lic: UserLicense) => {
    Alert.alert(
      'Eliminar licencia',
      `¿Seguro que quieres eliminar la licencia ${lic.license_number}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar', style: 'destructive',
          onPress: async () => {
            try {
              await deleteLicense(lic.uuid);
              await updateCachedLicenses(userLicenses.filter((l) => l.uuid !== lic.uuid));
            } catch {
              Alert.alert('Error', 'No se pudo eliminar la licencia.');
            }
          },
        },
      ]
    );
  };

  const genderLabel = GENDER_OPTIONS.find((g) => g.value === gender)?.label ?? 'No especificado';
  const languageLabel = LANGUAGE_OPTIONS.find((l) => l.value === language)?.label ?? 'No especificado';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: 'Mi Perfil',
        headerStyle: { backgroundColor: Colors.golf.headerBg },
        headerTintColor: '#FFFFFF',
      }} />

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, tab === 'personal' && styles.tabActive]}
          onPress={() => setTab('personal')}
        >
          <Text style={[styles.tabText, tab === 'personal' && styles.tabTextActive]}>Personal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'golf' && styles.tabActive]}
          onPress={() => setTab('golf')}
        >
          <Text style={[styles.tabText, tab === 'golf' && styles.tabTextActive]}>Golf</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'personal' ? (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Datos personales</Text>

              <Text style={styles.fieldLabel}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Nombre"
                placeholderTextColor={Colors.golf.textMuted}
              />

              <Text style={styles.fieldLabel}>Apellidos</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Apellidos"
                placeholderTextColor={Colors.golf.textMuted}
              />

              <Text style={styles.fieldLabel}>Teléfono</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+34 600 000 000"
                placeholderTextColor={Colors.golf.textMuted}
                keyboardType="phone-pad"
              />

              <Text style={styles.fieldLabel}>Fecha de nacimiento</Text>
              <TextInput
                style={styles.input}
                value={dob}
                onChangeText={setDob}
                placeholder="AAAA-MM-DD"
                placeholderTextColor={Colors.golf.textMuted}
              />

              <Text style={styles.fieldLabel}>Género</Text>
              <TouchableOpacity style={styles.selectButton} onPress={() => setGenderPickerVisible(true)}>
                <Text style={gender ? styles.selectText : styles.selectPlaceholder}>{genderLabel}</Text>
                <ChevronDown size={16} color={Colors.golf.textLight} />
              </TouchableOpacity>

              <Text style={styles.fieldLabel}>Idioma</Text>
              <TouchableOpacity style={styles.selectButton} onPress={() => setLangPickerVisible(true)}>
                <Text style={language ? styles.selectText : styles.selectPlaceholder}>{languageLabel}</Text>
                <ChevronDown size={16} color={Colors.golf.textLight} />
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Cuenta</Text>
              <View style={styles.readonlyRow}>
                <Text style={styles.readonlyLabel}>Email</Text>
                <Text style={styles.readonlyValue}>{session?.email ?? '—'}</Text>
              </View>
              <View style={[styles.readonlyRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.readonlyLabel}>Miembro desde</Text>
                <Text style={styles.readonlyValue}>
                  {userProfile?.date_joined ? new Date(userProfile.date_joined).getFullYear().toString() : '—'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, saving && styles.btnDisabled]}
              onPress={handleSavePersonal}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.btnPrimaryText}>Guardar cambios</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View>
            {/* Licenses */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Licencias federativas</Text>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => { setEditingLicense(null); setShowLicenseForm(true); }}
                >
                  <Plus size={16} color={Colors.golf.primary} />
                  <Text style={styles.addBtnText}>Añadir</Text>
                </TouchableOpacity>
              </View>

              {fedLoading ? (
                <ActivityIndicator color={Colors.golf.primary} style={{ marginVertical: 16 }} />
              ) : userLicenses.length === 0 ? (
                <Text style={styles.emptyText}>No tienes licencias registradas.</Text>
              ) : (
                userLicenses.map((lic, idx) => (
                  <View key={lic.uuid}>
                    {idx > 0 && <View style={styles.separator} />}
                    <View style={styles.licenseRow}>
                      <View style={styles.licenseInfo}>
                        <Text style={styles.licenseFed}>{lic.golf_federation_name} ({lic.golf_federation_code})</Text>
                        <Text style={styles.licenseNumber}>{lic.license_number}</Text>
                        {lic.handicap != null && (
                          <Text style={styles.licenseHandicap}>Hándicap: {lic.handicap}</Text>
                        )}
                      </View>
                      <View style={styles.licenseActions}>
                        <TouchableOpacity
                          style={styles.licenseActionBtn}
                          onPress={() => { setEditingLicense(lic); setShowLicenseForm(true); }}
                        >
                          <Text style={styles.licenseActionEdit}>Editar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.licenseActionBtn}
                          onPress={() => handleDeleteLicense(lic)}
                        >
                          <Trash2 size={16} color={Colors.golf.error} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                ))
              )}
            </View>

            {showLicenseForm && (
              <LicenseForm
                federations={federations}
                initial={editingLicense}
                onSave={editingLicense ? handleUpdateLicense : handleCreateLicense}
                onCancel={() => { setShowLicenseForm(false); setEditingLicense(null); }}
              />
            )}
          </View>
        )}
      </ScrollView>

      <SelectModal
        visible={genderPickerVisible}
        title="Género"
        options={GENDER_OPTIONS}
        selected={gender || null}
        onSelect={setGender}
        onClose={() => setGenderPickerVisible(false)}
      />
      <SelectModal
        visible={langPickerVisible}
        title="Idioma"
        options={LANGUAGE_OPTIONS}
        selected={language || null}
        onSelect={setLanguage}
        onClose={() => setLangPickerVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.golf.background },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.golf.border,
  },
  tab: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: Colors.golf.primary },
  tabText: {
    fontSize: FontSize.bodyM, fontFamily: FontFamily.bodyMedium, color: Colors.golf.textLight,
  },
  tabTextActive: { fontFamily: FontFamily.bodySemi, color: Colors.golf.primary },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16,
    marginBottom: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  cardTitle: {
    fontSize: FontSize.bodyM, fontFamily: FontFamily.headingSemi,
    color: Colors.golf.text, marginBottom: 16,
  },
  cardHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  fieldLabel: {
    fontSize: FontSize.caption, fontFamily: FontFamily.bodySemi,
    color: Colors.golf.textLight, marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  input: {
    borderWidth: 1, borderColor: Colors.golf.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: FontSize.bodyM, fontFamily: FontFamily.body,
    color: Colors.golf.text, marginBottom: 14, backgroundColor: Colors.golf.background,
  },
  selectButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: Colors.golf.border,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 14, backgroundColor: Colors.golf.background,
  },
  selectText: {
    fontSize: FontSize.bodyM, fontFamily: FontFamily.body, color: Colors.golf.text,
  },
  selectPlaceholder: {
    fontSize: FontSize.bodyM, fontFamily: FontFamily.body, color: Colors.golf.textMuted,
  },
  readonlyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.golf.border,
  },
  readonlyLabel: {
    fontSize: FontSize.bodyM, fontFamily: FontFamily.body, color: Colors.golf.textLight,
  },
  readonlyValue: {
    fontSize: FontSize.bodyM, fontFamily: FontFamily.bodySemi, color: Colors.golf.text,
  },
  btn: {
    borderRadius: 12, paddingVertical: 14, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 8,
  },
  btnPrimary: { backgroundColor: Colors.golf.primary, marginBottom: 12 },
  btnSecondary: {
    borderWidth: 1, borderColor: Colors.golf.border,
    backgroundColor: '#FFFFFF', flex: 1, marginRight: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { fontSize: FontSize.bodyM, fontFamily: FontFamily.bodySemi, color: '#FFFFFF' },
  btnSecondaryText: {
    fontSize: FontSize.bodyM, fontFamily: FontFamily.bodySemi, color: Colors.golf.text,
  },
  separator: {
    height: StyleSheet.hairlineWidth, backgroundColor: Colors.golf.border, marginVertical: 4,
  },
  emptyText: {
    fontSize: FontSize.bodyS, fontFamily: FontFamily.body,
    color: Colors.golf.textMuted, textAlign: 'center', paddingVertical: 12,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.golf.primarySoft, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  addBtnText: {
    fontSize: FontSize.bodyS, fontFamily: FontFamily.bodySemi, color: Colors.golf.primary,
  },
  licenseRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  licenseInfo: { flex: 1 },
  licenseFed: {
    fontSize: FontSize.bodyS, fontFamily: FontFamily.bodySemi, color: Colors.golf.textLight,
  },
  licenseNumber: {
    fontSize: FontSize.bodyM, fontFamily: FontFamily.heading, color: Colors.golf.text, marginTop: 2,
  },
  licenseHandicap: {
    fontSize: FontSize.bodyS, fontFamily: FontFamily.body, color: Colors.golf.primary, marginTop: 2,
  },
  licenseActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  licenseActionBtn: { padding: 4 },
  licenseActionEdit: {
    fontSize: FontSize.bodyS, fontFamily: FontFamily.bodySemi, color: Colors.golf.primary,
  },
});

const licenseFormStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 16, marginBottom: 16,
    borderWidth: 1, borderColor: Colors.golf.primary + '30',
  },
  header: { marginBottom: 16 },
  title: {
    fontSize: FontSize.bodyM, fontFamily: FontFamily.headingSemi, color: Colors.golf.text,
  },
  handicapLabelRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6,
  },
  actions: { flexDirection: 'row', marginTop: 4 },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: 32, maxHeight: '70%',
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.golf.border,
  },
  title: {
    fontSize: FontSize.bodyL, fontFamily: FontFamily.headingSemi, color: Colors.golf.text,
  },
  option: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.golf.border,
  },
  optionText: {
    fontSize: FontSize.bodyM, fontFamily: FontFamily.body, color: Colors.golf.text,
  },
});
