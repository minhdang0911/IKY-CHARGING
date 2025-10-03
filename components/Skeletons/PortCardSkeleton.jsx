// components/Skeletons/PortCardSkeleton.jsx
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

export default function PortCardSkeleton() {
  const pulse = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View style={[styles.card, { opacity: pulse }]}>
      {/* title bar */}
      <View style={[styles.shimmer, { width: 180, height: 14, marginBottom: 10 }]} />

      {/* icon + status */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={[styles.shimmer, { width: 50, height: 50, borderRadius: 10, marginRight: 12 }]} />
        <View>
          <View style={[styles.shimmer, { width: 70, height: 10, marginBottom: 6 }]} />
          <View style={[styles.shimmer, { width: 100, height: 12 }]} />
        </View>
      </View>

      {/* rows */}
      <View style={styles.row}>
        <View style={[styles.shimmer, { width: 80, height: 10 }]} />
        <View style={[styles.shimmer, { width: 120, height: 10 }]} />
      </View>
      <View style={styles.row}>
        <View style={[styles.shimmer, { width: 80, height: 10 }]} />
        <View style={[styles.shimmer, { width: 90, height: 10 }]} />
      </View>
      <View style={styles.row}>
        <View style={[styles.shimmer, { width: 110, height: 10 }]} />
        <View style={[styles.shimmer, { width: 60, height: 10 }]} />
      </View>
      <View style={styles.row}>
        <View style={[styles.shimmer, { width: 120, height: 10 }]} />
        <View style={[styles.shimmer, { width: 70, height: 10 }]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  shimmer: {
    backgroundColor: '#EEF2F7',
    borderRadius: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#EEE',
  },
});
