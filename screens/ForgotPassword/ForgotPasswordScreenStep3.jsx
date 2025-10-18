// import React, { useEffect, useRef, useState, useCallback } from 'react';
// import {
//   Alert,
//   SafeAreaView,
//   StyleSheet,
//   Text,
//   TextInput,
//   TouchableOpacity,
//   View,
//   Image,
//   KeyboardAvoidingView,
//   Platform,
//   Animated,
//   Easing,
// } from 'react-native';
// import Icon from 'react-native-vector-icons/MaterialIcons';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import LoadingOverlay from '../../components/Loading/LoadingOverlay';
// import { changePasswordWithToken, validatePassword } from '../../apis/otp';
// import icLogo from '../../assets/img/ic_logo.png';

// const LANG_KEY = 'app_language';

// const STRINGS = {
//   vi: {
//     title: 'Đặt lại mật khẩu',
//     subtitle: 'Tạo mật khẩu mới cho tài khoản của bạn',
//     newPwPH: 'Mật khẩu mới',
//     confirmPwPH: 'Nhập lại mật khẩu',
//     mismatch: 'Mật khẩu không khớp',
//     needAll: 'Vui lòng nhập đầy đủ thông tin',
//     noTokenTitle: 'Lỗi',
//     noTokenMsg: 'Không tìm thấy token xác thực. Vui lòng thử lại từ đầu.',
//     pwPolicyTitle: 'Lỗi',
//     pwPolicy: 'Mật khẩu phải tối thiểu 8 ký tự, có ít nhất 1 chữ thường và 1 số.',
//     submit: 'Đồng ý',
//     back: 'Trở lại',
//     successTitle: 'Thành công',
//     successMsg: 'Đặt lại mật khẩu thành công!',
//     failTitle: 'Thất bại',
//     failMsg: 'Đặt lại mật khẩu thất bại. Vui lòng thử lại.',
//     errTitle: 'Lỗi',
//     errMsg: 'Không thể kết nối tới máy chủ. Vui lòng thử lại sau.',
//     strength: 'Độ mạnh',
//     rule_len: '≥ 8 ký tự',
//     rule_lower: 'Có chữ thường',
//     rule_digit: 'Có số',
//     show: 'Hiện',
//     hide: 'Ẩn',
//   },
//   en: {
//     title: 'Reset password',
//     subtitle: 'Create a new password for your account',
//     newPwPH: 'New password',
//     confirmPwPH: 'Confirm password',
//     mismatch: 'Passwords do not match',
//     needAll: 'Please fill in all fields',
//     noTokenTitle: 'Error',
//     noTokenMsg: 'Verification token not found. Please restart the flow.',
//     pwPolicyTitle: 'Error',
//     pwPolicy: 'Password must be at least 8 characters, include at least 1 lowercase letter and 1 digit.',
//     submit: 'Confirm',
//     back: 'Back',
//     successTitle: 'Success',
//     successMsg: 'Password reset successfully!',
//     failTitle: 'Failed',
//     failMsg: 'Password reset failed. Please try again.',
//     errTitle: 'Error',
//     errMsg: 'Cannot connect to server. Please try again later.',
//     strength: 'Strength',
//     rule_len: '≥ 8 chars',
//     rule_lower: 'Has lowercase',
//     rule_digit: 'Has digit',
//     show: 'Show',
//     hide: 'Hide',
//   },
// };

// const UI = {
//   bg: '#FFFFFF',
//   surface: '#FFFFFF',
//   surface2: '#F3F4F6',
//   text: '#0F172A',
//   muted: '#6B7280',
//   border: '#E5E7EB',
//   primary: '#2563EB',      // nút chính
//   primaryDark: '#1E40AF',
//   danger: '#EF4444',
//   success: '#16A34A',
//   warn: '#F59E0B',
//   shadow: '#000000',
// };

// function ForgotPasswordStep3Screen({ navigateToScreen, goBack }) {
//   const [language, setLanguage] = useState('vi');
//   const t = (k) => STRINGS[language][k] || k;

//   useEffect(() => {
//     (async () => {
//       try {
//         const saved = await AsyncStorage.getItem(LANG_KEY);
//         if (saved) setLanguage(saved);
//       } catch {}
//     })();
//   }, []);

//   const [newPassword, setNewPassword] = useState('');
//   const [confirmPassword, setConfirmPassword] = useState('');
//   const [showNewPassword, setShowNewPassword] = useState(false);
//   const [showConfirmPassword, setShowConfirmPassword] = useState(false);
//   const [errors, setErrors] = useState({});
//   const [resetToken, setResetToken] = useState('');
//   const [phoneNumber, setPhoneNumber] = useState('');
//   const [loading, setLoading] = useState(false);

//   const cardShake = useRef(new Animated.Value(0)).current;

//   const doShake = () => {
//     cardShake.setValue(0);
//     Animated.sequence(
//       [10, -10, 6, -6, 3, -3, 0].map((to, i) =>
//         Animated.timing(cardShake, {
//           toValue: to,
//           duration: i ? 48 : 0,
//           easing: Easing.linear,
//           useNativeDriver: true,
//         })
//       )
//     ).start();
//   };

//   useEffect(() => {
//     const fetchData = async () => {
//       try {
//         const phone = await AsyncStorage.getItem('phoneReset');
//         const token = await AsyncStorage.getItem('password_reset_token');
//         if (phone) setPhoneNumber(phone);
//         if (token) setResetToken(token);
//         if (!token) {
//           Alert.alert(t('noTokenTitle'), t('noTokenMsg'));
//         }
//       } catch (e) {
//         Alert.alert(t('errTitle'), t('errMsg'));
//       }
//     };
//     fetchData();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [language]);

//   // ======== Validation helpers ========
//   const validatePasswordLocal = (password) => {
//     const errs = [];
//     if (password.length < 8) errs.push('len');
//     if (!/(?=.*[a-z])/.test(password)) errs.push('lower');
//     if (!/(?=.*\d)/.test(password)) errs.push('digit');
//     return errs;
//   };

//   const strengthScore = (pw) => {
//     let score = 0;
//     if (pw.length >= 8) score++;
//     if (/[a-z]/.test(pw)) score++;
//     if (/\d/.test(pw)) score++;
//     if (/[A-Z]/.test(pw)) score++;       // bonus nhẹ
//     if (/[^A-Za-z0-9]/.test(pw)) score++; // bonus nhẹ
//     return Math.min(score, 5);
//   };

//   const strengthMeta = (score) => {
//     if (score <= 2) return { label: 'Weak', color: UI.danger };
//     if (score === 3) return { label: 'Fair', color: UI.warn };
//     return { label: 'Strong', color: UI.success };
//   };

//   // ======== Handlers ========
//   const handlePasswordChange = (password) => {
//     setNewPassword(password);
//     if (password.length > 0) {
//       const validationErrors = validatePasswordLocal(password);
//       setErrors((p) => ({ ...p, newPassword: validationErrors.length ? validationErrors : null }));
//       // nếu confirm đã nhập thì check khớp luôn
//       if (confirmPassword) {
//         setErrors((p) => ({ ...p, confirmPassword: password === confirmPassword ? null : ['mismatch'] }));
//       }
//     } else {
//       setErrors((p) => ({ ...p, newPassword: null }));
//     }
//   };

//   const handleConfirmPasswordChange = (password) => {
//     setConfirmPassword(password);
//     if (password.length > 0 && newPassword.length > 0) {
//       if (password !== newPassword) {
//         setErrors((p) => ({ ...p, confirmPassword: ['mismatch'] }));
//       } else {
//         setErrors((p) => ({ ...p, confirmPassword: null }));
//       }
//     } else {
//       setErrors((p) => ({ ...p, confirmPassword: null }));
//     }
//   };

//   const handleSubmit = async () => {
//     if (!newPassword || !confirmPassword) {
//       doShake();
//       Alert.alert(STRINGS[language].errTitle, t('needAll'));
//       return;
//     }
//     if (!resetToken) {
//       doShake();
//       Alert.alert(t('noTokenTitle'), t('noTokenMsg'));
//       return;
//     }

//     const pv = validatePassword?.(newPassword);
//     if (pv && !pv.isValid) {
//       doShake();
//       Alert.alert(t('pwPolicyTitle'), pv.errors.join('\n'));
//       return;
//     }

//     const localErr = validatePasswordLocal(newPassword);
//     if (localErr.length) {
//       doShake();
//       Alert.alert(t('pwPolicyTitle'), t('pwPolicy'));
//       return;
//     }

//     if (newPassword !== confirmPassword) {
//       doShake();
//       Alert.alert(STRINGS[language].errTitle, t('mismatch'));
//       return;
//     }

//     setLoading(true);
//     try {
//       const response = await changePasswordWithToken(newPassword, resetToken, confirmPassword);
//       if (response?.kq === 1) {
//         await AsyncStorage.multiRemove(['phoneReset', 'smsId', 'password_reset_token']);
//         Alert.alert(t('successTitle'), response?.message || t('successMsg'), [
//           { text: 'OK', onPress: () => navigateToScreen('Login') },
//         ]);
//       } else {
//         Alert.alert(t('failTitle'), response?.message || t('failMsg'));
//       }
//     } catch (error) {
//       Alert.alert(t('errTitle'), error?.message || t('errMsg'));
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleGoBack = () => {
//     if (goBack) goBack();
//     else navigateToScreen('forgotStep2');
//   };

//   // ======== UI ========
//   const sc = strengthScore(newPassword);
//   const sm = strengthMeta(sc);
//   const ruleLen = !(errors.newPassword || []).includes('len') && newPassword.length >= 8;
//   const ruleLower = !(errors.newPassword || []).includes('lower') && /[a-z]/.test(newPassword);
//   const ruleDigit = !(errors.newPassword || []).includes('digit') && /\d/.test(newPassword);

//   const canSubmit = newPassword && confirmPassword && !errors.newPassword && !errors.confirmPassword;

//   return (
//     <SafeAreaView style={styles.container}>
//       <LoadingOverlay visible={loading} />
//       <KeyboardAvoidingView
//         style={{ flex: 1 }}
//         behavior={Platform.OS === 'ios' ? 'padding' : undefined}
//         keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
//       >
//         <View style={styles.content}>
//           {/* Card centered */}
//           <Animated.View
//             style={[
//               styles.card,
//               { transform: [{ translateX: cardShake }] },
//             ]}
//           >
//             {/* Logo + Title */}
//             <View style={styles.logoWrap}>
//               <Image source={icLogo} style={styles.logo} resizeMode="contain" />
//               <Text style={styles.title}>{t('title')}</Text>
//               <Text style={styles.subtitle}>{t('subtitle')}</Text>
//             </View>

//             {/* New Password */}
//             <View style={styles.inputContainer}>
//               <View style={[styles.inputWrapper, errors.newPassword && styles.inputWrapperError]}>
//                 <Icon name="lock" size={20} color={UI.muted} style={styles.leftIcon} />
//                 <TextInput
//                   style={styles.textInput}
//                   placeholder={t('newPwPH')}
//                   value={newPassword}
//                   onChangeText={handlePasswordChange}
//                   secureTextEntry={!showNewPassword}
//                   placeholderTextColor={UI.muted}
//                 />
//                 <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeIcon}>
//                   <Icon name={showNewPassword ? 'visibility' : 'visibility-off'} size={22} color={UI.muted} />
//                 </TouchableOpacity>
//               </View>

//               {/* Strength meter */}
//               {/* <View style={styles.meterRow}>
//                 <Text style={styles.meterLabel}>{t('strength')}:</Text>
//                 <View style={styles.meterBars}>
//                   {Array(5).fill(0).map((_, i) => (
//                     <View
//                       key={i}
//                       style={[
//                         styles.meterBar,
//                         { backgroundColor: i < sc ? sm.color : UI.border },
//                       ]}
//                     />
//                   ))}
//                 </View>
//                 <Text style={[styles.meterText, { color: sm.color }]}>{sm.label}</Text>
//               </View> */}

//               {/* Checklist */}
//               <View style={styles.ruleRow}>
//                 <Icon name={ruleLen ? 'check-circle' : 'radio-button-unchecked'} size={16} color={ruleLen ? UI.success : UI.muted} />
//                 <Text style={styles.ruleText}>{t('rule_len')}</Text>
//               </View>
//               <View style={styles.ruleRow}>
//                 <Icon name={ruleLower ? 'check-circle' : 'radio-button-unchecked'} size={16} color={ruleLower ? UI.success : UI.muted} />
//                 <Text style={styles.ruleText}>{t('rule_lower')}</Text>
//               </View>
//               <View style={styles.ruleRow}>
//                 <Icon name={ruleDigit ? 'check-circle' : 'radio-button-unchecked'} size={16} color={ruleDigit ? UI.success : UI.muted} />
//                 <Text style={styles.ruleText}>{t('rule_digit')}</Text>
//               </View>
//             </View>

//             {/* Confirm Password */}
//             <View style={styles.inputContainer}>
//               <View style={[styles.inputWrapper, errors.confirmPassword && styles.inputWrapperError]}>
//                 <Icon name="lock" size={20} color={UI.muted} style={styles.leftIcon} />
//                 <TextInput
//                   style={styles.textInput}
//                   placeholder={t('confirmPwPH')}
//                   value={confirmPassword}
//                   onChangeText={handleConfirmPasswordChange}
//                   secureTextEntry={!showConfirmPassword}
//                   placeholderTextColor={UI.muted}
//                 />
//                 <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeIcon}>
//                   <Icon name={showConfirmPassword ? 'visibility' : 'visibility-off'} size={22} color={UI.muted} />
//                 </TouchableOpacity>
//               </View>
//               {errors.confirmPassword && <Text style={styles.errorText}>{t('mismatch')}</Text>}
//             </View>

//             {/* Actions */}
//             <TouchableOpacity
//               style={[styles.submitButton, !canSubmit && { opacity: 0.6 }]}
//               onPress={handleSubmit}
//               disabled={!canSubmit}
//               activeOpacity={0.9}
//             >
//               <Text style={styles.submitButtonText}>{t('submit')}</Text>
//             </TouchableOpacity>

//             <TouchableOpacity onPress={handleGoBack} style={styles.backBtn}>
//               <Text style={styles.backText}>{t('back')}</Text>
//             </TouchableOpacity>
//           </Animated.View>
//         </View>
//       </KeyboardAvoidingView>
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   container: { flex: 1, backgroundColor: UI.bg },
//   content: {
//     flex: 1,
//     paddingHorizontal: 20,
//     justifyContent: 'center',
//     alignItems: 'center',
//   },

//   card: {
//     width: '100%',
//     maxWidth: 460,
//     backgroundColor: UI.surface,
//     borderRadius: 18,
//     borderWidth: 1,
//     borderColor: UI.border,
//     paddingHorizontal: 20,
//     paddingVertical: 22,
//     shadowColor: UI.shadow,
//     shadowOpacity: 0.06,
//     shadowRadius: 12,
//     shadowOffset: { width: 0, height: 6 },
//     elevation: 2,
//   },

//   logoWrap: { alignItems: 'center', marginBottom: 10 },
//   logo: { width: 160, height: 48, marginBottom: 8 },
//   title: { fontSize: 20, fontWeight: '800', color: UI.text, textAlign: 'center' },
//   subtitle: { fontSize: 13, color: UI.muted, textAlign: 'center', marginTop: 4, marginBottom: 12 },

//   inputContainer: { width: '100%', marginTop: 10, marginBottom: 6 },
//   inputWrapper: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     borderWidth: 1.5,
//     borderColor: UI.border,
//     borderRadius: 14,
//     paddingHorizontal: 14,
//     backgroundColor: UI.surface,
//     minHeight: 54,
//   },
//   inputWrapperError: { borderColor: UI.danger },

//   leftIcon: { marginRight: 10, color: UI.muted },
//   textInput: { flex: 1, fontSize: 16, color: UI.text, paddingVertical: 10 },
//   eyeIcon: { padding: 6, marginLeft: 6 },

//   errorText: { color: UI.danger, fontSize: 12, marginTop: 6, marginLeft: 4 },

//   meterRow: {
//     marginTop: 10,   
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 8,
//   },
//   meterLabel: { fontSize: 12, color: UI.muted },
//   meterBars: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     gap: 4,
//     marginLeft: 4,
//     flex: 1,
//   },
//   meterBar: { height: 6, flex: 1, borderRadius: 4, backgroundColor: UI.border },
//   meterText: { fontSize: 12, fontWeight: '700', marginLeft: 8 },

//   ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
//   ruleText: { fontSize: 13, color: UI.text },

//   submitButton: {
//     backgroundColor: UI.primary,
//     paddingVertical: 14,
//     borderRadius: 14,
//     alignItems: 'center',
//     marginTop: 16,
//     width: '100%',
//     borderWidth: 1.5,
//     borderColor: UI.primaryDark,
//     elevation: 2,
//     shadowColor: UI.shadow,
//     shadowOffset: { width: 0, height: 2 },
//     shadowOpacity: 0.08,
//     shadowRadius: 4,
//   },
//   submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },

//   backBtn: { marginTop: 12, alignSelf: 'center' },
//   backText: { color: UI.primary, fontSize: 14, fontWeight: '700' },
// });

// export default ForgotPasswordStep3Screen;
