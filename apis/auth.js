import { API_URL } from '@env';
import { getOrCreateDeviceId } from '../utils/deviceId';

/* ================================ *
 * Helpers
 * ================================ */
async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    body: JSON.stringify(opts.body || {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || ('HTTP ' + res.status));
  }
  return res.json();
}

// encode body thành x-www-form-urlencoded
const toForm = (data) =>
  Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

async function parseJSON(res) {
  const txt = await res.text();
  try { return JSON.parse(txt); } catch { return txt || null; }
}

/* ================================ *
 * 1) LOGIN
 * ================================ */
export async function login(username, password) {
  const deviceId = await getOrCreateDeviceId();

  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: toForm({ username, password, deviceId }),
  });

  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    user: data.user, // { id, username, role, agent_id, ... }
  };
}

/* ================================ *
 * 2) LOGOUT
 * ================================ */
export async function logout(accessToken) {
  const res = await fetch(`${API_URL}/api/auth/logout`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ================================ *
 * 3) REFRESH TOKEN
 * Yêu cầu:
 *  - Header: Authorization: Bearer <accessToken>
 *  - Body (x-www-form-urlencoded): refreshToken + deviceId
 * ================================ */
export async function refreshAccessToken(refreshToken, accessToken) {
  if (!refreshToken) throw new Error('Missing refresh token');
  if (!accessToken) throw new Error('Missing access token');

  const deviceId = await getOrCreateDeviceId();

  const res = await fetch(`${API_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: toForm({ refreshToken, deviceId }),
  });

  const data = await parseJSON(res);
  if (!res.ok) {
    const err = new Error(
      `HTTP ${res.status} ${typeof data === 'string' ? data : JSON.stringify(data || {})}`
    );
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

/* ================================ *
 * 4) CHANGE PASSWORD
 * ================================ */
export async function changePassword({ accessToken, userId, oldPassword, newPassword }) {
  const res = await fetch(`${API_URL}/api/user/change-password`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ userId, oldPassword, newPassword }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(txt);
  }
  return res.json();
}

/* ================================ *
 * Extra helpers (export nếu cần dùng chỗ khác)
 * ================================ */
export function isAccessTokenExpired(expiresAt, skewSec = 60) {
  if (!expiresAt) return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec >= (Number(expiresAt) - skewSec);
}

export function authHeader(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

export { toForm };
