const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const webpack = require('webpack');

const isProd = process.env.NODE_ENV === 'production';

module.exports = {
  mode: isProd ? 'production' : 'development',

  // Nếu file ở ./src/index.web.js thì đổi đường dẫn cho đúng
  entry: './index.web.js',

  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules\/(?!(react-native|react-native-web)\/).*/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { modules: false }],
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
                { moduleName: '@env', path: '.env', allowUndefined: true },
              ],
            ],
          },
        },
      },
      {
        test: /\.(png|jpg|gif|svg|ico)$/i,
        type: 'asset/resource',
        generator: { filename: 'assets/[name][hash][ext][query]' }
      },
    ],
  },

  resolve: {
    alias: {
      'react-native$': 'react-native-web',
      // mock native lib không có trên web
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
    filename: isProd ? 'assets/[name].[contenthash].js' : 'bundle.js',
    publicPath: '/', // bắt buộc cho SPA
    clean: true,
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'index.html'),
    }),
    new webpack.DefinePlugin({
      __DEV__: JSON.stringify(!isProd),
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    }),
  ],

  // chỉ phục vụ dev local, Vercel không dùng cái này
  devServer: {
    static: path.join(__dirname, 'dist'),
    compress: true,
    port: 3000,
    open: true,
    hot: true,
    historyApiFallback: true,
  },
};
