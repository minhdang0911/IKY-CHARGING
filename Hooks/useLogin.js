import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveTokens, saveUserInfo, setRememberFlag, getRememberFlag } from '../utils/authStorage';
import { STRINGS, LANG_KEY } from '../i18n/strings';
import { login as loginApi } from '../apis/auth';
import { Animated } from 'react-native';
import { getOrCreateDeviceId } from '../utils/deviceId';

export default function useLogin({ notify, onSuccess, initialLang = 'vi' }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [language, setLanguage] = useState(initialLang);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  // label animations + focus states
  const usernameLabelAnimRef = useRef(new Animated.Value(0));
  const passwordLabelAnimRef = useRef(new Animated.Value(0));
  const [usernameFocused, setUsernameFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  // shake
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const bumpShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    (async () => {
      try {
        // prewarm deviceId để lần login đầu không phải chờ
        await getOrCreateDeviceId();

        const savedLang = await AsyncStorage.getItem(LANG_KEY);
        if (savedLang) setLanguage(savedLang);

        const remembered = await getRememberFlag();
        setRemember(remembered);

        const savedUser = await AsyncStorage.getItem('username');
        if (savedUser && remembered) {
          setUsername(savedUser);
          Animated.timing(usernameLabelAnimRef.current, { toValue: 1, duration: 180, useNativeDriver: false }).start();
        }
      } catch {}
    })();
  }, []);

  const t = (k) => STRINGS[language]?.[k] || k;

  const animateLabel = (v, to) => Animated.timing(v, { toValue: to, duration: 180, useNativeDriver: false }).start();
  const onFocusU = () => { setUsernameFocused(true); animateLabel(usernameLabelAnimRef.current, 1); };
  const onBlurU  = () => { setUsernameFocused(false); if (!username) animateLabel(usernameLabelAnimRef.current, 0); };
  const onFocusP = () => { setPasswordFocused(true); animateLabel(passwordLabelAnimRef.current, 1); };
  const onBlurP  = () => { setPasswordFocused(false); if (!password) animateLabel(passwordLabelAnimRef.current, 0); };

  const changeLanguage = async (lang) => { setLanguage(lang); await AsyncStorage.setItem(LANG_KEY, lang); };

  const submit = async ({ externalLoginCallback }) => {
    setErrorText('');
    if (!username || !password) {
      const m = t('needUserPass');
      setErrorText(m); bumpShake(); notify(m); return;
    }
    if (loading) return;

    setLoading(true);
    try {
      // loginApi đã tự kèm deviceId
      const res = await loginApi(username.trim(), password);
      if (!res?.accessToken) throw new Error('Login OK nhưng thiếu accessToken');

      try {
        await saveTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
        await saveUserInfo(res?.user, username.trim());
        await setRememberFlag(!!remember);
        await AsyncStorage.setItem('username', username.trim());
      } catch (e) {
        console.error('[AUTH] Lỗi lưu storage:', e);
        const m = 'Lỗi lưu token vào storage (web/localStorage)';
        setErrorText(m); bumpShake(); notify(m);
        return;
      }

      externalLoginCallback?.({ username, user: res.user });
      onSuccess?.();
      notify(t('loginSuccess'));
    } catch (err) {
      let msg = err?.message || t('loginFail');
      try {
        const parsed = JSON.parse(err.message);
        msg = parsed?.message || msg;
      } catch {}
      console.error('[AUTH] Login failed:', msg, err);
      setErrorText(msg);
      bumpShake(); notify(msg);
    } finally {
      setLoading(false);
    }
  };

  return {
    // state
    username, setUsername,
    password, setPassword,
    language, setLanguage: changeLanguage,
    remember, setRemember,
    loading, errorText, setErrorText,
    // anim/focus
    usernameLabelAnim: usernameLabelAnimRef.current,
    passwordLabelAnim: passwordLabelAnimRef.current,
    usernameFocused, passwordFocused,
    onFocusU, onBlurU, onFocusP, onBlurP,
    shakeAnim,
    // actions
    submit, t,
  };
}
