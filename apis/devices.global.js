// apis/devices.global.js
import { API_URL } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';

// giữ nguyên checker cũ
async function checkResponse(res) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'API error');
  }
  return res.json();
}

// lấy token “an toàn” nếu không truyền vào
async function getAccessTokenSafe() {
  const keys = ['access_token', 'accessToken', 'ACCESS_TOKEN', 'token', 'auth_token'];
  for (const k of keys) {
    // eslint-disable-next-line no-await-in-loop
    const v = await AsyncStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

// GẮN HÀM LÊN GLOBAL (chỉ gắn 1 lần, tránh Fast Refresh gắn lặp)
if (!globalThis.getDevices) {
  /**
   * Toàn cục: getDevices(accessToken?)
   * - Có thể truyền token hoặc không. Không truyền -> tự lấy từ AsyncStorage.
   */
  globalThis.getDevices = async function getDevices(accessToken) {
    const token = accessToken || (await getAccessTokenSafe());
    if (!token) throw new Error('Thiếu accessToken');
    const res = await fetch(`${API_URL}/api/device`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return checkResponse(res);
  };
}
