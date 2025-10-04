// Web mock cho @react-native-camera-roll/camera-roll
// Trên web không có "Camera Roll", nên hoặc throw để dev biết,
// hoặc tự viết fallback download file (gợi ý ở dưới).

export const CameraRoll = {
  save: async (_uri, _opts) => {
    throw new Error(
      'CameraRoll.save is not supported on web. Use a browser download fallback instead.'
    );
  },
};

export default { CameraRoll };
