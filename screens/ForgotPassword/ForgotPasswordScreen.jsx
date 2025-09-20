import React, { useEffect, useState,useCallback } from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  TextInput,
  Text,
  Alert,
  TouchableOpacity,
  Animated,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Keyboard,
  BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logoForgot from '../../assets/img/ic_paper_plane.png';
import { sendResetOtp } from '../../apis/otp';
import { showMessage } from '../../components/Toast/Toast';

const LANG_KEY = 'app_language';

const STRINGS = {
  vi: {
    titleTop: 'Yêu cầu',
    titleBottom: 'cấp lại mật khẩu',
    phoneLabel: 'Số điện thoại',
    sendOtp: 'Gửi mã OTP',
    backToLogin: 'Trở lại đăng nhập',
    err: 'Lỗi',
    askPhone: 'Vui lòng nhập số điện thoại',
    phoneInvalid: 'Số điện thoại không hợp lệ',
    success: 'Thành công',
    sentOtp: 'Đã gửi OTP, vui lòng kiểm tra SMS',
    sendFailed: 'Số điện thoại không tồn tại hoặc chưa đăng ký',
    unknownErr: 'Có lỗi xảy ra, thử lại sau',
  },
  en: {
    titleTop: 'Request',
    titleBottom: 'password reset',
    phoneLabel: 'Phone number',
    sendOtp: 'Send OTP',
    backToLogin: 'Back to sign in',
    err: 'Error',
    askPhone: 'Please enter your phone number',
    phoneInvalid: 'Invalid phone number',
    success: 'Success',
    sentOtp: 'OTP sent. Please check SMS',
    sendFailed: 'Phone number not found or not registered',
    unknownErr: 'Something went wrong, please try again later',
  },
};

function ForgotPasswordScreen({ navigateToScreen, goBack, navigation }) {
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

  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  // Animated value for floating label
  const [phoneLabelAnimation] = useState(new Animated.Value(phoneNumber ? 1 : 0));

  const animateLabel = (animatedValue, toValue) => {
    Animated.timing(animatedValue, {
      toValue,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handlePhoneFocus = () => {
    setPhoneFocused(true);
    animateLabel(phoneLabelAnimation, 1);
  };

  const handlePhoneBlur = () => {
    setPhoneFocused(false);
    if (!phoneNumber) {
      animateLabel(phoneLabelAnimation, 0);
    }
  };

  const normPhone = (raw) => {
    // +84xxxxxxxxx -> 0xxxxxxxxx, giữ lại chỉ chữ số
    let s = String(raw || '').replace(/\D/g, '');
    if (!s) return '';
    if (s.startsWith('84')) s = '0' + s.slice(2);
    if (!s.startsWith('0')) s = '0' + s;
    return s;
  };

  const handleSubmit = async () => {
    Keyboard.dismiss();
    const p = normPhone(phoneNumber);

    if (!p) return Alert.alert(t('err'), t('askPhone'));
    if (p.length < 10 || p.length > 11) return Alert.alert(t('err'), t('phoneInvalid'));

    try {
      setLoading(true);
      const response = await sendResetOtp(p);

      if (response?.kq === 1 && (response.code === 100 || Number.isNaN(response.code))) {
        await AsyncStorage.setItem('phoneReset', p);
        if (response.smsId) {
          await AsyncStorage.setItem('smsId', String(response.smsId));
        }

        // Toast + điều hướng
        showMessage(t('success'), response.message || t('sentOtp'));
        navigateToScreen('forgotStep2');
      } else {
        showMessage(t('err'), response?.message || t('sendFailed'));
      }
    } catch (err) {
      console.error('Send Reset OTP Error:', err);
      showMessage(t('err'), err?.message || t('unknownErr'));
    } finally {
      setLoading(false);
    }
  };

  const phoneLabelStyle = {
    position: 'absolute',
    left: 55,
    top: phoneLabelAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [17, -8],
    }),
    fontSize: phoneLabelAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [16, 12],
    }),
    color: phoneLabelAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['#999', '#1e88e5'],
    }),
    backgroundColor: 'white',
    paddingHorizontal: 4,
    zIndex: 1,
  };

  const handleGoBack = () => {
    if (goBack) goBack();
    else navigateToScreen('Login');
  };

  const goBackToStep1 = useCallback(() => {
    if (loading) return true; // đang xử lý thì chặn back
    navigateToScreen && navigateToScreen('login');
    return true; // chặn default
  }, [navigateToScreen, loading]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBackToStep1);
    return () => sub.remove();
  }, [goBackToStep1]);

  useEffect(() => {
    if (!navigation || typeof navigation.addListener !== 'function') return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      // chặn pop mặc định, tự điều hướng về step1 (nếu không loading)
      e.preventDefault();
      if (loading) return;
      navigateToScreen && navigateToScreen('login');
    });
    return unsub;
  }, [navigation, navigateToScreen, loading]);


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <StatusBar barStyle="light-content" backgroundColor="#1e88e5" />

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Main Content */}
        <View style={styles.content}>
          {/* Illustration */}
          <View style={styles.illustrationContainer}>
            <View style={styles.paperPlane}>
              <Image style={styles.logoForgot} source={logoForgot} />
            </View>
          </View>

          {/* Title */}
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{t('titleTop')}</Text>
            <Text style={styles.subtitle}>{t('titleBottom')}</Text>
          </View>

          {/* Phone Input */}
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Animated.Text style={phoneLabelStyle}>{t('phoneLabel')}</Animated.Text>
              <Icon name="phone" size={20} color="#999" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder=""
                placeholderTextColor="#999"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                onFocus={handlePhoneFocus}
                onBlur={handlePhoneBlur}
                keyboardType="phone-pad"
                maxLength={11}
              />
              <Text style={styles.characterCount}>{phoneNumber.length}/11</Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[
                styles.submitButton,
                loading && { opacity: 0.6 },
                !phoneNumber.trim() && { opacity: 0.5 },
              ]}
              onPress={handleSubmit}
              disabled={loading || !phoneNumber.trim()}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>{t('sendOtp')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleGoBack}>
              <Text style={styles.forgotPasswordText}>{t('backToLogin')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: '100%',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 40,
  },
  illustrationContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  paperPlane: {
    width: 120,
    height: 120,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoForgot: {
    width: 150,
    height: 150,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#00bcd4',
    marginBottom: 5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 28,
    fontWeight: '600',
    color: '#00bcd4',
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    marginBottom: 30,
    paddingHorizontal: 15,
    height: 55,
    borderWidth: 1,
    borderColor: '#ddd',
    position: 'relative',
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingTop: 8,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    position: 'absolute',
    right: 15,
    bottom: 8,
  },
  submitButton: {
    backgroundColor: '#00bcd4',
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  forgotPasswordText: {
    color: '#1e88e5',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
    textDecorationLine: 'underline',
  },
});

export default ForgotPasswordScreen;
