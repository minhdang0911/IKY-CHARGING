// utils/deviceId.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEVICE_ID_KEY = 'app_device_id';

// UUID v4 tối giản, khỏi cần lib ngoài
function genUuidV4() {
  const hex = '0123456789abcdef';
  const s = new Array(36).fill('0').map(() => hex[(Math.random() * 16) | 0]);
  s[14] = '4'; // version
  s[19] = hex[((parseInt(s[19], 16) & 0x3) | 0x8)]; // variant
  s[8] = s[13] = s[18] = s[23] = '-';
  return s.join('');
}

let cachedId = null;

export async function getOrCreateDeviceId() {
  if (cachedId) return cachedId;
  try {
    const saved = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (saved) {
      cachedId = saved;
      return saved;
    }
    const id = genUuidV4();
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
    cachedId = id;
    return id;
  } catch (e) {
    // lỡ storage lỗi thì vẫn tạo runtime để không kẹt luồng
    const id = genUuidV4();
    cachedId = id;
    return id;
  }
}

export async function getDeviceId() {
  if (cachedId) return cachedId;
  try {
    const saved = await AsyncStorage.getItem(DEVICE_ID_KEY);
    if (saved) {
      cachedId = saved;
      return saved;
    }
  } catch {}
  return null;
}
