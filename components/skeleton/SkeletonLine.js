import React from 'react';
import Shimmer from './Shimmer';

export default function SkeletonLine({ width = '100%', height = 14, radius = 6, style }) {
  return <Shimmer style={[{ width, height, borderRadius: radius }, style]} />;
}
