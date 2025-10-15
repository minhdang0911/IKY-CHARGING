import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, BackHandler } from 'react-native';
import SimpleHeader from '../../components/headers/SimpleHeader';
import PasswordField from '../../components/form/PasswordField';
import useLanguage from '../../Hooks/useLanguage';
import useChangePassword from '../../Hooks/useChangePassword';
import { STRINGS } from '../../i18n/strings';
import { showMessage } from '../../components/Toast/Toast';

const PRIMARY = '#1e88e5';
const BORDER  = '#e5e7eb';
const TEXT    = '#0f172a';

export default function ChangePassword({ navigateToScreen, navigation }) {
  const { language } = useLanguage('vi');
  const t = (k) => STRINGS[language]?.[k] || k;

  const goBackInfo = useCallback(() => {
    navigateToScreen && navigateToScreen('Information');
    return true;
  }, [navigateToScreen]);

  const { form, show, focus, loading, onChange, toggle, setFoc, submit } =
    useChangePassword({ t, onSuccess: goBackInfo });

  // ✅ Block back trong React Navigation (giữ nguyên)
  useEffect(() => {
    const sub = navigation?.addListener?.('beforeRemove', (e) => {
      e.preventDefault();
      goBackInfo();
    });
    return sub;
  }, [navigation, goBackInfo]);

  // ✅ Hardware Back Android
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBackInfo);
    return () => sub.remove();
  }, [goBackInfo]);

  // ✅ Chặn nút Back của browser (Web) – same logic như ChangeInfo
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Đưa URL về root (tuỳ app, m muốn để path nào thì sửa ở đây)
    const TARGET_PATH = '/';
    // Ghim URL hiện tại
    window.history.replaceState(null, '', TARGET_PATH);

    const handlePopState = () => {
      // Giữ URL không đổi
      window.history.replaceState(null, '', TARGET_PATH);
      // Điều hướng về màn Information thay vì rời trang
      goBackInfo();
    };

    // Push một state để bắt được sự kiện back
    window.history.pushState(null, '', TARGET_PATH);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [goBackInfo]);

  return (
    <View style={styles.container}>
      <SimpleHeader title={t('cp_header')} onBack={goBackInfo} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>
            <PasswordField
              label={t('cp_currentLabel')}
              placeholder={t('cp_currentPH')}
              value={form.currentPassword}
              onChangeText={(v) => onChange('currentPassword', v)}
              visible={show.current}
              onToggleVisible={() => toggle('current')}
              focused={focus.current}
              onFocus={() => setFoc('current', true)}
              onBlur={() => setFoc('current', false)}
            />

            <PasswordField
              label={t('cp_newLabel')}
              placeholder={t('cp_newPH')}
              value={form.newPassword}
              onChangeText={(v) => onChange('newPassword', v)}
              visible={show.new}
              onToggleVisible={() => toggle('new')}
              focused={focus.new}
              onFocus={() => setFoc('new', true)}
              onBlur={() => setFoc('new', false)}
            />

            <PasswordField
              label={t('cp_confirmLabel')}
              placeholder={t('cp_confirmPH')}
              value={form.confirmPassword}
              onChangeText={(v) => onChange('confirmPassword', v)}
              visible={show.confirm}
              onToggleVisible={() => toggle('confirm')}
              focused={focus.confirm}
              onFocus={() => setFoc('confirm', true)}
              onBlur={() => setFoc('confirm', false)}
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.75 }]}
              onPress={() => submit({ notify: showMessage })}
              disabled={loading}
              activeOpacity={0.9}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color="#fff" />
                  <Text style={[styles.primaryBtnText, { marginLeft: 8 }]}>{t('cp_processing')}</Text>
                </>
              ) : (
                <Text style={styles.primaryBtnText}>{t('cp_agree')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.ghostBtn} onPress={goBackInfo} activeOpacity={0.9}>
              <Text style={styles.ghostBtnText}>{t('cp_close')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc' },
  body: { padding: 16, paddingBottom: 24 },

  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: BORDER,
    padding: 14,
  },

  actions: { marginTop: 16, gap: 10 },
  primaryBtn: {
    height: 48, borderRadius: 12, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center', flexDirection: 'row',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  ghostBtn: {
    height: 48, borderRadius: 12, backgroundColor: '#fff',
    borderWidth: 1.2, borderColor: BORDER, alignItems: 'center', justifyContent: 'center',
  },
  ghostBtnText: { color: TEXT, fontSize: 15, fontWeight: '700' },
});
