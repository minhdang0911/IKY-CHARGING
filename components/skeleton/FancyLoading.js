import React, { useEffect, useRef } from 'react';
import { Animated, Text, View, ScrollView, StyleSheet, Platform } from 'react-native';
import SkeletonLine from './SkeletonLine';
import SkeletonBlock from './SkeletonBlock';

export default function FancyLoading({ t }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const mk = (val, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 350, useNativeDriver: true }),
        ])
      ).start();
    mk(dot1, 0); mk(dot2, 150); mk(dot3, 300);
    return () => { dot1.stopAnimation(); dot2.stopAnimation(); dot3.stopAnimation(); };
  }, [dot1, dot2, dot3]);

  const Dot = ({ val }) => (
    <Animated.Text style={{ opacity: val, fontSize: 16, color: '#5c6b7a' }}>{' .'}</Animated.Text>
  );

  return (
    <View style={styles.loadingRoot}>
      <View style={styles.header}>
        <SkeletonLine width={28} height={24} style={{ opacity: 0.55 }} />
        <SkeletonLine width={120} height={22} style={{ opacity: 0.75 }} />
        <View style={{ width: 28 }}>
          <SkeletonLine width={24} height={24} style={{ alignSelf: 'flex-end', opacity: 0.6 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollInner}>
        <SkeletonLine width={150} height={14} style={{ marginBottom: 8 }} />
        <SkeletonBlock height={90} />
        <View style={{ height: 16 }} />
        <SkeletonLine width={120} height={14} style={{ marginBottom: 8 }} />
        <SkeletonBlock height={120} />

        <View style={{ alignItems: 'center', marginTop: 24 }}>
          <Text style={{ color: '#5c6b7a' }}>
            {t('loading')}
            <Dot val={dot1} />
            <Dot val={dot2} />
            <Dot val={dot3} />
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingRoot: { flex: 1, backgroundColor: '#f5f7fb' },
  header: {
    backgroundColor: '#1e88e5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 45 : 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scrollInner: { padding: 16, paddingBottom: 28 },
});
