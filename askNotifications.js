// askNotifications.js
import { useEffect } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

export async function requestAndroidPostNotifPermission() {
  if (Platform.OS !== 'android') return true;
  const api = parseInt(Platform.Version, 10);
  if (api < 33) return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

 