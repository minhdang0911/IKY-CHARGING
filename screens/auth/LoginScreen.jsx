import React, { useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Image,
  Animated,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { login as loginApi } from '../../apis/auth';
import { showMessage } from '../../components/Toast/Toast';

const logo = require('../../assets/img/ic_splash.png');
const LANG_KEY = 'app_language';

const STRINGS = {
  vi: {
    welcome: 'Chào mừng quay lại',
    sub: 'Đăng nhập để tiếp tục',
    usernameLabel: 'Tên đăng nhập',
    usernamePH: 'Mặc định mã ID thiết bị',
    passwordLabel: 'Mật khẩu',
    passwordPH: 'Mặc định 8 số cuối trên thẻ BH',
    remember: 'Ghi nhớ đăng nhập',
    login: 'Đăng nhập',
    forgot: 'Quên mật khẩu?',
    language: 'Ngôn ngữ',
    vi: 'Tiếng Việt',
    en: 'English',
    support: 'CSKH',
    version: 'Phiên bản',
    needUserPass: 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu!',
    loginSuccess: 'Đăng nhập thành công!',
    loginFail: 'Đăng nhập thất bại',
    invalid: 'Tài khoản hoặc mật khẩu không chính xác',
    choosingLang: 'Chọn ngôn ngữ',
    cancel: 'Hủy',
  },
  en: {
    welcome: 'Welcome back',
    sub: 'Sign in to continue',
    usernameLabel: 'Username',
    usernamePH: 'Default device ID',
    passwordLabel: 'Password',
    passwordPH: 'Default last 8 digits on card',
    remember: 'Remember me',
    login: 'Log in',
    forgot: 'Forgot password?',
    language: 'Language',
    vi: 'Vietnamese',
    en: 'English',
    support: 'Support',
    version: 'Version',
    needUserPass: 'Please enter both username and password!',
    loginSuccess: 'Signed in successfully!',
    loginFail: 'Sign-in failed',
    invalid: 'Incorrect username or password',
    choosingLang: 'Choose language',
    cancel: 'Cancel',
  },
};

const LoginScreen = ({ navigateToScreen, login }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [language, setLanguage] = useState('vi');
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(true);
  const [showLangSheet, setShowLangSheet] = useState(false);
  const [errorText, setErrorText] = useState('');

  const t = (k) => STRINGS[language][k] || k;

  // refs
  const passwordRef = useRef(null);

  // floating labels
  const [usernameLabelAnimation] = useState(new Animated.Value(0));
  const [passwordLabelAnimation] = useState(new Animated.Value(0));
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // card shake animation when invalid
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const animateLabel = (v, to) =>
    Animated.timing(v, { toValue: to, duration: 180, useNativeDriver: false }).start();

  const handleUsernameFocus = () => {
    setUsernameFocused(true);
    animateLabel(usernameLabelAnimation, 1);
  };
  const handleUsernameBlur = () => {
    setUsernameFocused(false);
    if (!username) animateLabel(usernameLabelAnimation, 0);
  };
  const handlePasswordFocus = () => {
    setPasswordFocused(true);
    animateLabel(passwordLabelAnimation, 1);
  };
  const handlePasswordBlur = () => {
    setPasswordFocused(false);
    if (!password) animateLabel(passwordLabelAnimation, 0);
  };

  // load language & remembered username
  useEffect(() => {
    (async () => {
      try {
        const savedLang = await AsyncStorage.getItem(LANG_KEY);
        if (savedLang) setLanguage(savedLang);
        const rememberFlag = await AsyncStorage.getItem('remember_login');
        if (rememberFlag === '0') setRemember(false);
        const savedUser = await AsyncStorage.getItem('username');
        if (savedUser && rememberFlag !== '0') {
          setUsername(savedUser);
          animateLabel(usernameLabelAnimation, 1);
        }
      } catch {}
    })();
  }, []);

  const changeLanguage = async (lang) => {
    setLanguage(lang);
    setShowLangSheet(false);
    try {
      await AsyncStorage.setItem(LANG_KEY, lang);
    } catch {}
  };

  const bumpShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    setErrorText('');

    if (!username || !password) {
      setErrorText(t('needUserPass'));
      bumpShake();
      showMessage(t('needUserPass'));
      return;
    }
    if (loading) return;

    try {
      setLoading(true);
      const res = await loginApi(username.trim(), password);
      await AsyncStorage.setItem('access_token', res.access_token);
      await AsyncStorage.setItem('refresh_token', res.refresh_token || '');
      await AsyncStorage.setItem('username', username.trim());
      await AsyncStorage.setItem('remember_login', remember ? '1' : '0');

      login({ username });
      showMessage(t('loginSuccess'));
    } catch (err) {
      let msg = err?.message || t('loginFail');
      try {
        const parsed = JSON.parse(err.message);
        msg = parsed?.message || msg;
      } catch {}
      // đồng nhất thông điệp invalid
      setErrorText(t('invalid'));
      bumpShake();
      showMessage(t('invalid'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => navigateToScreen('ForgotPassword');

  const usernameLabelStyle = {
    position: 'absolute',
    left: 46,
    top: usernameLabelAnimation.interpolate({ inputRange: [0, 1], outputRange: [17, -9] }),
    fontSize: usernameLabelAnimation.interpolate({ inputRange: [0, 1], outputRange: [16, 12] }),
    color: usernameLabelAnimation.interpolate({ inputRange: [0, 1], outputRange: ['#9aa0a6', '#1e88e5'] }),
    backgroundColor: 'white',
    paddingHorizontal: 4,
    zIndex: 1,
  };
  const passwordLabelStyle = {
    position: 'absolute',
    left: 46,
    top: passwordLabelAnimation.interpolate({ inputRange: [0, 1], outputRange: [17, -9] }),
    fontSize: passwordLabelAnimation.interpolate({ inputRange: [0, 1], outputRange: [16, 12] }),
    color: passwordLabelAnimation.interpolate({ inputRange: [0, 1], outputRange: ['#9aa0a6', '#1e88e5'] }),
    backgroundColor: 'white',
    paddingHorizontal: 4,
    zIndex: 1,
  };

  const disabled = !username || !password || loading;

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* soft gradient bg */}
        <View style={styles.headerBg} />
        <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
          <View style={styles.topBrand}>
            <Image source={logo} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.title}>{t('welcome')}</Text>
            <Text style={styles.subtitle}>{t('sub')}</Text>
          </View>

          <Animated.View
            style={[
              styles.card,
              {
                transform: [
                  {
                    translateX: shakeAnim.interpolate({
                      inputRange: [-1, 0, 1],
                      outputRange: [-8, 0, 8],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* Username */}
            <View style={[styles.inputContainer, usernameFocused && styles.inputFocused]}>
              <Animated.Text style={usernameLabelStyle}>{t('usernameLabel')}</Animated.Text>
              <Icon name="person" size={20} color={usernameFocused ? '#1e88e5' : '#9aa0a6'} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder={usernameFocused || username ? t('usernamePH') : ''}
                placeholderTextColor="#9aa0a6"
                value={username}
                onChangeText={(v) => {
                  setUsername(v);
                  if (!v) setErrorText('');
                }}
                onFocus={handleUsernameFocus}
                onBlur={handleUsernameBlur}
                autoCapitalize="none"
                autoComplete="username"
                keyboardType="default"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                blurOnSubmit={false}
              />
            </View>

            {/* Password */}
            <View style={[styles.inputContainer, passwordFocused && styles.inputFocused]}>
              <Animated.Text style={passwordLabelStyle}>{t('passwordLabel')}</Animated.Text>
              <Icon name="lock" size={20} color={passwordFocused ? '#1e88e5' : '#9aa0a6'} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={styles.input}
                placeholder={passwordFocused || password ? t('passwordPH') : ''}
                placeholderTextColor="#9aa0a6"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  if (!v) setErrorText('');
                }}
                onFocus={handlePasswordFocus}
                onBlur={handlePasswordBlur}
                autoComplete="password"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity style={styles.eyeIcon} onPress={() => setShowPassword((s) => !s)}>
                <Icon name={showPassword ? 'visibility' : 'visibility-off'} size={20} color="#9aa0a6" />
              </TouchableOpacity>
            </View>

            {/* Error inline */}
            {!!errorText && <Text style={styles.errorText}>{errorText}</Text>}

            {/* Remember + Forgot */}
            <View style={styles.rowBetween}>
              <TouchableOpacity
                onPress={() => setRemember((r) => !r)}
                style={styles.rememberWrap}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {/* <View style={[styles.checkbox, remember && styles.checkboxChecked]}>
                  {remember ? <Icon name="check" size={16} color="#fff" /> : null}
                </View>
                <Text style={styles.rememberText}>{t('remember')}</Text> */}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleForgotPassword}>
                <Text style={styles.forgotPasswordText}>{t('forgot')}</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, disabled && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={disabled}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>{t('login')}</Text>}
            </TouchableOpacity>
          </Animated.View>

          {/* Language & Footer */}
          <View style={styles.bottomArea}>
            <TouchableOpacity style={styles.langBtn} onPress={() => setShowLangSheet(true)}>
              <Icon name="translate" size={18} color="#1e88e5" />
              <Text style={styles.langText}>
                {t('language')}: {language === 'vi' ? t('vi') : t('en')}
              </Text>
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('support')}: 0902 806 999</Text>
              <Text style={styles.versionText}>{t('version')}: 1.125 Release1</Text>
            </View>
          </View>
        </Pressable>
      </ScrollView>

      {/* Language Bottom Sheet */}
      <Modal visible={showLangSheet} transparent animationType="fade" onRequestClose={() => setShowLangSheet(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setShowLangSheet(false)} />
        <View style={styles.sheetWrap}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>{t('choosingLang')}</Text>
          <TouchableOpacity style={styles.sheetItem} onPress={() => changeLanguage('vi')}>
            <Text style={[styles.sheetItemText, language === 'vi' && styles.sheetItemActive]}>{STRINGS.vi.vi}</Text>
            {language === 'vi' ? <Icon name="check" size={18} color="#1e88e5" /> : null}
          </TouchableOpacity>
          <TouchableOpacity style={styles.sheetItem} onPress={() => changeLanguage('en')}>
            <Text style={[styles.sheetItemText, language === 'en' && styles.sheetItemActive]}>{STRINGS.en.en}</Text>
            {language === 'en' ? <Icon name="check" size={18} color="#1e88e5" /> : null}
          </TouchableOpacity>

          <TouchableOpacity style={styles.sheetCancel} onPress={() => setShowLangSheet(false)}>
            <Text style={styles.sheetCancelText}>{STRINGS[language].cancel}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

export default LoginScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  scrollContent: { flexGrow: 1, paddingVertical: 18 },
 

  topBrand: { alignItems: 'center', marginTop: 16, marginBottom: 12, paddingHorizontal: 20 },
  logoImage: { width: 120, height: 120, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },

  card: {
    marginHorizontal: 18,
    marginTop: 14,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    // glass shadow
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    borderWidth: 1,
    borderColor: '#eef2f7',
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 14,
    height: 56,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    position: 'relative',
  },
  inputFocused: {
    borderColor: '#1e88e5',
    shadowColor: '#1e88e5',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    backgroundColor: '#fff',
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#0f172a', paddingTop: 8 },
  eyeIcon: { padding: 6 },

  errorText: { color: '#d93025', fontSize: 13, marginTop: -4, marginBottom: 8, textAlign: 'right' },

  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 14 },
  rememberWrap: { flexDirection: 'row', alignItems: 'center' },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.6,
    borderColor: '#94a3b8',
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxChecked: { backgroundColor: '#1e88e5', borderColor: '#1e88e5' },
  rememberText: { color: '#334155', fontSize: 13.5 },

  loginButton: {
    backgroundColor: '#1e88e5',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: { color: 'white', fontSize: 16.5, fontWeight: '700', textAlign: 'center' },

  forgotPasswordText: { color: '#1e88e5', fontSize: 14 },

  bottomArea: { alignItems: 'center', marginTop: 22, paddingHorizontal: 20 },
  langBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  langText: { color: '#1e88e5', fontSize: 14, marginLeft: 6, fontWeight: '600' },

  footer: { alignItems: 'center', paddingTop: 6, paddingBottom: 12 },
  footerText: { color: '#1e88e5', fontSize: 14, fontWeight: '500', marginBottom: 4 },
  versionText: { color: '#94a3b8', fontSize: 13 },

  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheetWrap: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44, height: 5, borderRadius: 999, backgroundColor: '#e5e7eb', marginBottom: 8,
  },
  sheetTitle: { fontSize: 15, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 6 },
  sheetItem: {
    paddingVertical: 12, paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: '#eef2f7', marginBottom: 8,
  },
  sheetItemText: { fontSize: 15, color: '#0f172a' },
  sheetItemActive: { color: '#1e88e5', fontWeight: '700' },
  sheetCancel: {
    marginTop: 6, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6',
  },
  sheetCancelText: { color: '#111827', fontWeight: '600' },
});
