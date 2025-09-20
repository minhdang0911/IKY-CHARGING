// components/Notification.js
import { Platform, ToastAndroid, Alert } from 'react-native';

export const showMessage = (msg) => {
  if (Platform.OS === 'android') {
    ToastAndroid.showWithGravity(msg, ToastAndroid.LONG, ToastAndroid.BOTTOM);
  } else {
    Alert.alert('Thông báo', msg);
  }
};
