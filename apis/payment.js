// apis/payment.js
import { API_PAY } from '@env'; 

// encode x-www-form-urlencoded
const toForm = (data) =>
  Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

// Chuẩn hoá về mảng (server kiểu {kq:1,msg:[...]})
const normalizeList = async (res) => {
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    if (Array.isArray(json.msg)) return json.msg;
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.items)) return json.items;
  }
  console.log('RAW PAYMENT RESPONSE', json);
  return [];
};

/**
 * GET /api/payments/get-payment-methods?device_id=<id>
 * Trả về list phương thức thanh toán (momo, vnpay, bank, cash…)
 */
export async function getPaymentMethods({ accessToken, deviceId }) {
  if (!deviceId) throw new Error('Thiếu deviceId');
  const url = `${API_PAY}/api/payments/get-payment-methods?device_id=${encodeURIComponent(deviceId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  return normalizeList(res);
}


export async function getExtendServiceCategories({ accessToken, deviceId }) {
  if (!deviceId) throw new Error('Thiếu deviceId');
  const url = `${API_PAY}/api/ExtendServiceCategories/?device_id=${encodeURIComponent(deviceId)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
  return normalizeList(res);
}

export async function createPaymentOrder({
  accessToken,
  packageID,
  deviceID,
  methodID,
  bankID,     // optional cho bank
  requestId,  // MoMo cần
  note,       // "BIENSO - SODT"
}) {
  if (!packageID) throw new Error('Thiếu packageID');
  if (!deviceID) throw new Error('Thiếu deviceID');
  if (!methodID) throw new Error('Thiếu methodID');

  const bodyObj = { packageID, deviceID, methodID, bankID, note };
  if (requestId) {
    bodyObj.requestId  = requestId;
    bodyObj.request_id = requestId;
    bodyObj.requestID  = requestId;
  }

  const body = toForm(bodyObj);
  // DEBUG: xem chính xác mình gửi gì lên
  console.log('createorder body =', body);

  const res = await fetch(`${API_PAY}/api/payments/createorder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body,
  });

  const json = await res.json().catch(async () => {
    const text = await res.text();
    return { raw: text, httpStatus: res.status };
  });

  // ===== Chuẩn hoá điều kiện SUCCESS / ERROR =====
  // Nhiều API trả 200 nhưng kèm resultCode/subErrors -> coi là lỗi
  const hasBizError =
    Array.isArray(json?.subErrors) && json.subErrors.length > 0 ||
    (typeof json?.resultCode === 'number' && json.resultCode !== 0) ||
    json?.kq === 0;

  if (!res.ok || hasBizError) {
    const sub =
      json?.subErrors?.map(e => `${e.field}: ${e.message}`).join('; ');
    const msg = sub || json?.message || `HTTP ${res.status}`;
    throw new Error(msg || 'createorder failed');
  }

  // Trả về object dùng ngay cho UI
  return json?.msg ?? json?.data ?? json ?? {};
}