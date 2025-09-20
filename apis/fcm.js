// apis/fcm.js
import { API_PAY } from '@env';  

const toForm = (obj) =>
  Object.entries(obj)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

/** 
 * Đăng ký token ↔ user (oid) 
 * @param {Object} params
 * @param {string} params.accessToken - Bearer token
 * @param {string} params.userID - OID của user
 * @param {string} params.token - FCM token
 */
export async function registerFCMToken({ accessToken, userID, token }) {
  if (!accessToken || !userID || !token) {
    console.log('⚠️ registerFCMToken thiếu param', { 
      hasAccessToken: !!accessToken, 
      hasUserID: !!userID, 
      hasToken: !!token 
    });
    return;
  }

  try {
    const url = `${API_PAY}/api/users/FCM-registration-token`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: toForm({ userID, token }),
    });
    
    const text = await res.text();
    console.log('✅ FCM-registration-token:', res.status, text);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
  } catch (e) {
    console.error('❌ registerFCMToken error:', e?.message || e);
    throw e; // Re-throw để caller có thể handle
  }
}

/** 
 * Hủy mapping token ↔ user khi logout/chuyển account
 * @param {Object} params
 * @param {string} params.accessToken - Bearer token
 * @param {string} params.userID - OID của user cần xóa
 * @param {string} params.token - FCM token cần xóa
 */
export async function deleteFCMToken({ accessToken, userID, token }) {
  if (!accessToken || !userID || !token) {
    console.log('⚠️ deleteFCMToken thiếu param', {
      hasAccessToken: !!accessToken, 
      hasUserID: !!userID, 
      hasToken: !!token 
    });
    return;
  }

  try {
    const url = `${API_PAY}/api/users/FCM-delete-token`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: toForm({ userID, token }),
    });
    
    const text = await res.text();
    console.log('🗑️ FCM-delete-token:', res.status, text);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${text}`);
    }
  } catch (e) {
    console.error('❌ deleteFCMToken error:', e?.message || e);
    throw e; // Re-throw để caller có thể handle
  }
}