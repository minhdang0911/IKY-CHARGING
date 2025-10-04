const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  entry: './index.web.js',

  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules\/(?!(react-native|react-native-web)\/).*/,
        use: {
          loader: 'babel-loader',
          options: {
            // ⚡ Fix loose mode conflict (tất cả plugin đồng bộ loose: true)
            presets: [
              '@babel/preset-env',
              '@babel/preset-react',
              'module:metro-react-native-babel-preset',
            ],
            plugins: [
              '@babel/plugin-transform-flow-strip-types',
              ['@babel/plugin-transform-runtime', { helpers: true }],
              ['@babel/plugin-transform-class-properties', { loose: true }],
              ['@babel/plugin-transform-private-methods', { loose: true }],
              ['@babel/plugin-transform-private-property-in-object', { loose: true }],
              [
                'module:react-native-dotenv',
                {
                  moduleName: '@env',
                  path: '.env',
                  allowUndefined: true,
                },
              ],
            ],
          },
        },
      },
      {
        test: /\.(png|jpg|gif|svg|ico)$/,
        type: 'asset/resource',
      },
    ],
  },

  resolve: {
    alias: {
      'react-native$': 'react-native-web',

      // ⚙️ Mock các module native không support web
      'react-native-fs': path.resolve(__dirname, 'web-mocks/react-native-fs.js'),
      'react-native-view-shot': path.resolve(__dirname, 'web-mocks/react-native-view-shot.js'),
      'react-native-share': path.resolve(__dirname, 'web-mocks/react-native-share.web.js'),
      '@react-native-async-storage/async-storage': path.resolve(__dirname, 'web-mocks/async-storage.js'),
      'react-native-push-notification': path.resolve(__dirname, 'web-mocks/empty-module.js'),
      'react-native-permissions': path.resolve(__dirname, 'web-mocks/empty-module.js'),
      '@react-native-camera-roll/camera-roll': path.resolve(__dirname, 'web-mocks/camera-roll.web.js'),
      'react-native-maps': path.resolve(__dirname, 'web-mocks/empty-module.js'),
      'react-native-reanimated': path.resolve(__dirname, 'web-mocks/empty-module.js'),
    },
    extensions: ['.web.js', '.js', '.jsx', '.json', '.ts', '.tsx'],
  },

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'index.html'),
      // favicon: path.join(__dirname, 'favicon.ico'), // optional
    }),
    new webpack.DefinePlugin({
      __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
  ],

  devServer: {
    static: path.join(__dirname, 'dist'),
    compress: true,
    port: 3000,
    open: true,
    hot: true,
    historyApiFallback: true, // 🔥 để F5 không lỗi 404
  },
};
