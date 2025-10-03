import { API_URL } from '@env';

/* ================= Helper check response ================= */
const checkResponse = async (res) => {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || 'API error');
  }
  return res.json();
};

/**
 * Lấy danh sách pricing plan public theo agentId
 * @param {string} agentId - ID của đại lý
 * @returns {Promise<Object>} JSON response từ server
 */
export async function getPublicPricingPlans(agentId) {
  if (!agentId) throw new Error('Thiếu agentId');

  const res = await fetch(`${API_URL}/api/pricingplan/public/${agentId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const data = await checkResponse(res);
  
  return data;
}

export async function createOrder(accessToken, payload) {
  if (!accessToken) throw new Error('Thiếu accessToken');
  if (!payload || typeof payload !== 'object') throw new Error('Thiếu payload hợp lệ');

  try {
    const res = await fetch(`${API_URL}/api/order`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

     
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = data?.message || res.statusText || 'Có lỗi xảy ra';
      throw new Error(msg);
    }

    return data;
  } catch (err) {
    throw new Error(err?.message || String(err));
  }
}



export async function createOrderCash(accessToken, payload) {
  if (!accessToken) throw new Error('Thiếu accessToken');
  if (!payload || typeof payload !== 'object') throw new Error('Thiếu payload hợp lệ');

  try {
    const res = await fetch(`${API_URL}/api/order/create`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

     
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = data?.message || res.statusText || 'Có lỗi xảy ra';
      throw new Error(msg);
    }

    return data;
  } catch (err) {
    throw new Error(err?.message || String(err));
  }
}
