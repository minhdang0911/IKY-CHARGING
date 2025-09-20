import { API_URL, CLIENT_ID, CLIENT_SECRET,API_TOKEN } from '@env';

// helper encode body cho x-www-form-urlencoded
const toForm = (data) =>
  Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

export async function login(username, password) {
  const res = await fetch(`${API_TOKEN}/oauth2/token.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: toForm({
      grant_type: 'password',
      username,
      password,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function register({ username, password, email }) {
  const res = await fetch(`${API_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, email }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function resetPassword(email) {
  const res = await fetch(`${API_URL}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ✅ new function: get user info
export async function getUserInfo(accessToken) {
  const res = await fetch(`${API_URL}/oauth2/user-info.json`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}


export async function changePassword(accessToken, { currentPassword, newPassword, confirmPassword }) {
  const res = await fetch(`${API_URL}/rest-module/change-password.json?XDEBUG_SESSION_START=PHPSTORM`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: toForm({
      password_hash: currentPassword,
      new_password: newPassword,
      confirm_new_password: confirmPassword,
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}


 
export async function changeProfile(
  accessToken,
  profile,
  { debug = false } = {}
) {
  if (!accessToken) throw new Error('Thiếu accessToken');

  // chỉ nhận các field hợp lệ
  const ALLOWED = [
    'name',
    'last_name',
    'email',
    'phone',
    'address',
    'province',
    'language',   // vd: 1 | 2 | 'vi' | 'en' (server quyết định)
    'remember_me' // boolean | 0 | 1
  ];

  const body = {};
  for (const k of ALLOWED) {
    if (profile?.[k] !== undefined && profile?.[k] !== null) {
      body[k] = profile[k];
    }
  }

  // chuẩn hoá một số kiểu cho an toàn
  if (body.remember_me !== undefined) {
    body.remember_me = body.remember_me ? '1' : '0';
  }
  if (body.language !== undefined && typeof body.language === 'number') {
    body.language = String(body.language);
  }

  const url = `${API_URL}/rest-module/profile-update.json${
    debug ? '?XDEBUG_SESSION_START=PHPSTORM' : ''
  }`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: toForm(body),
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

 
export async function refreshAccessToken(refreshToken, { debug = false } = {}) {
  if (!refreshToken) throw new Error('Thiếu refresh_token');

  const url = `${API_URL}/oauth2/token.json${debug ? '?XDEBUG_SESSION_START=PHPSTORM' : ''}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: toForm({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });

  if (!res.ok) throw new Error(await res.text());

  const data = await res.json();

  // Chuẩn hoá hạn token: login có thể trả về timestamp, refresh thường trả seconds.
  const nowSec = Math.floor(Date.now() / 1000);
  const raw = Number(data.expires_in);
  const expires_at = raw > 1e10 ? raw : nowSec + raw; // > ~Sat Nov 20 2286… => coi là timestamp

  return { ...data, expires_in: raw, expires_at };
}

/** Helper nho nhỏ: check gần hết hạn (skew mặc định 60s) */
export function isAccessTokenExpired(expires_at, skewSec = 60) {
  if (!expires_at) return true;
  const nowSec = Math.floor(Date.now() / 1000);
  return nowSec >= (Number(expires_at) - skewSec);
}

/** Helper: header auth cho tiện */
export function authHeader(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}
 