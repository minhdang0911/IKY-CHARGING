module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        blocklist: null,   // 👈 bản mới đổi từ blacklist thành blocklist
        allowlist: null,   // 👈 bản mới đổi từ whitelist thành allowlist
        safe: false,
        allowUndefined: true,
      },
    ],
  ],
};
