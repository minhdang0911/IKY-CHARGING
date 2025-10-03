import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, StyleSheet } from 'react-native';

export default function Shimmer({ style }) {
  const shimmerX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerX]);

  return (
    <View style={[styles.skelBase, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.skelShine,
          {
            transform: [{
              translateX: shimmerX.interpolate({
                inputRange: [-1, 1],
                outputRange: [-200, 200],
              }),
            }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  skelBase: { overflow: 'hidden', backgroundColor: '#e9eef5' },
  skelShine: { position: 'absolute', top: 0, bottom: 0, width: 120, backgroundColor: '#f6f9ff', opacity: 0.9 },
});
