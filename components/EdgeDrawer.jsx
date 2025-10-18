// components/EdgeDrawer.jsx - ENHANCED VERSION
import React, { useEffect, useRef, useCallback } from 'react';
import {
  View, Animated, Dimensions, PanResponder, StyleSheet,
  TouchableWithoutFeedback, Easing, Platform
} from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function EdgeDrawer({
  visible,
  onClose,
  width = Math.round(SCREEN_W * 0.78),
  edgeHitWidth = 32,
  topOffset = 0,
  children,
  backdropOpacity = 0.5,
  damping = 22,
  stiffness = 250,
  openDuration = 200,
  closeDuration = 180,
  velocityThreshold = 0.4,
}) {
  const translateX = useRef(new Animated.Value(-width - 20)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;

  const open = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: openDuration,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        damping,
        stiffness,
        velocity: 2,
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
      }),
    ]).start();
  }, [backdrop, translateX, scale, openDuration, damping, stiffness]);

  const close = useCallback((cb) => {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 0,
        duration: closeDuration,
        easing: Easing.bezier(0.4, 0, 0.6, 1),
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: -width - 20,
        duration: closeDuration,
        easing: Easing.bezier(0.4, 0, 1, 1),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.92,
        duration: closeDuration,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished && cb) cb();
    });
  }, [backdrop, translateX, scale, closeDuration, width]);

  useEffect(() => {
    if (visible) open();
    else close(onClose);
  }, [visible, open, close]); // eslint-disable-line

  const startX = useRef(0);
  const velocityX = useRef(0);
  const lastMoveTime = useRef(0);
  const lastDx = useRef(0);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (_, g) => {
        if (!visible) return g.moveX <= edgeHitWidth && g.moveY >= topOffset;
        return Math.abs(g.dx) > 3;
      },
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 3,

      onPanResponderGrant: () => {
        translateX.stopAnimation((v) => { startX.current = v; });
        scale.stopAnimation();
        velocityX.current = 0;
        lastMoveTime.current = Date.now();
        lastDx.current = 0;
      },

      onPanResponderMove: (_, g) => {
        const now = Date.now();
        const dt = now - lastMoveTime.current;
        if (dt > 0) {
          velocityX.current = (g.dx - lastDx.current) / dt * 1000;
        }
        lastMoveTime.current = now;
        lastDx.current = g.dx;

        let next = startX.current + g.dx;
        next = Math.min(0, Math.max(next, -width - 20));
        translateX.setValue(next);

        const progress = 1 - Math.abs(next / (-width - 20));
        backdrop.setValue(progress);
        scale.setValue(0.92 + progress * 0.08);
      },

      onPanResponderRelease: (_, g) => {
        const end = startX.current + g.dx;
        const velocity = velocityX.current;

        const shouldOpen =
          velocity > velocityThreshold * 1000 ||
          (velocity > -velocityThreshold * 1000 && end > -width / 2);

        if (shouldOpen) open();
        else close(onClose);
      },
    })
  ).current;

  // Android edge catcher when closed
  if (!visible && Platform.OS === 'android') {
    return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <View
          {...pan.panHandlers}
          style={{
            position: 'absolute',
            left: 0,
            top: topOffset,
            bottom: 0,
            width: edgeHitWidth,
          }}
        />
      </View>
    );
  }

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 9998 }]} pointerEvents="auto">
      {/* Edge catcher */}
      <View
        {...pan.panHandlers}
        style={{
          position: 'absolute',
          left: 0,
          top: topOffset,
          bottom: 0,
          width: edgeHitWidth,
          zIndex: 1,
        }}
      />

      {/* Backdrop */}
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          {
            position: 'absolute',
            left: 0,
            right: 0,
            top: topOffset,
            bottom: 0,
            backgroundColor: '#000',
            opacity: backdrop.interpolate({
              inputRange: [0, 1],
              outputRange: [0, backdropOpacity],
            }),
          },
        ]}
      >
        <TouchableWithoutFeedback onPress={() => close(onClose)}>
          <View style={{ flex: 1 }} />
        </TouchableWithoutFeedback>
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.drawer,
          {
            width,
            top: topOffset,
            height: SCREEN_H - topOffset,
            transform: [{ translateX }, { scale }],
            shadowOpacity: backdrop.interpolate({ inputRange: [0, 1], outputRange: [0, 0.25] }),
            elevation: backdrop.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }),
          },
        ]}
      >
        <View style={styles.innerShadow} />
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    left: 0,
    backgroundColor: '#fff',
    borderTopRightRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#000',
    shadowRadius: 20,
    shadowOffset: { width: 8, height: 0 },
    paddingTop: 8,
    overflow: 'hidden',
  },
  innerShadow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#E5E7EB',
  },
});
