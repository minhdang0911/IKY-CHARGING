// // index.js
// import { AppRegistry } from 'react-native';
// import App from './App';
// import { name as appName } from './app.json';

// // 🔥 Modular RNFirebase
// import { getApp } from '@react-native-firebase/app';
// import {
//   getMessaging,
//   setBackgroundMessageHandler,
// } from '@react-native-firebase/messaging';

// import AsyncStorage from '@react-native-async-storage/async-storage';

// const K_NOTI_QUEUE = 'noti_queue';
// const MAX_ITEMS = 100;

// // Lưu message từ background vào queue (để App.js hút lên khi active)
// async function enqueueBG(remoteMessage) {
//   try {
//     const now = new Date();
//     const noti = {
//       id: String(now.getTime()),
//       createdAt: now.toISOString(),
//       title: remoteMessage?.notification?.title || 'Thông báo',
//       message:
//         remoteMessage?.notification?.body ||
//         JSON.stringify(remoteMessage?.data || {}),
//     };
//     const raw = (await AsyncStorage.getItem(K_NOTI_QUEUE)) || '[]';
//     const arr = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw) : [];
//     arr.unshift(noti);
//     await AsyncStorage.setItem(K_NOTI_QUEUE, JSON.stringify(arr.slice(0, MAX_ITEMS)));
//   } catch (e) {
//     // nuốt lỗi cho lành trong headless
//   }
// }

// // MUST đặt ở entrypoint
// const app = getApp();
// const msg = getMessaging(app);

// setBackgroundMessageHandler(msg, async (remoteMessage) => {
//   // Lưu ý: Trên Android, BG handler CHỈ chạy với "data-only" message
//   // (payload KHÔNG có field `notification`), còn notification message
//   // do system tự hiển thị & không vào handler.
//   try {
//     console.log('🌙 BG message:', JSON.stringify(remoteMessage));
//   } catch {}
//   await enqueueBG(remoteMessage);
// });

// AppRegistry.registerComponent(appName, () => App);


import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import 'react-native-gesture-handler';
import './polyfills-excel';

AppRegistry.registerComponent(appName, () => App);

