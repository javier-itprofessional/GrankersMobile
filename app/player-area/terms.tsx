import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

export default function TermsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Términos de Uso',
          headerStyle: { backgroundColor: Colors.golf.background },
          headerTintColor: Colors.golf.text,
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Términos de Uso</Text>
        <Text style={styles.date}>Última actualización: Febrero 2026</Text>

        <Text style={styles.sectionTitle}>1. Aceptación de los Términos</Text>
        <Text style={styles.paragraph}>
          Al acceder y utilizar la aplicación Grankers ("la Aplicación"), usted acepta estar sujeto a estos Términos de Uso. Si no está de acuerdo con estos términos, no utilice la Aplicación.
        </Text>

        <Text style={styles.sectionTitle}>2. Descripción del Servicio</Text>
        <Text style={styles.paragraph}>
          Grankers es una aplicación de tarjeta de puntuación virtual para golf que permite a los usuarios registrar puntuaciones, participar en competiciones y gestionar su perfil de jugador.
        </Text>

        <Text style={styles.sectionTitle}>3. Registro de Cuenta</Text>
        <Text style={styles.paragraph}>
          Para utilizar ciertas funcionalidades de la Aplicación, deberá crear una cuenta proporcionando información precisa y completa. Usted es responsable de mantener la confidencialidad de su cuenta y contraseña.
        </Text>

        <Text style={styles.sectionTitle}>4. Uso Aceptable</Text>
        <Text style={styles.paragraph}>
          Usted se compromete a utilizar la Aplicación únicamente para fines legítimos y de acuerdo con estos Términos. No podrá utilizar la Aplicación de manera que pueda dañar, deshabilitar o perjudicar el servicio.
        </Text>

        <Text style={styles.sectionTitle}>5. Propiedad Intelectual</Text>
        <Text style={styles.paragraph}>
          Todo el contenido, diseño, gráficos, interfaces y código de la Aplicación son propiedad de Grankers y están protegidos por las leyes de propiedad intelectual aplicables.
        </Text>

        <Text style={styles.sectionTitle}>6. Limitación de Responsabilidad</Text>
        <Text style={styles.paragraph}>
          La Aplicación se proporciona "tal cual" sin garantías de ningún tipo. Grankers no será responsable de ningún daño directo, indirecto, incidental o consecuente derivado del uso de la Aplicación.
        </Text>

        <Text style={styles.sectionTitle}>7. Modificaciones</Text>
        <Text style={styles.paragraph}>
          Nos reservamos el derecho de modificar estos Términos en cualquier momento. Las modificaciones entrarán en vigor inmediatamente después de su publicación en la Aplicación.
        </Text>

        <Text style={styles.sectionTitle}>8. Contacto</Text>
        <Text style={styles.paragraph}>
          Si tiene preguntas sobre estos Términos de Uso, puede contactarnos a través de la Aplicación o por correo electrónico.
        </Text>
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
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '800' as const,
    color: Colors.golf.text,
    marginBottom: 6,
  },
  date: {
    fontSize: 13,
    fontWeight: '400' as const,
    color: Colors.golf.textLight,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.golf.text,
    marginBottom: 8,
    marginTop: 20,
  },
  paragraph: {
    fontSize: 15,
    fontWeight: '400' as const,
    color: Colors.golf.text,
    lineHeight: 24,
  },
});
