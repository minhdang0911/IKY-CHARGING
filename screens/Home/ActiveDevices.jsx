// screens/Auth/ActiveDeviceOTPScreen.jsx
import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_PAY } from '@env';
import iconsMail from '../../assets/img/ic_received_message.png';
import { showMessage } from '../../components/Toast/Toast';

// ======== API helpers ========
const toForm = (data) =>
  Object.entries(data)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');

async function postForm(url, formObj, { timeoutMs = 15000, accessToken } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    const res = await fetch(url, { method: 'POST', headers, body: toForm(formObj), signal: controller.signal });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { kq: 0, msg: text }; }
    return { httpStatus: res.status, data, rawText: text };
  } finally { clearTimeout(timeout); }
}

const getAccessToken = async () =>
  (await AsyncStorage.getItem('access_token')) ||
  (await AsyncStorage.getItem('accessToken')) ||
  (await AsyncStorage.getItem('token'));

const OTP_GEN = `${API_PAY}/api/sms/OTPgencode`;
const ACTIVATE_BY_OTP = `${API_PAY}/api/devices/activeByOTP`;

async function sendActiveOTP(phoneNum) {
  const { data } = await postForm(OTP_GEN, { action: 'register', phoneNum });
  return { kq: Number(data?.kq ?? 0), msg: data?.msg ?? null, raw: data };
}

async function activateDeviceByOTP({ id, phoneNum, OTP }) {
  const accessToken = await getAccessToken();
  const { data } = await postForm(ACTIVATE_BY_OTP, { id, phoneNum, OTP }, { accessToken });
  return { kq: Number(data?.kq ?? 0), msg: data?.msg ?? null, raw: data };
}

// ======== i18n ========
const LANG_KEY = 'app_language';
const STRINGS = {
  vi: {
    title: 'Nhập mã OTP',
    subtitle: 'Mã OTP đã được gửi về số điện thoại',
    notFoundPhoneTitle: 'Lỗi',
    notFoundPhoneMsg: 'Không tìm thấy số điện thoại',
    resendTitleSuccess: 'Thành công',
    resendSuccess: 'Đã gửi lại mã OTP',
    resendTitleError: 'Lỗi',
    resendError: 'Gửi mã OTP thất bại. Vui lòng thử lại.',
    resendBtnIdle: 'GỬI LẠI',
    seconds: 'GIÂY',
    notReceive: 'Không nhận được mã OTP?',
    confirm: 'Đồng ý',
    close: 'Đóng',
    otpTooShortTitle: 'Lỗi',
    otpTooShortMsg: 'Vui lòng nhập đủ 6 số OTP',
    otpInvalidTitle: 'Lỗi',
    otpInvalidMsg: 'Mã OTP phải là 6 chữ số',
    verifySuccessTitle: 'Thành công',
    verifySuccessMsg: 'Kích hoạt thiết bị thành công',
    verifyErrorTitle: 'Lỗi',
    verifyErrorMsg: 'OTP không hợp lệ hoặc đã hết hạn',
  },
  en: {
    title: 'Enter OTP',
    subtitle: 'An OTP has been sent to your phone number',
    notFoundPhoneTitle: 'Error',
    notFoundPhoneMsg: 'Phone number not found',
    resendTitleSuccess: 'Success',
    resendSuccess: 'OTP resent',
    resendTitleError: 'Error',
    resendError: 'Failed to send OTP. Please try again.',
    resendBtnIdle: 'RESEND',
    seconds: 'SECONDS',
    notReceive: "Didn't receive the OTP?",
    confirm: 'Confirm',
    close: 'Close',
    otpTooShortTitle: 'Error',
    otpTooShortMsg: 'Please enter all 6 OTP digits',
    otpInvalidTitle: 'Error',
    otpInvalidMsg: 'OTP must be 6 digits',
    verifySuccessTitle: 'Success',
    verifySuccessMsg: 'Device activated successfully',
    verifyErrorTitle: 'Error',
    verifyErrorMsg: 'Invalid or expired OTP',
  },
};
const validateOTP = (otp) => /^\d{6}$/.test(otp);

function ActiveDeviceOTPScreen({ navigateToScreen }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [isCountingDown, setIsCountingDown] = useState(true);
  const [phoneNum, setPhoneNum] = useState('');
  const [deviceId, setDeviceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState('vi');
  const inputRefs = useRef([]);

  const t = (k) => STRINGS[language][k] || k;

  // Load language + phone + deviceId
  useEffect(() => {
    (async () => {
      try {
        const [lang, phone, id] = await Promise.all([
          AsyncStorage.getItem(LANG_KEY),
          AsyncStorage.getItem('active_phone'),
          AsyncStorage.getItem('active_device_id'),
        ]);
        if (lang) setLanguage(lang);
        if (phone) setPhoneNum(phone);
        if (id) setDeviceId(id);
        if (!phone || !id) {
          showMessage(`${t('notFoundPhoneTitle')}: ${t('notFoundPhoneMsg')}`);
        }
      } catch {
        showMessage(`${t('notFoundPhoneTitle')}: ${t('notFoundPhoneMsg')}`);
      }
    })();
  }, []);

  // Countdown
  useEffect(() => {
    let interval = null;
    if (isCountingDown && countdown > 0) {
      interval = setInterval(() => setCountdown((c) => c - 1), 1000);
    } else if (countdown === 0) {
      setIsCountingDown(false);
    }
    return () => clearInterval(interval);
  }, [isCountingDown, countdown]);

  const handleOtpChange = (text, index) => {
    const cleaned = text.replace(/\D/g, '').slice(0, 1);
    const newOtp = [...otp];
    newOtp[index] = cleaned;
    setOtp(newOtp);
    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOTP = async () => {
    if (!phoneNum) {
      showMessage(`${t('notFoundPhoneTitle')}: ${t('notFoundPhoneMsg')}`);
      return;
    }
    try {
      setLoading(true);
      const res = await sendActiveOTP(phoneNum);
      if (res.kq === 1) {
        showMessage(`${t('resendTitleSuccess')}: ${t('resendSuccess')}`);
        setCountdown(60);
        setIsCountingDown(true);
      } else {
        showMessage(`${t('resendTitleError')}: ${res?.msg || t('resendError')}`);
      }
    } catch (error) {
      showMessage(`${t('resendTitleError')}: ${error?.message || t('resendError')}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    const otpString = otp.join('');
    if (otpString.length < 6) {
      showMessage(`${t('otpTooShortTitle')}: ${t('otpTooShortMsg')}`);
      return;
    }
    if (!validateOTP(otpString)) {
      showMessage(`${t('otpInvalidTitle')}: ${t('otpInvalidMsg')}`);
      return;
    }
    if (!phoneNum || !deviceId) {
      showMessage(`${t('notFoundPhoneTitle')}: ${t('notFoundPhoneMsg')}`);
      return;
    }

    setLoading(true);
    try {
      const res = await activateDeviceByOTP({ id: deviceId, phoneNum, OTP: otpString });
      if (res.kq === 1) {
        showMessage(`${t('verifySuccessTitle')}: ${t('verifySuccessMsg')}`);
        await AsyncStorage.multiRemove(['active_phone', 'active_device_id']);
        navigateToScreen('Monitoring');
      } else {
        showMessage(`${t('verifyErrorTitle')}: ${res?.msg || t('verifyErrorMsg')}`);
      }
    } catch (error) {
      showMessage(`${t('verifyErrorTitle')}: ${error?.message || t('verifyErrorMsg')}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Image source={iconsMail} style={styles.mailIcon} resizeMode="contain" />
        </View>

        <Text style={styles.title}>{t('title')}</Text>
        <Text style={styles.subtitle}>{t('subtitle')}</Text>
        <Text style={styles.phoneNumber}>{phoneNum}</Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="numeric"
              maxLength={1}
              textAlign="center"
            />
          ))}
        </View>

        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>{t('notReceive')}</Text>
          <TouchableOpacity
            onPress={handleResendOTP}
            disabled={isCountingDown || loading}
            style={styles.resendButton}
          >
            <Text style={[
              styles.resendButtonText,
              !isCountingDown && !loading && styles.resendButtonTextActive,
            ]}>
              {isCountingDown ? `${countdown} ${t('seconds')}` : t('resendBtnIdle')}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.confirmButton, (loading || otp.join('').length < 6) && { opacity: 0.6 }]}
          onPress={handleConfirm}
          disabled={loading || otp.join('').length < 6}
        >
          <Text style={styles.confirmButtonText}>{t('confirm')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.closeButton} onPress={() => navigateToScreen('Monitoring')}>
          <Text style={styles.closeButtonText}>{t('close')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = {
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, paddingHorizontal: 40, paddingTop: 80, alignItems: 'center' },
  iconContainer: { marginBottom: 40 },
  mailIcon: { width: 100, height: 100 },
  title: { fontSize: 24, fontWeight: '600', color: '#4A90E2', textAlign: 'center', marginBottom: 20 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 10 },
  phoneNumber: { fontSize: 18, fontWeight: '600', color: '#333', textAlign: 'center', marginBottom: 40 },
  otpContainer: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 40 },
  otpInput: {
    width: 45, height: 50, borderBottomWidth: 3, borderBottomColor: '#E0E0E0',
    backgroundColor: 'transparent', fontSize: 18, fontWeight: '600', color: '#333', textAlign: 'center', paddingBottom: 8,
  },
  otpInputFilled: { borderBottomColor: '#4A90E2' },
  resendContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 40 },
  resendText: { fontSize: 14, color: '#666' },
  resendButton: { padding: 5 },
  resendButtonText: { fontSize: 14, color: '#999', fontWeight: '600' },
  resendButtonTextActive: { color: '#FF4444' },
  confirmButton: { backgroundColor: '#4A90E2', paddingVertical: 16, borderRadius: 25, alignItems: 'center', width: '100%', marginBottom: 16 },
  confirmButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
  closeButton: { backgroundColor: 'transparent', paddingVertical: 16, borderRadius: 25, borderWidth: 1, borderColor: '#E0E0E0', alignItems: 'center', width: '100%' },
  closeButtonText: { color: '#666', fontSize: 16, fontWeight: '600' },
};

export default ActiveDeviceOTPScreen;
