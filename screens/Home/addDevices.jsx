// screens/Home/AddDevices.jsx
import React, { useEffect, useMemo, useState, useContext, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Modal,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Clipboard, BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationContext } from '../../App';
import { getDeviceInfo, addDevice } from '../../apis/devices';

const LANG_KEY = 'app_language';
const STRINGS = {
  vi: {
    header: 'Thêm thiết bị',
    imeiLabel: 'IMEI thiết bị',
    imeiPlaceholder: 'Nhập IMEI…',
    imeiHint: 'IMEI thường có khoảng 15 chữ số.',
    tempDevices: (n) => `Đang có ${n} thiết bị trong bộ nhớ tạm.`,
    agree: 'Đồng ý',
    close: 'Đóng',
    confirmTitle: 'Xác nhận thông tin',
    plate: 'Biển số xe',
    driver: 'Lái xe',
    phone: 'SĐT thiết bị',
    imei: 'IMEI',
    errEmpty: 'Vui lòng nhập IMEI thiết bị!',
    errNotFound: 'Không tìm thấy thông tin IMEI.',
    errFormat: 'IMEI chỉ được chứa số.',
    errAdd: 'Thêm thiết bị thất bại.',
    success: 'Thiết bị đã được thêm thành công!',
    paste: 'Dán',
    clear: 'Xoá',
    checking: 'Đang kiểm tra…',
    adding: 'Đang thêm…'
  },
  en: {
    header: 'Add Device',
    imeiLabel: 'Device IMEI',
    imeiPlaceholder: 'Enter IMEI…',
    imeiHint: 'IMEI usually has around 15 digits.',
    tempDevices: (n) => `${n} devices in temporary memory.`,
    agree: 'Confirm',
    close: 'Close',
    confirmTitle: 'Confirm Information',
    plate: 'License Plate',
    driver: 'Driver',
    phone: 'Device Phone',
    imei: 'IMEI',
    errEmpty: 'Please enter device IMEI!',
    errNotFound: 'IMEI not found.',
    errFormat: 'IMEI must contain digits only.',
    errAdd: 'Add device failed.',
    success: 'Device has been successfully added!',
    paste: 'Paste',
    clear: 'Clear',
    checking: 'Checking…',
    adding: 'Adding…'
  }
};

const normIMEI = (s) => String(s || '').replace(/\D/g, '').trim();
const formatPhone = (p) => {
  const s = String(p || '').trim();
  if (!s) return '—';
  return s.length === 10 && s[0] !== '0' ? '0' + s : s;
};

export default function AddDevices({ navigateToScreen, screenData, navigation }) {
  const [lang, setLang] = useState('vi');
  const t = useMemo(() => STRINGS[lang] || STRINGS.vi, [lang]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (saved) setLang(saved);
      } catch {}
    })();
  }, []);

  const inputRef = useRef(null);

  const [deviceIMEI, setDeviceIMEI] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [inlineMsg, setInlineMsg] = useState(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmInfo, setConfirmInfo] = useState(null);
  const [rawInfo, setRawInfo] = useState(null);

  // Notification context
  const { notifications, setNotifications } = useContext(NotificationContext);
  const unreadCount = (notifications || []).filter(n => !n.isRead).length;
  const handleBellPress = () => {
    setNotifications?.(prev => prev.map(n => ({ ...n, isRead: true })));
    navigateToScreen('notification', { from: 'addDevices' });
  };

  const getAccessToken = async () =>
    screenData?.accessToken || (await AsyncStorage.getItem('access_token'));

  const digitsOnly = (s) => /^\d+$/.test(s);

  const handleAgreePress = async () => {
    const userImei = normIMEI(deviceIMEI);
    setInlineMsg(null);

    if (!userImei) {
      setInlineMsg({ type: 'error', text: t.errEmpty });
      return;
    }
    if (!digitsOnly(userImei)) {
      setInlineMsg({ type: 'error', text: t.errFormat });
      return;
    }

    setLoading(true);
    await new Promise(r => setTimeout(r, 200));

    try {
      const token = await getAccessToken();
      const info = await getDeviceInfo(token, userImei);

      const ui = {
        vehicleNumber: info?.license_plate || info?.imei || '—',
        driver: info?.driver || '—',
        phone: formatPhone(info?.phone_number),
        imei: info?.imei || userImei,
      };

      setRawInfo(info);
      setConfirmInfo(ui);
      setConfirmOpen(true);
    } catch (e) {
      setInlineMsg({ type: 'error', text: t.errNotFound });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setAdding(true);
      const token = await getAccessToken();

      const payload = {
        device_category_id: String(rawInfo?.device_category_id || ''),
        vehicle_category_id: String(rawInfo?.vehicle_category_id || ''),
        imei: String(rawInfo?.imei || ''),
        phone_number: String(rawInfo?.phone_number || ''),
        driver: String(rawInfo?.driver || ''),
        license_plate: String(rawInfo?.license_plate || ''),
      };

      await addDevice(token, payload);

      setConfirmOpen(false);
      setInlineMsg({ type: 'success', text: t.success });
      setTimeout(() => navigateToScreen('Device'), 500);
    } catch (e) {
      setInlineMsg({ type: 'error', text: t.errAdd });
    } finally {
      setAdding(false);
    }
  };

  const handlePaste = async () => {
    try {
      const txt = await Clipboard.getString?.();
      if (txt) {
        setDeviceIMEI(normIMEI(txt));
        setInlineMsg(null);
        inputRef.current?.focus?.();
      }
    } catch {}
  };

  const handleClear = () => {
    setDeviceIMEI('');
    setInlineMsg(null);
    inputRef.current?.focus?.();
  };

  /* ===== Back handlers ===== */
  const goDevice = useCallback(() => {
    navigateToScreen && navigateToScreen('Device');
  }, [navigateToScreen]);

  const handleBack = useCallback(() => {
    // Ưu tiên đóng modal xác nhận trước
    if (confirmOpen) {
      setConfirmOpen(false);
      return true; // chặn default
    }
    // Nếu đang loading/adding có thể chặn back (tuỳ yêu cầu)
    if (loading || adding) {
      // chặn back khi đang tiến trình để tránh lỗi
      return true;
    }
    // điều hướng về màn Device
    goDevice();
    return true;
  }, [confirmOpen, loading, adding, goDevice]);

  // Android hardware back
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBack);
    return () => sub.remove();
  }, [handleBack]);

  // iOS back gesture (react-navigation)
  useEffect(() => {
    if (!navigation || typeof navigation.addListener !== 'function') return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      // Nếu người dùng vuốt back hoặc bấm back trên header iOS
      e.preventDefault();
      handleBack();
    });
    return unsub;
  }, [navigation, handleBack]);

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.iconBtn}>
              <Icon name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.headerTitle}>{t.header}</Text>

            <TouchableOpacity style={styles.iconBtn} onPress={handleBellPress}>
              <View style={styles.notificationContainer}>
                <Icon name="notifications" size={24} color="#fff" />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <Text style={styles.inputLabel}>{t.imeiLabel}</Text>

              <View style={[styles.inputWrap, isFocused && styles.inputWrapFocused]}>
                <Icon name="qr-code-scanner" size={20} color="#9aa1a9" style={{ marginRight: 8 }} />
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  value={deviceIMEI}
                  onChangeText={(txt) => {
                    const only = txt.replace(/\D/g, '');
                    setDeviceIMEI(only);
                    if (inlineMsg?.type === 'error') setInlineMsg(null);
                  }}
                  keyboardType="number-pad"
                  placeholder={t.imeiPlaceholder}
                  placeholderTextColor="#9aa1a9"
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  returnKeyType="done"
                  onSubmitEditing={handleAgreePress}
                  autoCapitalize="none"
                />
                {!!deviceIMEI && (
                  <TouchableOpacity onPress={handleClear} style={styles.smallIconBtn}>
                    <Icon name="close" size={18} color="#9aa1a9" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.helperRow}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity onPress={handlePaste} style={styles.ghostPill}>
                    <Icon name="content-paste" color="#4A90E2" size={16} />
                    <Text style={styles.ghostPillText}>{t.paste}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {inlineMsg && (
                <View style={[
                  styles.inlineMsg,
                  inlineMsg.type === 'error' && styles.inlineMsgError,
                  inlineMsg.type === 'success' && styles.inlineMsgSuccess
                ]}>
                  <Icon
                    name={inlineMsg.type === 'error' ? 'error-outline' : 'check-circle'}
                    size={18}
                    color={inlineMsg.type === 'error' ? '#d93025' : '#1e8e3e'}
                  />
                  <Text style={[
                    styles.inlineMsgText,
                    inlineMsg.type === 'error' && { color: '#d93025' },
                    inlineMsg.type === 'success' && { color: '#1e8e3e' }
                  ]}>
                    {inlineMsg.text}
                  </Text>
                </View>
              )}

              <View style={styles.ctaRow}>
                <TouchableOpacity
                  style={[styles.primaryBtn, (loading || !deviceIMEI) && styles.btnDisabled]}
                  onPress={handleAgreePress}
                  disabled={loading || !deviceIMEI}
                >
                  {(loading || adding) ? (
                    <>
                      <ActivityIndicator color="#fff" />
                      <Text style={styles.primaryBtnText}>{'  '}{loading ? t.checking : t.adding}</Text>
                    </>
                  ) : (
                    <>
                      <Icon name="done-all" color="#fff" size={18} />
                      <Text style={styles.primaryBtnText}>{'  '}{t.agree}</Text>
                    </>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.secondaryBtn} onPress={handleBack}>
                  <Icon name="arrow-back" color="#4A90E2" size={18} />
                  <Text style={styles.secondaryBtnText}>{'  '}{t.close}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* Bottom Sheet Modal */}
          <Modal
            visible={confirmOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setConfirmOpen(false)}
          >
            <View style={styles.overlay}>
              <View style={styles.sheet}>
                <View style={styles.sheetHandle} />
                <Text style={styles.sheetTitle}>{t.confirmTitle}</Text>

                <View style={styles.kv}>
                  <Text style={styles.kvLabel}>{t.plate}</Text>
                  <Text style={styles.kvValue}>{confirmInfo?.vehicleNumber}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.kvLabel}>{t.driver}</Text>
                  <Text style={styles.kvValue}>{confirmInfo?.driver}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.kvLabel}>{t.phone}</Text>
                  <Text style={styles.kvValue}>{confirmInfo?.phone}</Text>
                </View>
                <View style={styles.kv}>
                  <Text style={styles.kvLabel}>{t.imei}</Text>
                  <Text style={styles.kvValue}>{confirmInfo?.imei}</Text>
                </View>

                <View style={styles.sheetActions}>
                  <TouchableOpacity style={styles.sheetCancel} onPress={() => setConfirmOpen(false)}>
                    <Text style={styles.sheetCancelTxt}>{t.close}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.sheetOk}
                    onPress={handleConfirm}
                    disabled={adding}
                  >
                    {adding ? (
                      <>
                        <ActivityIndicator color="#fff" />
                        <Text style={styles.sheetOkTxt}>{'  '}{t.adding}</Text>
                      </>
                    ) : (
                      <>
                        <Icon name="check" size={18} color="#fff" />
                        <Text style={styles.sheetOkTxt}>{'  '}{t.agree}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f5f7fb' },
  container: { flex: 1 },

  header: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },

  notificationContainer: { position: 'relative' },
  badge: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: '#ff4444', borderRadius: 10, minWidth: 18, height: 18,
    paddingHorizontal: 3, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },

  content: { flex: 1, padding: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  inputLabel: { color: '#4A5568', fontSize: 14, fontWeight: '600', marginBottom: 8 },
  inputWrap: {
    borderWidth: 1, borderColor: '#cfd8e3', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center',
  },
  inputWrapFocused: { borderColor: '#4A90E2', shadowColor: '#4A90E2', shadowOpacity: 0.15, shadowRadius: 8 },
  input: { flex: 1, fontSize: 16, color: '#2d3748', paddingVertical: 0 },
  smallIconBtn: { padding: 6, marginLeft: 4 },

  helperRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  helperText: { color: '#94a3b8', fontSize: 12 },
  ghostPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#cfe0f5', backgroundColor: '#eff6ff' },
  ghostPillText: { color: '#4A90E2', fontSize: 13, fontWeight: '700' },

  inlineMsg: {
    marginTop: 12, padding: 10, borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1,
  },
  inlineMsgError: { borderColor: '#f1c1bc', backgroundColor: '#fdeceb' },
  inlineMsgSuccess: { borderColor: '#bfe5c7', backgroundColor: '#eaf7ee' },
  inlineMsgText: { fontSize: 13, flex: 1 },

  ctaRow: { marginTop: 16, gap: 10 },
  primaryBtn: {
    backgroundColor: '#4A90E2', borderRadius: 28, paddingVertical: 14, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnDisabled: { opacity: 0.55 },
  secondaryBtn: {
    backgroundColor: '#fff', borderRadius: 28, paddingVertical: 12, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row'
  },
  secondaryBtnText: { color: '#4A90E2', fontSize: 15, fontWeight: '700' },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16,
  },
  sheetHandle: {
    alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#cbd5e1', marginBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#1f2937', textAlign: 'center', marginBottom: 8 },

  kv: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  kvLabel: { color: '#64748b', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  kvValue: { color: '#111827', fontSize: 16, fontWeight: '700', marginTop: 2 },

  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  sheetCancel: { flex: 1, borderWidth: 1, borderColor: '#cfd8e3', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  sheetCancelTxt: { color: '#334155', fontSize: 15, fontWeight: '700' },
  sheetOk: { flex: 1, backgroundColor: '#0ea5e9', borderRadius: 14, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  sheetOkTxt: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
