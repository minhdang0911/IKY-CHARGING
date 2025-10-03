import React from 'react';
import Shimmer from './Shimmer';

export default function SkeletonBlock({ height = 60, radius = 12, style }) {
  return <Shimmer style={[{ width: '100%', height, borderRadius: radius }, style]} />;
}
