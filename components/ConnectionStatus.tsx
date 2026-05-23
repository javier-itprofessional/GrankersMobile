import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import type { BackendStatus } from '@/hooks/useBackendStatus';

export default function ConnectionStatus({ status }: { status: BackendStatus }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (status === 'reconnecting') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.35, duration: 650, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 650, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulseAnim.setValue(1);
  }, [status, pulseAnim]);

  if (status === 'online') {
    return (
      <View style={styles.onlinePill}>
        <View style={styles.onlineDot} />
        <Text style={styles.onlineText}>Online</Text>
      </View>
    );
  }

  return (
    <Animated.View
      style={[
        styles.pill,
        status === 'reconnecting' ? styles.reconnectingPill : styles.offlinePill,
        status === 'reconnecting' && { opacity: pulseAnim },
      ]}
    >
      <View style={[styles.dot, status === 'reconnecting' ? styles.reconnectingDot : styles.offlineDot]} />
      <Text style={styles.pillText}>
        {status === 'reconnecting' ? 'Reconectando' : 'Sin conexión'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#13ec5b',
  },
  onlineText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.3,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  reconnectingPill: {
    backgroundColor: 'rgba(245,158,11,0.25)',
  },
  offlinePill: {
    backgroundColor: 'rgba(239,68,68,0.25)',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  reconnectingDot: {
    backgroundColor: '#f59e0b',
  },
  offlineDot: {
    backgroundColor: '#ef4444',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    letterSpacing: 0.3,
  },
});
