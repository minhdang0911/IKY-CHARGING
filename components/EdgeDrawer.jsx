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
  edgeHitWidth = 32,           // tăng vùng vuốt từ 24 -> 32
  topOffset = 0,
  children,
  // 🔥 NEW: Custom configs
  backdropOpacity = 0.5,       // độ tối backdrop (0-1)
  damping = 22,                // độ nảy spring (càng cao càng ít nảy)
  stiffness = 250,             // độ cứng spring (càng cao càng nhanh)
  openDuration = 200,          // ms
  closeDuration = 180,         // ms
  velocityThreshold = 0.4,     // tốc độ vuốt để trigger open/close
}) {
  const translateX = useRef(new Animated.Value(-width - 20)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current; // 🔥 scale animation

  // 🔥 IMPROVED: Smooth open với spring + scale
  const open = useCallback(() => {
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: openDuration,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1), // smooth bezier
        useNativeDriver: true,
      }),
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        damping,
        stiffness,
        velocity: 2, // initial velocity for smoother start
      }),
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 200,
      }),
    ]).start();
  }, [backdrop, translateX, scale, openDuration, damping, stiffness]);

  // 🔥 IMPROVED: Smooth close với easing curve tốt hơn
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
        easing: Easing.bezier(0.4, 0, 1, 1), // decelerate
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

  // 🔥 IMPROVED: Pan responder với velocity tracking
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
        translateX.stopAnimation((v) => {
          startX.current = v;
        });
        scale.stopAnimation();
        velocityX.current = 0;
        lastMoveTime.current = Date.now();
        lastDx.current = 0;
      },

      onPanResponderMove: (_, g) => {
        // 🔥 Calculate velocity
        const now = Date.now();
        const dt = now - lastMoveTime.current;
        if (dt > 0) {
          velocityX.current = (g.dx - lastDx.current) / dt * 1000; // px/s
        }
        lastMoveTime.current = now;
        lastDx.current = g.dx;

        // Update position
        let next = startX.current + g.dx;
        next = Math.min(0, Math.max(next, -width - 20));
        translateX.setValue(next);

        // Update backdrop & scale based on position
        const progress = 1 - Math.abs(next / (-width - 20));
        backdrop.setValue(progress);
        scale.setValue(0.92 + progress * 0.08); // 0.92 -> 1.0
      },

      onPanResponderRelease: (_, g) => {
        const end = startX.current + g.dx;
        const velocity = velocityX.current;
        
        // 🔥 Smart decision: combine velocity + position
        const shouldOpen = 
          velocity > velocityThreshold * 1000 || // fast swipe right
          (velocity > -velocityThreshold * 1000 && end > -width / 2); // slow but past halfway
        
        if (shouldOpen) {
          open();
        } else {
          close(onClose);
        }
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

      {/* 🔥 ENHANCED: Backdrop với opacity động */}
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

      {/* 🔥 ENHANCED: Drawer panel với scale + shadow động */}
      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.drawer,
          {
            width,
            top: topOffset,
            height: SCREEN_H - topOffset,
            transform: [
              { translateX },
              { scale }, // 🔥 thêm scale animation
            ],
            // 🔥 Dynamic shadow dựa trên backdrop
            shadowOpacity: backdrop.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.25],
            }),
            elevation: backdrop.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 24],
            }),
          },
        ]}
      >
        {/* 🔥 Inner shadow effect */}
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
    borderTopRightRadius: 24,      // 🔥 bo góc phải
    borderBottomRightRadius: 24,   // 🔥 bo góc phải
    shadowColor: '#000',
    shadowRadius: 20,               // 🔥 tăng từ 16 -> 20
    shadowOffset: { width: 8, height: 0 }, // 🔥 tăng từ 6 -> 8
    paddingTop: 8,
    paddingHorizontal: 16,          // 🔥 FIX: thêm padding ngang
    paddingBottom: 16,              // 🔥 FIX: thêm padding dưới
    overflow: 'hidden',             // 🔥 để inner shadow hoạt động
  },
  innerShadow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 1,
    backgroundColor: '#E5E7EB',     // 🔥 viền nhẹ bên phải
  },
});