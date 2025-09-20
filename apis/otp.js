// src/apis/resetPassword.js
import {API_PAY } from '@env';

const OTP_ENDPOINT = `${API_PAY}/api/sms/OTPgencode`;
const CHECK_OTP_ENDPOINT = `${API_PAY}/api/sms/OTPcheckcode-resetpass`;
const CHANGE_PASSWORD_ENDPOINT = `${API_PAY}/api/users/user-change-password`;

/**
 * BƯỚC 1: Gửi yêu cầu cấp lại mật khẩu (OTP reset)
 * @param {string} phoneNum - Số điện thoại
 * @returns {Promise<{kq:number, msg:any, code?:number, smsId?:string, message:string, raw:any}>}
 */
export async function sendResetOtp(phoneNum) {
  const body = new URLSearchParams();
  body.append('action', 'reset');
  body.append('phoneNum', phoneNum);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(OTP_ENDPOINT, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: body.toString(),
      signal: controller.signal,
    });

    const text = await res.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Phản hồi không hợp lệ từ máy chủ: ${text?.slice(0, 200) || ''}`);
    }

    const kq = Number(data?.kq ?? 0);
    const msgRaw = data?.msg ?? null;
    
    // Xử lý msg object hoặc string
    const code = Number(
      (typeof msgRaw === 'object' ? msgRaw?.CodeResult : undefined) ?? 0
    );
    
    const smsId = (typeof msgRaw === 'object' ? msgRaw?.SMSID : undefined) ?? null;

    let message;
    if (typeof msgRaw === 'string') {
      message = msgRaw;
    } else if (code === 100) {
      message = 'Đã gửi OTP, vui lòng kiểm tra SMS.';
    } else {
      message = `Gửi OTP thất bại (mã ${code}).`;
    }

    return { kq, msg: msgRaw, code, smsId, message, raw: data };
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Yêu cầu quá thời gian, vui lòng thử lại');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}


export async function sendActiveOtp(phoneNum) {
  const body = new URLSearchParams();
  body.append('action', 'register');
  body.append('phoneNum', phoneNum);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(OTP_ENDPOINT, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: body.toString(),
      signal: controller.signal,
    });

    const text = await res.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Phản hồi không hợp lệ từ máy chủ: ${text?.slice(0, 200) || ''}`);
    }

    const kq = Number(data?.kq ?? 0);
    const msgRaw = data?.msg ?? null;
    
    // Xử lý msg object hoặc string
    const code = Number(
      (typeof msgRaw === 'object' ? msgRaw?.CodeResult : undefined) ?? 0
    );
    
    const smsId = (typeof msgRaw === 'object' ? msgRaw?.SMSID : undefined) ?? null;

    let message;
    if (typeof msgRaw === 'string') {
      message = msgRaw;
    } else if (code === 100) {
      message = 'Đã gửi OTP, vui lòng kiểm tra SMS.';
    } else {
      message = `Gửi OTP thất bại (mã ${code}).`;
    }

    return { kq, msg: msgRaw, code, smsId, message, raw: data };
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Yêu cầu quá thời gian, vui lòng thử lại');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * BƯỚC 2: Verify OTP reset password
 * @param {string} username - Số điện thoại (username)
 * @param {string} otp - Mã OTP
 * @returns {Promise<{kq:number, msg:any, password_reset_token?:string, message:string, raw:any}>}
 */
export async function verifyResetOtp(username, otp) {
  const body = new URLSearchParams();
  body.append('username', username);
  body.append('OTP', otp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(CHECK_OTP_ENDPOINT, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: body.toString(),
      signal: controller.signal,
    });

    const text = await res.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Phản hồi không hợp lệ từ máy chủ: ${text?.slice(0, 200) || ''}`);
    }

    const kq = Number(data?.kq ?? 0);
    const msgRaw = data?.msg ?? null;
    
    // Lấy password_reset_token từ response
    const password_reset_token = (typeof msgRaw === 'object' ? msgRaw?.password_reset_token : undefined) 
      ?? data?.password_reset_token 
      ?? null;

    let message;
    if (kq === 1) {
      message = 'Xác minh OTP thành công';
    } else if (typeof msgRaw === 'string') {
      message = msgRaw;
    } else {
      message = 'Mã OTP không chính xác hoặc đã hết hạn';
    }

    return { 
      kq, 
      msg: msgRaw, 
      password_reset_token, 
      message, 
      raw: data 
    };
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Yêu cầu quá thời gian, vui lòng thử lại');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * BƯỚC 3: Đặt mật khẩu mới
 * @param {string} password - Mật khẩu mới
 * @param {string} passwordResetToken - Token từ bước 2
 * @param {string} confirmPassword - Xác nhận mật khẩu (optional)
 * @returns {Promise<{kq:number, msg:any, message:string, raw:any}>}
 */
export async function changePasswordWithToken(password, passwordResetToken, confirmPassword = null) {
  const body = new URLSearchParams();
  body.append('password', password);
  body.append('password_reset_token', passwordResetToken);
  
  // Thêm confirm_password nếu có
  if (confirmPassword) {
    body.append('confirm_password', confirmPassword);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(CHANGE_PASSWORD_ENDPOINT, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: body.toString(),
      signal: controller.signal,
    });

    const text = await res.text();
    let data;
    
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Phản hồi không hợp lệ từ máy chủ: ${text?.slice(0, 200) || ''}`);
    }

    const kq = Number(data?.kq ?? 0);
    const msgRaw = data?.msg ?? null;

    let message;
    if (kq === 1) {
      message = 'Đặt lại mật khẩu thành công';
    } else if (typeof msgRaw === 'string') {
      message = msgRaw;
    } else {
      message = 'Đặt lại mật khẩu thất bại, vui lòng thử lại';
    }

    return { 
      kq, 
      msg: msgRaw, 
      message, 
      raw: data 
    };
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Yêu cầu quá thời gian, vui lòng thử lại');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Validate password strength
 * @param {string} password 
 * @returns {{isValid: boolean, errors: string[]}}
 */
export function validatePassword(password) {
  const errors = [];
  
  if (!password) {
    errors.push('Mật khẩu không được để trống');
  } else {
    if (password.length < 6) {
      errors.push('Mật khẩu phải có ít nhất 6 ký tự');
    }
    if (password.length > 50) {
      errors.push('Mật khẩu không được quá 50 ký tự');
    }
    // Có thể thêm các rule khác nếu cần
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate OTP format
 * @param {string} otp 
 * @returns {boolean}
 */
export function validateOTP(otp) {
  return /^\d{6}$/.test(otp);
}

/**
 * Validate phone number
 * @param {string} phoneNum 
 * @returns {boolean}
 */
export function validatePhoneNumber(phoneNum) {
  const cleaned = phoneNum.replace(/\D/g, '');
  return /^0\d{9,10}$/.test(cleaned);
}