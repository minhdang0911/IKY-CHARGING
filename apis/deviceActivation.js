// src/apis/deviceActivation.js
import { API_PAY } from '@env';

const ACTIVATE_BY_OTP  = `${API_PAY}/api/devices/activeByOTP`;
const ACTIVATE_BY_CODE = `${API_PAY}/api/devices/activeByCode`;

// helper: encode body x-www-form-urlencoded
const toForm = (data) =>
  Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

async function postForm(url, formObj, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: toForm(formObj),
      signal: controller.signal,
    });

    const text = await res.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      // server có thể trả text/plain, trả về raw để debug
      data = { kq: 0, msg: text };
    }

    return { httpStatus: res.status, data, rawText: text };
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Yêu cầu quá thời gian, vui lòng thử lại');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Kích hoạt thiết bị bằng OTP
 * @param {{id:string, phoneNum:string, OTP:string|number}} params
 * @returns {Promise<{kq:number, msg:any, message:string, raw:any}>}
 */
export async function activateDeviceByOTP({ id, phoneNum, OTP }) {
  if (!id || !phoneNum || !OTP) {
    throw new Error('Thiếu tham số: id, phoneNum, OTP là bắt buộc');
  }

  const { data } = await postForm(ACTIVATE_BY_OTP, {
    id,
    phoneNum,
    OTP: String(OTP).trim(),
  });

  const kq = Number(data?.kq ?? 0);
  const msg = data?.msg ?? null;

  let message = 'Kích hoạt thất bại';
  if (kq === 1) message = 'Kích hoạt thành công';
  else if (typeof msg === 'string' && msg) message = msg;

  return { kq, msg, message, raw: data };
}

/**
 * Kích hoạt thiết bị bằng CODE (QR/tem)
 * @param {{id:string, code:string}} params
 * @returns {Promise<{kq:number, msg:any, message:string, raw:any}>}
 */
export async function activateDeviceByCode({ id, code }) {
  if (!id || !code) {
    throw new Error('Thiếu tham số: id, code là bắt buộc');
  }

  const { data } = await postForm(ACTIVATE_BY_CODE, { id, code });

  const kq = Number(data?.kq ?? 0);
  const msg = data?.msg ?? null;

  let message = 'Kích hoạt thất bại';
  if (kq === 1) message = 'Kích hoạt thành công';
  else if (typeof msg === 'string' && msg) message = msg;

  return { kq, msg, message, raw: data };
}

/** Optional: validator nhẹ */
export const isValidVNPhone = (s) => /^0\d{9,10}$/.test(String(s).replace(/\D/g, ''));
