// screens/Auth/LoginScreen.tsx — SINGLE FORM, CLEAN WEB UI
import React, { useRef, useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Image, Animated, Platform,
  KeyboardAvoidingView, ScrollView, ActivityIndicator, Keyboard, Pressable
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { showMessage } from '../../components/Toast/Toast';
import useLogin from '../../Hooks/useLogin';
import FloatingTextField from '../../components/form/FloatingTextField';
import LangSheet from '../../components/auth/LangSheet';

const logo = require('../../assets/img/ic_launcher.png');
const isWeb = Platform.OS === 'web';

export default function LoginScreen({ navigateToScreen, login }) {
  const passwordRef = useRef(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showLangSheet, setShowLangSheet] = useState(false);

  const {
    username, setUsername,
    password, setPassword,
    language, setLanguage,
    remember, setRemember,
    loading, errorText, setErrorText,
    usernameLabelAnim, passwordLabelAnim,
    usernameFocused, passwordFocused,
    onFocusU, onBlurU, onFocusP, onBlurP,
    shakeAnim, submit, t,
  } = useLogin({ notify: showMessage, onSuccess: () => {} });

  const disabled = !username || !password || loading;

  const Wrapper = isWeb ? View : Pressable;
  const wrapperProps = isWeb ? {} : { onPress: Keyboard.dismiss, style: { flex: 1 } };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* subtle gradient strip */}
      <View style={s.bgTop} />

      <ScrollView
        contentContainerStyle={s.center}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Wrapper {...wrapperProps} pointerEvents={isWeb ? 'box-none' : 'auto'}>
          <Animated.View
            style={[
              s.card,
              {
                transform: [{
                  translateX: shakeAnim.interpolate({ inputRange: [-1, 0, 1], outputRange: [-8, 0, 8] })
                }]
              }
            ]}
          >
            {/* brand */}
            <View style={s.brandWrap}>
              <Image source={logo} style={s.logo} />
              <Text style={s.brandText}>IKY CHARGING</Text>
            </View>

            <Text style={s.title}>{t('welcome')}</Text>
            <Text style={s.subtitle}>{t('sub')}</Text>

            {/* fields */}
            <FloatingTextField
              value={username}
              onChangeText={(v) => { setUsername(v); if (!v) setErrorText(''); }}
              label={t('usernameLabel')}
              icon="person"
              focused={usernameFocused}
              onFocus={onFocusU}
              onBlur={onBlurU}
              animValue={usernameLabelAnim}
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              autoComplete="username"
              rightSlot={null}
            />

            <FloatingTextField
              value={password}
              onChangeText={(v) => { setPassword(v); if (!v) setErrorText(''); }}
              label={t('passwordLabel')}
              icon="lock"
              focused={passwordFocused}
              onFocus={onFocusP}
              onBlur={onBlurP}
              animValue={passwordLabelAnim}
              inputRef={passwordRef}
              autoComplete="password"
              secureTextEntry={!showPassword}
              returnKeyType="done"
              onSubmitEditing={() => submit({ externalLoginCallback: login })}
              rightSlot={
                <TouchableOpacity style={{ padding: 6 }} onPress={() => setShowPassword(s => !s)}>
                  <Icon name={showPassword ? 'visibility' : 'visibility-off'} size={18} color="#9aa0a6" />
                </TouchableOpacity>
              }
            />

            {!!errorText && <Text style={s.errorText}>{errorText}</Text>}

            {/* helpers row */}
            <View style={s.helpers}>
              <TouchableOpacity onPress={() => setShowLangSheet(true)} style={s.helperBtn}>
                <Icon name="translate" size={16} color="#2563eb" />
                <Text style={s.helperText}>{t('quickLang')}: {language === 'vi' ? 'VI' : 'EN'}</Text>
              </TouchableOpacity>

              {/* <TouchableOpacity
                onPress={() => setRemember(!remember)}
                style={s.helperBtn}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: remember }}
              >
                <Icon name={remember ? 'check-box' : 'check-box-outline-blank'} size={18} color={remember ? '#2563eb' : '#94a3b8'} />
                <Text style={s.helperText}>{t('rememberMe') ?? 'Ghi nhớ'}</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => navigateToScreen?.('ForgotPassword')} style={s.helperBtn}>
                <Text style={[s.helperText, { textDecorationLine: 'underline', color: '#64748b' }]}>
                  {t('forgotPassword') ?? 'Quên mật khẩu?'}
                </Text>
              </TouchableOpacity> */}
            </View>

            <TouchableOpacity
              style={[s.loginButton, disabled && { opacity: 0.6 }]}
              onPress={() => submit({ externalLoginCallback: login })}
              disabled={disabled}
              activeOpacity={0.9}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.loginText}>{t('login')}</Text>}
            </TouchableOpacity>

            {/* <View style={s.footerRow}>
              <Text style={s.support}>{t('support')}: 0902 806 999</Text>
              <Text style={s.version}>{t('version')}: 1.125 Release</Text>
            </View> */}
          </Animated.View>
        </Wrapper>
      </ScrollView>

      <LangSheet
        visible={showLangSheet}
        onClose={() => setShowLangSheet(false)}
        t={t}
        language={language}
        onPick={(code) => { setLanguage(code); setShowLangSheet(false); }}
      />
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  bgTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 160,
   
  },
center: {
  flexGrow: 1,
  alignItems: 'center',
  justifyContent: 'center', // 🟢 căn giữa dọc luôn
  minHeight: '100vh',       // 🟢 quan trọng: để web chiếm đủ chiều cao viewport
  padding: 16,
},

  // SINGLE CARD
  card: {
    width: '100%',
    maxWidth: 460,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1, borderColor: '#e2e8f0',
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  },

  brandWrap: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', marginBottom: 6, gap: 8 },
  logo: { width: 44, height: 44 },
  brandText: { fontSize: 16, fontWeight: '800', letterSpacing: 1, color: '#1f2937' },

  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', textAlign: 'center', marginTop: 6 },
  subtitle: { fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 12 },

  errorText: { color: '#d93025', fontSize: 12, marginTop: -2, marginBottom: 6, textAlign: 'right' },

  helpers: {
    marginTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  helperBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  helperText: { fontSize: 13, color: '#334155', fontWeight: '600' },

  loginButton: { marginTop: 10, backgroundColor: '#2563eb', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  loginText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  footerRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  support: { color: '#0ea5e9', fontSize: 12.5, fontWeight: '700' },
  version: { color: '#94a3b8', fontSize: 12 },
});
