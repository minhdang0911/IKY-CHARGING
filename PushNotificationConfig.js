// // PushNotificationConfig.js
// import { Platform } from "react-native";
// import PushNotification from "react-native-push-notification";
// import PushNotificationIOS from "@react-native-community/push-notification-ios";

// let onOpenNotification = null; // sẽ do App.js gán
// export const setOnOpenNotification = (cb) => {
//   onOpenNotification = typeof cb === "function" ? cb : null;
// };

// export const initPush = () => {
//   PushNotification.configure({
//     onRegister(token) {
//       console.log("RNPN token:", token);
//     },

//     // Gọi khi user chạm vào local notification (kể cả initial trên Android)
//     onNotification(notification) {
//       console.log("RNPN onNotification:", notification);

//       // Nếu là thao tác của người dùng -> điều hướng
//       if (notification?.userInteraction && typeof onOpenNotification === "function") {
//         try { onOpenNotification(notification); } catch (_) {}
//       }

//       // iOS phải gọi finish()
//       if (Platform.OS === "ios" && typeof notification.finish === "function") {
//         notification.finish(PushNotificationIOS.FetchResult.NoData);
//       }
//     },

//     // Quan trọng để bắt được noti khi app mở từ trạng thái kill (Android)
//     popInitialNotification: true,

//     requestPermissions: true,
//   });

//   PushNotification.createChannel(
//     {
//       channelId: "default-channel-id",
//       channelName: "Default Channel",
//       importance: 4,
//       vibrate: true,
//     },
//     (created) => console.log("RNPN channel created:", created)
//   );
// };

// export const showLocalNotification = (title, message, data = {}) => {
//   PushNotification.localNotification({
//     channelId: "default-channel-id",
//     title,
//     message,
//     playSound: true,
//     soundName: "default",
//     importance: "high",
//     vibrate: true,
//     priority: "high",
//     allowWhileIdle: true,
//     data,
//     userInfo: data, 
//   });
// };
