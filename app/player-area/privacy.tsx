import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Política de Privacidad',
          headerStyle: { backgroundColor: Colors.golf.background },
          headerTintColor: Colors.golf.text,
        }}
      />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 24) }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Política de Privacidad</Text>
        <Text style={styles.date}>Última actualización: Febrero 2026</Text>

        <Text style={styles.sectionTitle}>1. Información que Recopilamos</Text>
        <Text style={styles.paragraph}>
          Recopilamos información que usted nos proporciona directamente al crear una cuenta, como su nombre, dirección de correo electrónico y país de residencia. También recopilamos información sobre su uso de la Aplicación, incluyendo puntuaciones de golf y participación en competiciones.
        </Text>

        <Text style={styles.sectionTitle}>2. Uso de la Información</Text>
        <Text style={styles.paragraph}>
          Utilizamos la información recopilada para proporcionar, mantener y mejorar la Aplicación, así como para personalizar su experiencia de usuario y comunicarnos con usted sobre actualizaciones y novedades del servicio.
        </Text>

        <Text style={styles.sectionTitle}>3. Compartir Información</Text>
        <Text style={styles.paragraph}>
          No compartimos su información personal con terceros, excepto cuando sea necesario para proporcionar el servicio, cumplir con obligaciones legales o proteger nuestros derechos.
        </Text>

        <Text style={styles.sectionTitle}>4. Almacenamiento de Datos</Text>
        <Text style={styles.paragraph}>
          Sus datos se almacenan de forma segura en servidores protegidos. Implementamos medidas de seguridad técnicas y organizativas para proteger su información contra accesos no autorizados.
        </Text>

        <Text style={styles.sectionTitle}>5. Sus Derechos</Text>
        <Text style={styles.paragraph}>
          Usted tiene derecho a acceder, rectificar, eliminar y portar sus datos personales. También puede oponerse al tratamiento de sus datos o solicitar la limitación del mismo. Para ejercer estos derechos, contacte con nosotros a través de la Aplicación.
        </Text>

        <Text style={styles.sectionTitle}>6. Cookies y Tecnologías Similares</Text>
        <Text style={styles.paragraph}>
          La Aplicación puede utilizar tecnologías de seguimiento para mejorar la experiencia del usuario y analizar el uso del servicio.
        </Text>

        <Text style={styles.sectionTitle}>7. Cambios en esta Política</Text>
        <Text style={styles.paragraph}>
          Podemos actualizar esta Política de Privacidad periódicamente. Le notificaremos sobre cambios significativos a través de la Aplicación o por correo electrónico.
        </Text>

        <Text style={styles.sectionTitle}>8. Contacto</Text>
        <Text style={styles.paragraph}>
          Si tiene preguntas sobre esta Política de Privacidad, puede contactarnos a través de la Aplicación o por correo electrónico.
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
