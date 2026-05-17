import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronDown, ChevronUp, Info } from 'lucide-react-native';
import { getCourseRouteData, type RouteData } from '@/services/course-service';
import Colors from '@/constants/colors';

interface Props {
  courseName: string;
  routeName: string;
  holeNumber: number;
}

export default function HoleInfoPanel({ courseName, routeName, holeNumber }: Props) {
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!courseName || !routeName) return;
    getCourseRouteData(courseName, routeName)
      .then(setRouteData)
      .catch(() => setRouteData(null));
  }, [courseName, routeName]);

  useEffect(() => {
    setExpanded(false);
  }, [holeNumber]);

  const holeData = routeData?.holes.find((h) => h.hole_number === holeNumber) ?? null;

  const hasData =
    holeData != null &&
    (holeData.distance_meters != null ||
      holeData.distance_yards != null ||
      holeData.elevation != null ||
      holeData.fairway_width != null ||
      holeData.fairway_length != null ||
      holeData.fairway_slope != null ||
      holeData.fairway_slope_percentage != null);

  if (!hasData || !holeData) return null;

  const distanceParts = [
    holeData.distance_meters != null ? `${holeData.distance_meters} m` : null,
    holeData.distance_yards != null ? `${holeData.distance_yards} yd` : null,
  ].filter(Boolean);

  const slopeLabel =
    holeData.fairway_slope != null
      ? `${holeData.fairway_slope > 0 ? '+' : ''}${holeData.fairway_slope}°` +
        (holeData.fairway_slope_percentage != null
          ? `  (${holeData.fairway_slope_percentage}%)`
          : '')
      : null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.trigger}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.8}
        testID="hole-info-trigger"
      >
        <Info size={13} color={Colors.golf.accent} />
        <Text style={styles.triggerText}>Info del hoyo</Text>
        {expanded ? (
          <ChevronUp size={14} color={Colors.golf.textDark} />
        ) : (
          <ChevronDown size={14} color={Colors.golf.textDark} />
        )}
      </TouchableOpacity>

      {expanded && (
        <View style={styles.body}>
          {distanceParts.length > 0 && (
            <Row label="Distancia" value={distanceParts.join('  ·  ')} />
          )}
          {holeData.elevation != null && (
            <Row
              label="Desnivel"
              value={`${holeData.elevation > 0 ? '+' : ''}${holeData.elevation} m`}
            />
          )}
          {holeData.fairway_length != null && (
            <Row label="Longitud calle" value={`${holeData.fairway_length} m`} />
          )}
          {holeData.fairway_width != null && (
            <Row label="Anchura calle" value={`${holeData.fairway_width} m`} />
          )}
          {slopeLabel != null && <Row label="Inclinación" value={slopeLabel} />}
        </View>
      )}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginBottom: 8,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: Colors.golf.primaryDark,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  triggerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: Colors.golf.textDark,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  body: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 7,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowLabel: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.65)',
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.golf.textDark,
  },
});
