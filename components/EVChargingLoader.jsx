import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const TIPS = ['Vui lòng chờ'];

export default function EVChargingLoader({
  message = 'Đang tải dữ liệu…',
  size = 72,
  accent = '#0ea5e9', // đề xuất xanh dương nhã
}) {
  const rotate = useRef(new Animated.Value(0)).current;
  const pulse  = useRef(new Animated.Value(0)).current;
  const slide  = useRef(new Animated.Value(0)).current;
  const [tip]  = useState(TIPS[0]);

  // Rotate icon
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [rotate]);

  // Subtle ripple (low amplitude)
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(pulse, { toValue: 0, duration: 900, useNativeDriver: true, easing: Easing.in(Easing.quad) }),
      ])
    ).start();
  }, [pulse]);

  // Indeterminate sliding segment
  useEffect(() => {
    const run = () => {
      slide.setValue(0);
      Animated.timing(slide, {
        toValue: 1,
        duration: 1800,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false, // layout props
      }).start(run);
    };
    run();
  }, [slide]);

  const rotateDeg  = rotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const ringScale  = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const ringAlpha  = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.05] });

  const segLeft  = slide.interpolate({ inputRange: [0, 1], outputRange: ['-15%', '100%'] });
  const segWidth = slide.interpolate({
    inputRange: [0, 1],
    outputRange: ['28%', Platform.OS === 'ios' ? '12%' : '16%'],
  });

  const iconSize = useMemo(() => Math.max(48, size), [size]);

  return (
    <View style={styles.wrap}>
      {/* subtle ripple rings */}
      <Animated.View
        style={[
          styles.ring,
          {
            width: iconSize * 2.0,
            height: iconSize * 2.0,
            borderColor: accent,
            transform: [{ scale: ringScale }],
            opacity: ringAlpha,
            borderWidth: 1.5,
          },
        ]}
      />
      <View
        style={[
          styles.ring,
          {
            width: iconSize * 1.55,
            height: iconSize * 1.55,
            borderColor: accent,
            opacity: 0.06,
            borderWidth: 1,
          },
        ]}
      />

      {/* rotating plug/cable (monotone) */}
      <Animated.View style={{ transform: [{ rotate: rotateDeg }] }}>
        <Icon name="electrical-services" size={iconSize} color={accent} />
      </Animated.View>

      {/* subtle center dot (thay bolt) */}
      <View style={styles.centerDot} />

      {/* text */}
      {message ? <Text style={styles.title}>{message}</Text> : null}
      <Text style={styles.tip}>{tip}</Text>

      {/* indeterminate bar */}
      <View style={styles.barWrap}>
        <Animated.View style={[styles.barSeg, { backgroundColor: accent, left: segLeft, width: segWidth }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  ring: { position: 'absolute', borderRadius: 999 },
  centerDot: {
    position: 'absolute',
    width: 6, height: 6, borderRadius: 999,
    backgroundColor: '#94a3b8', opacity: 0.6, top: '40%',
  },
  title: { marginTop: 16, fontWeight: '700', fontSize: 15, color: '#0f172a' },
  tip:   { marginTop: 4, color: '#64748b', fontSize: 12 },

  barWrap: {
    width: 240, height: 6, borderRadius: 999,
    backgroundColor: '#e5e7eb', overflow: 'hidden', marginTop: 12,
  },
  barSeg: {
    position: 'absolute', top: 0, bottom: 0, borderRadius: 999,
  },
});
