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
import { STRINGS } from '../../i18n/strings';

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
  } = useLogin({
    notify: showMessage,
    onSuccess: () => {},
  });

  const disabled = !username || !password || loading;

  // wrapper: web không dùng Pressable để khỏi chặn click vào input
  const Wrapper = isWeb ? View : Pressable;
  const wrapperProps = isWeb
    ? {}
    : { onPress: Keyboard.dismiss, style: { flex: 1 } };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={s.headerBg} />

        <Wrapper {...wrapperProps} pointerEvents={isWeb ? 'box-none' : 'auto'}>
          <View style={s.formWrap}>
            <View style={s.topBrand}>
              <Image source={logo} style={s.logoImage} resizeMode="contain" />
              <Text style={s.title}>{t('welcome')}</Text>
              <Text style={s.subtitle}>{t('sub')}</Text>
            </View>

            <Animated.View
              style={[
                s.card,
                { transform: [{ translateX: shakeAnim.interpolate({
                    inputRange: [-1,0,1], outputRange: [-8,0,8]
                }) }] }
              ]}
            >
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
                      <Icon name={showPassword ? 'visibility' : 'visibility-off'} size={18} color="#9aa0a6" />
                    </TouchableOpacity>
                  }
                />
              </View>

              {!!errorText && <Text style={s.errorText}>{errorText}</Text>}

              <View style={s.rowBetween}>
                <TouchableOpacity onPress={() => setShowLangSheet(true)} style={s.quickLangBtn}>
                  <Icon name="translate" size={16} color="#1e88e5" />
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
          </View>
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
  container: { flex: 1, backgroundColor: 'white' },
  scrollContent: { flexGrow: 1, paddingVertical: 18 },
  headerBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 120, backgroundColor: 'rgba(30,136,229,0.06)' },

  // NEW: khung form nhỏ lại & căn giữa cho web/desktop
  formWrap: {
    width: '100%',
    maxWidth: 420,          // <= thu nhỏ
    alignSelf: 'center',
  },

  topBrand: { alignItems: 'center', marginTop: 8, marginBottom: 8, paddingHorizontal: 16 },
  logoImage: { width: 84, height: 84, marginBottom: 6 },  // <= nhỏ hơn
  title: { fontSize: 20, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },

  card: {
    marginHorizontal: 12, marginTop: 12, backgroundColor: '#ffffff',
    borderRadius: 14, padding: 14,
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
    borderWidth: 1, borderColor: '#eef2f7',
  },

  errorText: { color: '#d93025', fontSize: 12, marginTop: -4, marginBottom: 8, textAlign: 'right' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, marginBottom: 10 },
  quickLangBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 6 },
  quickLangText: { color: '#1e88e5', fontSize: 13, fontWeight: '700' },

  loginButton: { backgroundColor: '#1e88e5', borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 6 },
  loginButtonText: { color: 'white', fontSize: 15.5, fontWeight: '700', textAlign: 'center' },

  bottomArea: { alignItems: 'center', marginTop: 16, paddingHorizontal: 16 },
  footer: { alignItems: 'center', paddingTop: 4, paddingBottom: 10 },
  footerText: { color: '#1e88e5', fontSize: 13, fontWeight: '500', marginBottom: 4 },
  versionText: { color: '#94a3b8', fontSize: 12 },
});
