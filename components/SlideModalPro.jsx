// components/SlideModalPro.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Animated, Easing, StyleSheet, Dimensions, PanResponder, TouchableWithoutFeedback,
  Platform, Keyboard, TouchableOpacity, ScrollView
} from 'react-native';

const { height: SCREEN_H } = Dimensions.get('window');

// utils
const clamp = (v, min, max) => Math.min(Math.max(v, min), max);
const isPercent = (n) => typeof n === 'number' && n > 0 && n <= 1;

export default function SlideModalPro({
  visible,
  onClose,
  snapPoints = [0.5, 0.92],   // 50% / 92%
  initialSnap = 0,
  backdropOpacity = 0.45,
  rounded = 24,
  backdropPressToClose = true,
  enablePanDownToClose = true,
  enableTapHandleToToggle = true,
  keyboardAvoiding = true,
  header,
  footer,
  children,
  sheetStyle,
  contentContainerStyle,
}) {
  // resolve snaps -> Y
  const snaps = useMemo(() => {
    const hs = snapPoints
      .map(p => isPercent(p) ? Math.round(SCREEN_H * p) : p)
      .map(h => clamp(h, 220, Math.min(SCREEN_H * 0.98, Math.max(220, h))));
    // sort desc (cao -> thấp), map thành translateY
    return [...hs].sort((a,b)=>b-a).map(h => SCREEN_H - h);
  }, [snapPoints]);

  const [snapIndex, setSnapIndex] = useState(
    clamp(initialSnap, 0, Math.max(0, snaps.length - 1))
  );

  const translateY = useRef(new Animated.Value(SCREEN_H + 60)).current;
  const backdrop = useRef(new Animated.Value(0)).current;

  // keyboard avoid
  const keyboardH = useRef(0);
  useEffect(() => {
    if (!keyboardAvoiding) return;
    const sh = Keyboard.addListener('keyboardWillShow', (e) => {
      keyboardH.current = e.endCoordinates?.height ?? 0;
      nudgeTo(snaps[snapIndex]);
    });
    const sh2 = Keyboard.addListener('keyboardWillHide', () => {
      keyboardH.current = 0;
      nudgeTo(snaps[snapIndex], false);
    });
    return () => { sh.remove(); sh2.remove(); };
  }, [keyboardAvoiding, snapIndex, snaps]);

  const nudgeTo = (toY, spring = true) => {
    const kb = keyboardH.current ? Math.max(0, keyboardH.current - 12) : 0;
    const y = Math.max(toY - kb, 0);
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 1, duration: spring ? 220 : 160, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      spring
        ? Animated.spring(translateY, { toValue: y, useNativeDriver: true, damping: 20, stiffness: 210, mass: 0.7 })
        : Animated.timing(translateY, { toValue: y, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  };

  const open = () => {
    translateY.setValue(SCREEN_H + 60);
    backdrop.setValue(0);
    nudgeTo(snaps[snapIndex]);
  };
  const animateClose = (cb) => {
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 200, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: SCREEN_H + 60, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(({ finished }) => finished && cb && cb());
  };
  useEffect(() => { if (visible) open(); else animateClose(onClose); /* eslint-disable-line */ }, [visible]);

  // pan
  const startY = useRef(0);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enablePanDownToClose,
      onMoveShouldSetPanResponder: (_, g) => enablePanDownToClose && (Math.abs(g.dy) > 4),
      onPanResponderGrant: () => { translateY.stopAnimation((v) => { startY.current = v; }); },
      onPanResponderMove: (_, g) => {
        const next = clamp(startY.current + g.dy, 0, SCREEN_H + 40);
        translateY.setValue(next);
        const openSpan = (SCREEN_H + 40) - (snaps[snaps.length - 1] ?? SCREEN_H * 0.14);
        const p = 1 - clamp((next - (snaps[snaps.length - 1] ?? SCREEN_H * 0.14)) / openSpan, 0, 1);
        backdrop.setValue(p);
      },
      onPanResponderRelease: (_, g) => {
        const endY = startY.current + g.dy;
        if (g.vy > 1.1 && g.dy > 30) { animateClose(onClose); return; }
        let target = snaps[0], idx = 0, best = Infinity;
        snaps.forEach((s, i) => { const d = Math.abs(endY - s); if (d < best) { best = d; target = s; idx = i; } });
        const lowest = snaps[0];
        if (endY > lowest + 80) { animateClose(onClose); return; }
        setSnapIndex(idx);
        nudgeTo(target);
      },
    })
  ).current;

  if (!visible && Platform.OS === 'android') return null;

  return (
    <View pointerEvents={visible ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>
      {/* backdrop */}
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#000', opacity: backdrop.interpolate({ inputRange: [0,1], outputRange: [0, backdropOpacity] }) }
        ]}
      >
        {backdropPressToClose && (
          <TouchableWithoutFeedback onPress={onClose}>
            <View style={StyleSheet.absoluteFill} />
          </TouchableWithoutFeedback>
        )}
      </Animated.View>

      {/* sheet */}
      <Animated.View
        {...(enablePanDownToClose ? pan.panHandlers : {})}
        style={[
          styles.sheet,
          { transform: [{ translateY }], borderTopLeftRadius: rounded, borderTopRightRadius: rounded },
          sheetStyle,
        ]}
      >
        {/* handle */}
        <TouchableOpacity activeOpacity={0.9} onPress={enableTapHandleToToggle ? () => {
          const next = (snapIndex + 1) % snaps.length; setSnapIndex(next); nudgeTo(snaps[next]);
        } : undefined} style={styles.handleWrap}>
          <View style={styles.handle} />
        </TouchableOpacity>

        {/* header */}
        {header ? <View style={styles.headerWrap}>{header}</View> : null}

        {/* content (cuộn được) */}
        <ScrollView
          style={{ flexGrow: 0 }}
          contentContainerStyle={[{ paddingHorizontal: 16, paddingTop: 6, paddingBottom: 16 }, contentContainerStyle]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>

        {/* footer sticky */}
        {footer ? <View style={styles.footerWrap}>{footer}</View> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: -40,
    backgroundColor: '#fff',
    borderTopColor: '#eef2f7', borderTopWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: -6 },
    elevation: 40,
  },
  handleWrap: { paddingTop: 10, paddingBottom: 4, alignItems: 'center' },
  handle: { width: 52, height: 6, borderRadius: 999, backgroundColor: '#E5E7EB' },
  headerWrap: { paddingHorizontal: 16, paddingBottom: 8 },
  footerWrap: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E5E7EB', backgroundColor: '#fff'
  },
});
