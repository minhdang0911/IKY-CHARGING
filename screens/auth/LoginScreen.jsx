import React, { useRef, useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, Image, Animated, Platform,
  KeyboardAvoidingView, ScrollView, ActivityIndicator, Keyboard, Pressable
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { showMessage } from '../../components/Toast/Toast';
import useLogin from '../../Hooks/useLogin';
import FloatingTextField from '../../components/form/FloatingTextField';
import PasswordField from '../../components/form/PasswordField'; // tái dùng
import LangSheet from '../../components/auth/LangSheet';
import { STRINGS } from '../../i18n/strings';

const logo = require('../../assets/img/ic_launcher.png');

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
  } = useLogin({
    notify: showMessage,
    onSuccess: () => { /* điều hướng sau login nếu muốn */ },
  });

  const disabled = !username || !password || loading;

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false}>
        <View style={s.headerBg} />
        <Pressable style={{ flex: 1 }} onPress={Keyboard.dismiss}>
          <View style={s.topBrand}>
            <Image source={logo} style={s.logoImage} resizeMode="contain" />
            <Text style={s.title}>{t('welcome')}</Text>
            <Text style={s.subtitle}>{t('sub')}</Text>
          </View>

          <Animated.View
            style={[
              s.card,
              { transform: [{ translateX: shakeAnim.interpolate({ inputRange: [-1,0,1], outputRange: [-8,0,8] }) }] }
            ]}
          >
            {/* Username */}
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

            {/* Password (xài PasswordField nhưng với label nổi => pass label & rightSlot) */}
            <View>
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
                    <Icon name={showPassword ? 'visibility' : 'visibility-off'} size={20} color="#9aa0a6" />
                  </TouchableOpacity>
                }
              />
            </View>

            {!!errorText && <Text style={s.errorText}>{errorText}</Text>}

            <View style={s.rowBetween}>
              {/* <TouchableOpacity onPress={() => setRemember(r => !r)} style={s.rememberWrap} hitSlop={{ top:10,bottom:10,left:10,right:10 }}>
                <Icon name={remember ? 'check-box' : 'check-box-outline-blank'} size={20} color="#1e88e5" />
                <Text style={{ marginLeft: 8, color: '#0f172a' }}>{t('remember')}</Text>
              </TouchableOpacity> */}

              <TouchableOpacity onPress={() => setShowLangSheet(true)} style={s.quickLangBtn}>
                <Icon name="translate" size={18} color="#1e88e5" />
                <Text style={s.quickLangText}>{t('quickLang')}: {language === 'vi' ? 'VI' : 'EN'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[s.loginButton, disabled && { opacity: 0.6 }]}
              onPress={() => submit({ externalLoginCallback: login })}
              disabled={disabled}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.loginButtonText}>{t('login')}</Text>}
            </TouchableOpacity>
          </Animated.View>

          <View style={s.bottomArea}>
            <View style={s.footer}>
              <Text style={s.footerText}>{t('support')}: 0902 806 999</Text>
              <Text style={s.versionText}>{t('version')}: 1.125 Release</Text>
            </View>
          </View>
        </Pressable>
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
  container: { flex: 1, backgroundColor: 'white' },
  scrollContent: { flexGrow: 1, paddingVertical: 18 },
  headerBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(30,136,229,0.06)' },
  topBrand: { alignItems: 'center', marginTop: 16, marginBottom: 12, paddingHorizontal: 20 },
  logoImage: { width: 120, height: 120, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 14, color: '#64748b', marginTop: 4 },
  card: {
    marginHorizontal: 18, marginTop: 14, backgroundColor: '#ffffff', borderRadius: 16, padding: 16,
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    borderWidth: 1, borderColor: '#eef2f7',
  },
  errorText: { color: '#d93025', fontSize: 13, marginTop: -4, marginBottom: 8, textAlign: 'right' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 14 },
  rememberWrap: { flexDirection: 'row', alignItems: 'center' },
  quickLangBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6, paddingHorizontal: 8 },
  quickLangText: { color: '#1e88e5', fontSize: 14, fontWeight: '700' },
  loginButton: { backgroundColor: '#1e88e5', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  loginButtonText: { color: 'white', fontSize: 16.5, fontWeight: '700', textAlign: 'center' },
  bottomArea: { alignItems: 'center', marginTop: 22, paddingHorizontal: 20 },
  footer: { alignItems: 'center', paddingTop: 6, paddingBottom: 12 },
  footerText: { color: '#1e88e5', fontSize: 14, fontWeight: '500', marginBottom: 4 },
  versionText: { color: '#94a3b8', fontSize: 13 },
});
