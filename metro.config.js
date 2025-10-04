const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const defaultConfig = getDefaultConfig(__dirname);

module.exports = mergeConfig(defaultConfig, {
  resolver: {
    // 🔥 Bỏ .web.js khỏi danh sách platform khi build mobile
    sourceExts: defaultConfig.resolver.sourceExts.filter(ext => ext !== 'web.js'),
  },
});
