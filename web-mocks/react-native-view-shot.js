// web-mocks/react-native-view-shot.js
import React, { forwardRef, useImperativeHandle } from 'react';
import { View } from 'react-native';

// Trả về 1 component hợp lệ để React render được
const ViewShot = forwardRef(function ViewShot(props, ref) {
  useImperativeHandle(ref, () => ({
    // Trên web mock: không chụp thật, return null/URL ảo tuỳ m
    async capture() {
      return null; // hoặc 'data:image/png;base64,...' nếu m muốn giả lập
    },
  }));
  return <View {...props} />;
});

export default ViewShot;
