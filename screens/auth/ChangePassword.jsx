// screens/auth/ChangePassword.jsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { changePassword } from '../../apis/auth';
import { showMessage } from '../../components/Toast/Toast';

const PRIMARY = '#1e88e5';
const BORDER  = '#e5e7eb';
const MUTED   = '#667085';
const TEXT    = '#0f172a';

const LANG_KEY = 'app_language';

const STRINGS = {
  vi: {
    header: 'Đổi mật khẩu',
    currentLabel: 'Mật khẩu cũ',
    currentPH: 'Mật khẩu cũ',
    newLabel: 'Mật khẩu mới',
    newPH: 'Mật khẩu mới',
    confirmLabel: 'Nhập lại mật khẩu mới',
    confirmPH: 'Nhập lại mật khẩu mới',
    agree: 'Đồng ý',
    processing: 'Đang xử lý…',
    close: 'Đóng',
    needAll: 'Vui lòng điền đầy đủ thông tin!',
    mismatch: 'Mật khẩu mới và Xác nhận mật khẩu mới không khớp.',
    tooShort: 'Mật khẩu mới phải có ít nhất 6 ký tự!',
    noToken: 'Thiếu access token. Vui lòng đăng nhập lại.',
    success: 'Mật khẩu đã được thay đổi thành công!',
    fail: 'Đổi mật khẩu thất bại',
  },
  en: {
    header: 'Change password',
    currentLabel: 'Current password',
    currentPH: 'Current password',
    newLabel: 'New password',
    newPH: 'New password',
    confirmLabel: 'Confirm new password',
    confirmPH: 'Confirm new password',
    agree: 'Confirm',
    processing: 'Processing…',
    close: 'Close',
    needAll: 'Please fill in all fields!',
    mismatch: 'New password and confirmation do not match.',
    tooShort: 'New password must be at least 6 characters!',
    noToken: 'Missing access token. Please sign in again.',
    success: 'Password changed successfully!',
    fail: 'Password change failed',
  },
};

const ChangePassword = ({ navigateToScreen, navigation }) => {
  const [language, setLanguage] = useState('vi');
  const t = (k) => STRINGS[language][k] || k;

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (saved) setLanguage(saved);
      } catch {}
    })();
  }, []);

  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [show, setShow] = useState({ current: false, new: false, confirm: false });
  const [focus, setFocus] = useState({ current: false, new: false, confirm: false });
  const [loading, setLoading] = useState(false);

  // ===== BACK HANDLERS =====
  const goBackInfo = useCallback(() => {
    navigateToScreen && navigateToScreen('Information');
    return true;
  }, [navigateToScreen]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBackInfo);
    return () => sub.remove();
  }, [goBackInfo]);

  useEffect(() => {
    if (!navigation || typeof navigation.addListener !== 'function') return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      goBackInfo();
    });
    return unsub;
  }, [navigation, goBackInfo]);

  // ===== FORM =====
  const onChange = (field, value) => setForm((p) => ({ ...p, [field]: value }));
  const toggle = (field) => setShow((p) => ({ ...p, [field]: !p[field] }));

  const handleAgree = async () => {
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) {
      showMessage(t('needAll')); return;
    }
    if (form.newPassword !== form.confirmPassword) {
      showMessage(t('mismatch')); return;
    }
    if (form.newPassword.length < 6) {
      showMessage(t('tooShort')); return;
    }
    if (loading) return;

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('access_token');
      if (!token) { showMessage(t('noToken')); return; }

      await changePassword(token, {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
        confirmPassword: form.confirmPassword,
      });

      showMessage(t('success'));
      goBackInfo();
    } catch (err) {
      let msg = err?.message || t('fail');
      try {
        const parsed = JSON.parse(err.message);
        msg = parsed?.message || msg;
      } catch {}
      showMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBackInfo} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('header')}</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigateToScreen && navigateToScreen('notification', { from: 'changePassword' })}
        >
          <Icon name="notifications" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Body (KAV + Scroll nhẹ để tránh keyboard che trên máy nhỏ) */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            {/* Current */}
            <Text style={styles.label}>{t('currentLabel')}</Text>
            <View style={[styles.inputRow, focus.current && styles.inputRowFocus]}>
              <View style={styles.leftIconBox}><Icon name="lock" size={18} color={PRIMARY} /></View>
              <TextInput
                style={styles.input}
                value={form.currentPassword}
                onChangeText={(v) => onChange('currentPassword', v)}
                placeholder={t('currentPH')}
                placeholderTextColor="#9aa4b2"
                secureTextEntry={!show.current}
                autoCapitalize="none"
                onFocus={() => setFocus((f) => ({ ...f, current: true }))}
                onBlur={() => setFocus((f) => ({ ...f, current: false }))}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => toggle('current')}>
                <Icon name={show.current ? 'visibility-off' : 'visibility'} size={20} color="#98a2b3" />
              </TouchableOpacity>
            </View>

            {/* New */}
            <Text style={styles.label}>{t('newLabel')}</Text>
            <View style={[styles.inputRow, focus.new && styles.inputRowFocus]}>
              <View style={styles.leftIconBox}><Icon name="lock" size={18} color={PRIMARY} /></View>
              <TextInput
                style={styles.input}
                value={form.newPassword}
                onChangeText={(v) => onChange('newPassword', v)}
                placeholder={t('newPH')}
                placeholderTextColor="#9aa4b2"
                secureTextEntry={!show.new}
                autoCapitalize="none"
                onFocus={() => setFocus((f) => ({ ...f, new: true }))}
                onBlur={() => setFocus((f) => ({ ...f, new: false }))}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => toggle('new')}>
                <Icon name={show.new ? 'visibility-off' : 'visibility'} size={20} color="#98a2b3" />
              </TouchableOpacity>
            </View>

            {/* Confirm */}
            <Text style={styles.label}>{t('confirmLabel')}</Text>
            <View style={[styles.inputRow, focus.confirm && styles.inputRowFocus]}>
              <View style={styles.leftIconBox}><Icon name="lock" size={18} color={PRIMARY} /></View>
              <TextInput
                style={styles.input}
                value={form.confirmPassword}
                onChangeText={(v) => onChange('confirmPassword', v)}
                placeholder={t('confirmPH')}
                placeholderTextColor="#9aa4b2"
                secureTextEntry={!show.confirm}
                autoCapitalize="none"
                onFocus={() => setFocus((f) => ({ ...f, confirm: true }))}
                onBlur={() => setFocus((f) => ({ ...f, confirm: false }))}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => toggle('confirm')}>
                <Icon name={show.confirm ? 'visibility-off' : 'visibility'} size={20} color="#98a2b3" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.7 }]}
              onPress={handleAgree}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={[styles.primaryBtnText, { marginLeft: 8 }]}>{t('processing')}</Text>
                </>
              ) : (
                <Text style={styles.primaryBtnText}>{t('agree')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.ghostBtn} onPress={goBackInfo} activeOpacity={0.9}>
              <Text style={styles.ghostBtnText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc' },

  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { padding: 6, marginRight: 6 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },
  headerBtn: { padding: 6 },

  body: { padding: 16, paddingBottom: 24 },

  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: BORDER,
    padding: 14,
  },

  label: { fontSize: 12, color: MUTED, marginTop: 8, marginBottom: 6, fontWeight: '700' },

  inputRow: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: BORDER,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputRowFocus: {
    borderColor: PRIMARY,
    shadowColor: '#1e88e5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0,
    shadowRadius: 6,
    elevation: Platform.OS === 'android' ? 2 : 0,
  },

  leftIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },

  input: { flex: 1, fontSize: 15, color: TEXT, paddingVertical: 0 },
  eyeBtn: { padding: 6, marginLeft: 6 },

  actions: { marginTop: 16, gap: 10 },

  primaryBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  ghostBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1.2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtnText: { color: TEXT, fontSize: 15, fontWeight: '700' },
});

export default ChangePassword;
