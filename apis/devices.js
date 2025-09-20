// apis/devices.js
import { API_URL,API_PAY } from '@env';

// helper encode body nếu cần (để sẵn)
const toForm = (data) =>
  Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

/** Chuẩn hoá mọi kiểu response về Array */
const normalizeList = async (res) => {
  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();

  // các kiểu server có thể trả
  if (Array.isArray(json)) return json;
  if (json && typeof json === 'object') {
    if (Array.isArray(json.msg)) return json.msg;
    if (Array.isArray(json.data)) return json.data;
    if (Array.isArray(json.items)) return json.items;
  }

    console.log("RAW DEVICES RESPONSE", json); 
  return [];
};

/**
 * Lấy danh sách thiết bị của user
 * GET {{URL}}/rest-module/device/get-devices.json
 * Server mới trả: { kq: 1, msg: [...] }
 */
export async function getDevices(accessToken) {
  const res = await fetch(`${API_PAY}/api/devices/device-list`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return normalizeList(res);
}
// alias để không phải sửa import ở code cũ
export const getDevice = getDevices;

/**
 * Lấy danh mục loại xe
 * GET {{URL}}/rest-module/device/get-vehicle-categories.json
 * (chịu được cả {kq,msg} lẫn mảng thuần)
 */
export async function getVehicleCategories(accessToken) {
  const res = await fetch(`${API_URL}/rest-module/device/get-vehicle-categories.json`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return normalizeList(res);
}

/** Map id -> name để hiển thị */
export function buildVehicleCategoryMap(list = []) {
  const map = {};
  for (const it of list) {
    const id = it?._id || it?.id;
    if (!id) continue;
    // ưu tiên name, fallback model
    map[id] = it?.name || it?.model || 'Chưa xác định';
  }
  return map;
}

/**
 * Cập nhật thiết bị
 * POST {{URL}}/rest-module/device/edit.json?id=<id>
 */
export async function updateDevice(accessToken, id, payload, { debug = false } = {}) {
  if (!accessToken) throw new Error('Thiếu accessToken');
  if (!id) throw new Error('Thiếu device id');

  // build body chỉ giữ field có value
  const body = {};
  ['vehicle_category_id', 'phone_number', 'driver', 'license_plate'].forEach((k) => {
    if (payload[k] !== undefined && payload[k] !== null) body[k] = String(payload[k]);
  });

  const url =
    `${API_URL}/rest-module/device/edit.json?id=${encodeURIComponent(id)}` +
    (debug ? '&XDEBUG_SESSION_START=PHPSTORM' : '');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}


export async function getExtendHistory({ accessToken, deviceId }) {
  if (!deviceId) throw new Error('Thiếu deviceId');
  const url = `${API_PAY}/api/exp/getExtendHistory?id=${encodeURIComponent(deviceId)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();

  if (json?.kq !== 1) {
    throw new Error(json?.msg || 'Lấy lịch sử gia hạn thất bại');
  }
  // trả về mảng lịch sử
  return Array.isArray(json.msg) ? json.msg : [];
}


export async function deleteDevice(accessToken, id, { debug = false } = {}) {
  if (!accessToken) throw new Error('Thiếu accessToken');
  if (!id) throw new Error('Thiếu device id');

  const url =
    `${API_URL}/rest-module/device/delete.json?id=${encodeURIComponent(id)}` +
    (debug ? '&XDEBUG_SESSION_START=PHPSTORM' : '');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}



export async function getDeviceInfo(accessToken, imei) {
  if (!imei) throw new Error('Thiếu imei');
  const url = `${API_PAY}/api/devices/infor?imei=${encodeURIComponent(imei)}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) throw new Error(await res.text());
  const json = await res.json();

  if (json?.kq !== 1) {
    throw new Error(json?.msg || 'Không tìm thấy thiết bị');
  }

  return json.msg; // trả về object device info
}


export async function addDevice(accessToken, payload) {
  if (!accessToken) throw new Error('Thiếu accessToken');

  const body = {
    device_category_id: String(payload.device_category_id || ''),
    vehicle_category_id: String(payload.vehicle_category_id || ''),
    imei: String(payload.imei || ''),
    phone_number: String(payload.phone_number || ''),
    driver: String(payload.driver || ''),
    license_plate: String(payload.license_plate || ''),
  };

  const url = `${API_URL}/rest-module/device/add.json`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(await res.text());
  return res.json(); // trả về {kq: 1, msg: ...}
}


// export async function getDevicesExpires(accessToken) {
//   const res = await fetch(`${API_PAY}/api/devices/device-list`, {
//     method: 'GET',
//     headers: { Authorization: `Bearer ${accessToken}` },
//   });
//   return normalizeList(res);
// }
 