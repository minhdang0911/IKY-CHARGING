import { API_URL } from '@env';

// Helper: encode body thành x-www-form-urlencoded
const toForm = (data) =>
  Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

/** ================================
 * 1. LOGIN
 * ================================ */
export async function login(username, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: toForm({ username, password }),
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();

  // Trả về cho UI tự lưu AsyncStorage (token + user)
  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user, // { id, username, role, agent_id }
  };
}

/** ================================
 * 2. LOGOUT
 * ================================ */
export async function logout(accessToken) {
  const res = await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/** ================================
 * 3. REFRESH TOKEN
 * ================================ */
 

async function parseJSON(res) {
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return txt || null; }
}

/** Refresh token: cần cả Bearer accessToken + body refresh_token */
export async function refreshAccessToken(refreshToken, accessToken) {
  if (!refreshToken) throw new Error('Missing refresh token');
  if (!accessToken) throw new Error('Missing access token');

  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,   // bắt buộc có
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: toForm({ refreshToken: refreshToken }), // body bắt buộc có
  });

  const data = await parseJSON(res);
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status} ${typeof data === 'string' ? data : JSON.stringify(data || {})}`);
    err.response = { status: res.status, data };
    throw err;
  }

  const at = data?.accessToken || data?.access_token;
  const rt = data?.refreshToken || data?.refresh_token || refreshToken;
  if (!at) {
    const err = new Error('Refresh OK but missing accessToken');
    err.response = { status: 200, data };
    throw err;
  }
  return { accessToken: at, refreshToken: rt, expires_at: data?.expires_at ?? null };
}

/** ================================
 * 4. CHANGE PASSWORD (new)
 * POST /api/user/change-password
 * Body JSON: { userId, oldPassword, newPassword }
 * Header: Authorization: Bearer <accessToken>
 * ================================ */
export async function changePassword({ accessToken, userId, oldPassword, newPassword }) {
  const res = await fetch(`${API_URL}/api/user/change-password`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, oldPassword, newPassword }),
  });

  console.log(res)

  if (!res.ok) {
    // trả message backend cho UI
    const txt = await res.text();
    throw new Error(txt);
  }
  return res.json(); // { message: ... } nếu backend trả
}

/** ================================
 * Helpers
 * ================================ */
export function isAccessTokenExpired(expiresAt, skewSec = 60) {
  if (!expiresAt) return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec >= (Number(expiresAt) - skewSec);
}

export function authHeader(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}
