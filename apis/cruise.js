// apis/cruise.js
import { API_URL } from '@env';

/** đảm bảo về giây (server dùng epoch seconds) */
const toSec = (t) => {
  if (!t && t !== 0) return undefined;
  const n = Number(t);
  if (Number.isNaN(n)) return undefined;
  // nếu là ms -> đổi sang s
  return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
};

/** GET /rest-module/cruise.json?id=<deviceId> */
export async function getCruise(accessToken, deviceId) {
  const url = `${API_URL}/rest-module/cruise.json?id=${encodeURIComponent(deviceId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // 1 bản ghi trạng thái hiện tại
}

/**
 * GET /rest-module/cruise/get-histories.json?id=<deviceId>&date_from=<s>&date_to=<s>
 * dateFrom/dateTo nhận: Date | number (ms/s) | string parse được
 */
export async function getHistories(accessToken, { id, dateFrom, dateTo }) {
  const fromS = toSec(dateFrom instanceof Date ? dateFrom.getTime() : dateFrom);
  const toS   = toSec(dateTo   instanceof Date ? dateTo.getTime()   : dateTo);

  const qs = new URLSearchParams({
    id,
    ...(fromS ? { date_from: String(fromS) } : {}),
    ...(toS   ? { date_to:   String(toS) }   : {}),
  }).toString();

  const url = `${API_URL}/rest-module/cruise/get-histories.json?${qs}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json(); // mảng points
}
