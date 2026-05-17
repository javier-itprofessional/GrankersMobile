import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Calendar, MapPin, Trophy, Users } from 'lucide-react-native';
import Colors from '@/constants/colors';
import { FontFamily, FontSize } from '@/constants/Typography';
import { usePlayerAuth } from '@/providers/PlayerAuthProvider';
import { UpcomingEvent } from '@/services/user-service';

type Filter = 'all' | 'confirmed' | 'pending';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'confirmed', label: 'Confirmados' },
  { key: 'pending', label: 'Pendientes' },
];

function formatDate(iso: string | null): string {
  if (!iso) return 'Fecha por confirmar';
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function isPast(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

function statusColor(status: string): string {
  if (status === 'confirmed') return Colors.golf.success;
  if (status === 'pending') return Colors.golf.warning;
  if (status === 'cancelled') return Colors.golf.error;
  return Colors.golf.textLight;
}

function statusLabel(status: string): string {
  if (status === 'confirmed') return 'Confirmado';
  if (status === 'pending') return 'Pendiente';
  if (status === 'cancelled') return 'Cancelado';
  return status;
}

function paymentLabel(status: string): string {
  if (status === 'paid') return 'Pagado';
  if (status === 'pending') return 'Pago pendiente';
  if (status === 'free') return 'Gratuito';
  return status;
}

export default function ScorecardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { upcomingEvents, isLoading } = usePlayerAuth();
  const events = upcomingEvents;
  const loading = isLoading;
  const [filter, setFilter] = useState<Filter>('all');

  const filtered = events.filter((e) => {
    if (filter === 'all') return true;
    return e.status === filter;
  });

  const upcoming = filtered.filter((e) => !isPast(e.start_date));
  const past = filtered.filter((e) => isPast(e.start_date));

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: 'Mis Competiciones',
        headerStyle: { backgroundColor: Colors.golf.headerBg },
        headerTintColor: '#FFFFFF',
      }} />

      {/* Filter bar */}
      <View style={styles.filterBar}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.golf.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.centerBox}>
          <Trophy size={48} color={Colors.golf.border} strokeWidth={1} />
          <Text style={styles.emptyTitle}>Sin inscripciones</Text>
          <Text style={styles.emptySubtitle}>Aún no estás registrado en ninguna competición.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom + 24, 40) }]}
          showsVerticalScrollIndicator={false}
        >
          {upcoming.length > 0 && (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>Próximos</Text>
              {upcoming.map((ev) => (
                <EventCard key={ev.registration_uuid} event={ev} />
              ))}
            </View>
          )}
          {past.length > 0 && (
            <View style={styles.group}>
              <Text style={styles.groupTitle}>Historial</Text>
              {past.map((ev) => (
                <EventCard key={ev.registration_uuid} event={ev} past />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function EventCard({ event, past }: { event: UpcomingEvent; past?: boolean }) {
  return (
    <View style={[styles.card, past && styles.cardPast]}>
      <View style={styles.cardTop}>
        <View style={styles.cardTitleRow}>
          <Text style={styles.eventName} numberOfLines={2}>{event.event_name}</Text>
          <View style={[styles.statusDot, { backgroundColor: statusColor(event.status) }]} />
        </View>
        <Text style={styles.tourName}>{event.tour_name}</Text>
      </View>

      <View style={styles.cardMeta}>
        {event.start_date && (
          <View style={styles.metaRow}>
            <Calendar size={13} color={Colors.golf.textLight} />
            <Text style={styles.metaText}>{formatDate(event.start_date)}</Text>
          </View>
        )}
        {event.golf_club_name && (
          <View style={styles.metaRow}>
            <MapPin size={13} color={Colors.golf.textLight} />
            <Text style={styles.metaText}>{event.golf_club_name}</Text>
          </View>
        )}
        {!event.is_solo && event.team_name && (
          <View style={styles.metaRow}>
            <Users size={13} color={Colors.golf.textLight} />
            <Text style={styles.metaText}>{event.team_name}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <Text style={[styles.statusLabel, { color: statusColor(event.status) }]}>
          {statusLabel(event.status)}
        </Text>
        {event.fee_tier_name && (
          <Text style={styles.feeTier}>{event.fee_tier_name}</Text>
        )}
        {event.price_paid && (
          <Text style={styles.price}>{event.price_paid} €</Text>
        )}
        <Text style={styles.paymentStatus}>{paymentLabel(event.payment_status)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.golf.background },
  filterBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: '#FFFFFF', gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.golf.border,
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: Colors.golf.border,
    backgroundColor: Colors.golf.background,
  },
  filterChipActive: { backgroundColor: Colors.golf.primary, borderColor: Colors.golf.primary },
  filterText: {
    fontSize: FontSize.bodyS, fontFamily: FontFamily.bodyMedium, color: Colors.golf.textLight,
  },
  filterTextActive: { color: '#FFFFFF', fontFamily: FontFamily.bodySemi },
  centerBox: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, padding: 32,
  },
  emptyTitle: {
    fontSize: FontSize.bodyL, fontFamily: FontFamily.headingSemi, color: Colors.golf.textLight,
  },
  emptySubtitle: {
    fontSize: FontSize.bodyS, fontFamily: FontFamily.body,
    color: Colors.golf.textMuted, textAlign: 'center',
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },
  group: { marginBottom: 24 },
  groupTitle: {
    fontSize: 11, fontFamily: FontFamily.bodySemi,
    color: Colors.golf.textLight, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: 10, marginLeft: 2,
  },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 10, padding: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 1,
  },
  cardPast: { opacity: 0.75 },
  cardTop: { marginBottom: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  eventName: {
    flex: 1, fontSize: FontSize.bodyM, fontFamily: FontFamily.headingSemi,
    color: Colors.golf.text, marginRight: 8,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  tourName: {
    fontSize: FontSize.bodyS, fontFamily: FontFamily.body,
    color: Colors.golf.textLight, marginTop: 3,
  },
  cardMeta: { gap: 4, marginBottom: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: {
    fontSize: FontSize.bodyS, fontFamily: FontFamily.body, color: Colors.golf.textLight,
  },
  cardFooter: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.golf.border,
    flexWrap: 'wrap',
  },
  statusLabel: { fontSize: FontSize.caption, fontFamily: FontFamily.bodySemi },
  feeTier: {
    fontSize: FontSize.caption, fontFamily: FontFamily.body, color: Colors.golf.textMuted,
  },
  price: {
    fontSize: FontSize.caption, fontFamily: FontFamily.bodySemi, color: Colors.golf.text,
  },
  paymentStatus: {
    fontSize: FontSize.caption, fontFamily: FontFamily.body, color: Colors.golf.textMuted,
    marginLeft: 'auto',
  },
});
