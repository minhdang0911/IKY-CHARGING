// apis/devices.js
import { API_URL } from '@env';

// Helper check response
const checkResponse = async (res) => {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'API error');
  }
  return res.json();
};

/** Lấy danh sách tất cả devices */
export async function getDevices(accessToken) {
  const res = await fetch(`${API_URL}/api/device`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  return checkResponse(res);
}

/** Lấy thông tin chi tiết 1 device */
export async function getDeviceInfo(accessToken, deviceId) {
  if (!deviceId) throw new Error('Thiếu deviceId');
  const res = await fetch(`${API_URL}/api/device/${deviceId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  return checkResponse(res);
}

/** 🔥 Lấy sessions dashboard (có latestSession trong từng port) */
export async function getDashboardSessions(accessToken) {
  const res = await fetch(`${API_URL}/api/dashboard/sessions`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  return checkResponse(res);  
}



export async function getDashboardOverview(accessToken) {
  const res = await fetch(`${API_URL}/api/dashboard/agent-overview`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  return checkResponse(res);
}

/** Lấy doanh thu hàng tháng */
export async function getRevenueMonthly(accessToken) {
  const res = await fetch(`${API_URL}/api/dashboard/revenue-monthly`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  return checkResponse(res);
}


export async function getSessions(accessToken, { page = 1, limit = 10, search = '' } = {}) {
  if (!accessToken) throw new Error('Thiếu accessToken');

  let qs = `?page=${page}&limit=${limit}`;
  if (search) qs += `&search=${encodeURIComponent(search)}`;

  const res = await fetch(`${API_URL}/api/session${qs}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
   
  return checkResponse(res);
}

export async function getOrders(accessToken, { page = 1, limit = 10, search = '' } = {}) {
  if (!accessToken) throw new Error('Thiếu accessToken');
  let qs = `?page=${page}&limit=${limit}`;
  if (search) qs += `&search=${encodeURIComponent(search)}`;
  const res = await fetch(`${API_URL}/api/order${qs}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  return checkResponse(res);  
}