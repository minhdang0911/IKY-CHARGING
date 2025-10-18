// import React, { useEffect, useRef, useState } from 'react';
// import { SafeAreaView, Text, TextInput, TouchableOpacity, View, Alert, Image } from 'react-native';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// import LoadingOverlay from '../../components/Loading/LoadingOverlay';
// import { sendResetOtp, verifyResetOtp, validateOTP } from '../../apis/otp';
// import iconsMail from '../../assets/img/ic_received_message.png';

// const LANG_KEY = 'app_language';

// const STRINGS = {
//   vi: {
//     title: 'Nhập mã OTP',
//     subtitle: 'Mã OTP đã được gửi về số điện thoại',
//     notFoundPhoneTitle: 'Lỗi',
//     notFoundPhoneMsg: 'Không tìm thấy số điện thoại',
//     resendTitleSuccess: 'Thành công',
//     resendSuccess: 'Đã gửi lại mã OTP',
//     resendTitleError: 'Lỗi',
//     resendError: 'Gửi mã OTP thất bại. Vui lòng thử lại.',
//     resendBtnIdle: 'GỬI LẠI',
//     resendPrefixCounting: '', // e.g. "còn"
//     seconds: 'GIÂY',
//     notReceive: 'Không nhận được mã OTP?',
//     confirm: 'Đồng ý',
//     close: 'Đóng',
//     otpTooShortTitle: 'Lỗi',
//     otpTooShortMsg: 'Vui lòng nhập đủ 6 số OTP',
//     otpInvalidTitle: 'Lỗi',
//     otpInvalidMsg: 'Mã OTP phải là 6 chữ số',
//     verifySuccessTitle: 'Thành công',
//     verifySuccessMsg: 'Xác minh OTP thành công',
//     verifyErrorTitle: 'Lỗi',
//     verifyErrorMsg: 'OTP không hợp lệ hoặc đã hết hạn',
//   },
//   en: {
//     title: 'Enter OTP',
//     subtitle: 'An OTP has been sent to your phone number',
//     notFoundPhoneTitle: 'Error',
//     notFoundPhoneMsg: 'Phone number not found',
//     resendTitleSuccess: 'Success',
//     resendSuccess: 'OTP resent',
//     resendTitleError: 'Error',
//     resendError: 'Failed to send OTP. Please try again.',
//     resendBtnIdle: 'RESEND',
//     resendPrefixCounting: '', // e.g. "left"
//     seconds: 'SECONDS',
//     notReceive: "Didn't receive the OTP?",
//     confirm: 'Confirm',
//     close: 'Close',
//     otpTooShortTitle: 'Error',
//     otpTooShortMsg: 'Please enter all 6 OTP digits',
//     otpInvalidTitle: 'Error',
//     otpInvalidMsg: 'OTP must be 6 digits',
//     verifySuccessTitle: 'Success',
//     verifySuccessMsg: 'OTP verified successfully',
//     verifyErrorTitle: 'Error',
//     verifyErrorMsg: 'Invalid or expired OTP',
//   },
// };

// function ForgotPasswordStep2Screen({ navigateToScreen /*, route */ }) {
//   const [otp, setOtp] = useState(['', '', '', '', '', '']);
//   const [countdown, setCountdown] = useState(60);
//   const [isCountingDown, setIsCountingDown] = useState(true);
//   const [phoneReset, setPhoneReset] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [language, setLanguage] = useState('vi');
//   const inputRefs = useRef([]);

//   const t = (k) => STRINGS[language][k] || k;

//   // Load language + phone number
//   useEffect(() => {
//     (async () => {
//       try {
//         const [lang, phone] = await Promise.all([
//           AsyncStorage.getItem(LANG_KEY),
//           AsyncStorage.getItem('phoneReset'),
//         ]);
//         if (lang) setLanguage(lang);
//         if (phone) setPhoneReset(phone);
//       } catch (e) {
//         console.error('Fetch init data error:', e);
//         Alert.alert(t('notFoundPhoneTitle'), t('notFoundPhoneMsg'));
//       }
//     })();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // Countdown
//   useEffect(() => {
//     let interval = null;
//     if (isCountingDown && countdown > 0) {
//       interval = setInterval(() => setCountdown((c) => c - 1), 1000);
//     } else if (countdown === 0) {
//       setIsCountingDown(false);
//     }
//     return () => clearInterval(interval);
//   }, [isCountingDown, countdown]);

//   const handleOtpChange = (text, index) => {
//     const cleaned = text.replace(/\D/g, '').slice(0, 1);
//     const newOtp = [...otp];
//     newOtp[index] = cleaned;
//     setOtp(newOtp);

//     if (cleaned && index < 5) {
//       inputRefs.current[index + 1]?.focus();
//     }
//   };

//   const handleKeyPress = (e, index) => {
//     if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
//       inputRefs.current[index - 1]?.focus();
//     }
//   };

//   const handleResendOTP = async () => {
//     if (!phoneReset) {
//       Alert.alert(t('notFoundPhoneTitle'), t('notFoundPhoneMsg'));
//       return;
//     }
//     try {
//       setLoading(true);
//       const response = await sendResetOtp(phoneReset);
//       // console.log('Resend OTP Response:', response);

//       if (response?.kq === 1 && (response.code === 100 || Number.isNaN(response.code))) {
//         if (response.smsId) {
//           await AsyncStorage.setItem('smsId', String(response.smsId));
//         }
//         Alert.alert(t('resendTitleSuccess'), response.message || t('resendSuccess'));
//         setCountdown(60);
//         setIsCountingDown(true);
//       } else {
//         Alert.alert(t('resendTitleError'), response?.message || t('resendError'));
//       }
//     } catch (error) {
//       console.error('Resend OTP Error:', error);
//       Alert.alert(t('resendTitleError'), error?.message || t('resendError'));
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleConfirm = async () => {
//     const otpString = otp.join('');

//     if (otpString.length < 6) {
//       Alert.alert(t('otpTooShortTitle'), t('otpTooShortMsg'));
//       return;
//     }
//     if (!validateOTP(otpString)) {
//       Alert.alert(t('otpInvalidTitle'), t('otpInvalidMsg'));
//       return;
//     }
//     if (!phoneReset) {
//       Alert.alert(t('notFoundPhoneTitle'), t('notFoundPhoneMsg'));
//       return;
//     }

//     setLoading(true);
//     try {
//       const response = await verifyResetOtp(phoneReset, otpString);
//       // console.log('Verify OTP Response:', response);

//       if (response?.kq === 1 && response?.password_reset_token) {
//         await AsyncStorage.setItem('password_reset_token', response.password_reset_token);
//         Alert.alert(t('verifySuccessTitle'), response?.message || t('verifySuccessMsg'));
//         navigateToScreen('forgotStep3');
//       } else {
//         Alert.alert(t('verifyErrorTitle'), response?.message || t('verifyErrorMsg'));
//       }
//     } catch (error) {
//       console.error('Verify OTP Error:', error);
//       Alert.alert(t('verifyErrorTitle'), error?.message || t('verifyErrorMsg'));
//     } finally {
//       setLoading(false);
//     }
//   };

//   const formatPhoneNumber = (phone) => {
//     if (!phone) return '';
//     return phone;
//   };

//   return (
//     <SafeAreaView style={styles.container}>
//       <LoadingOverlay visible={loading} />
//       <View style={styles.content}>
//         {/* Mail Icon */}
//         <View style={styles.iconContainer}>
//           <Image source={iconsMail} style={styles.mailIcon} resizeMode="contain" />
//         </View>

//         {/* Title */}
//         <Text style={styles.title}>{t('title')}</Text>

//         {/* Subtitle */}
//         <Text style={styles.subtitle}>{t('subtitle')}</Text>

//         {/* Phone number */}
//         <Text style={styles.phoneNumber}>{formatPhoneNumber(phoneReset)}</Text>

//         {/* OTP Input */}
//         <View style={styles.otpContainer}>
//           {otp.map((digit, index) => (
//             <TextInput
//               key={index}
//               ref={(ref) => (inputRefs.current[index] = ref)}
//               style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
//               value={digit}
//               onChangeText={(text) => handleOtpChange(text, index)}
//               onKeyPress={(e) => handleKeyPress(e, index)}
//               keyboardType="numeric"
//               maxLength={1}
//               textAlign="center"
//             />
//           ))}
//         </View>

//         {/* Resend OTP */}
//         <View style={styles.resendContainer}>
//           <Text style={styles.resendText}>{t('notReceive')}</Text>
//           <TouchableOpacity
//             onPress={handleResendOTP}
//             disabled={isCountingDown || loading}
//             style={styles.resendButton}
//           >
//             <Text
//               style={[
//                 styles.resendButtonText,
//                 !isCountingDown && !loading && styles.resendButtonTextActive,
//               ]}
//             >
//               {isCountingDown
//                 ? `${countdown} ${t('seconds')}`
//                 : t('resendBtnIdle')}
//             </Text>
//           </TouchableOpacity>
//         </View>

//         {/* Confirm Button */}
//         <TouchableOpacity
//           style={[
//             styles.confirmButton,
//             (loading || otp.join('').length < 6) && { opacity: 0.6 },
//           ]}
//           onPress={handleConfirm}
//           disabled={loading || otp.join('').length < 6}
//         >
//           <Text style={styles.confirmButtonText}>{t('confirm')}</Text>
//         </TouchableOpacity>

//         {/* Close Button */}
//         <TouchableOpacity style={styles.closeButton} onPress={() => navigateToScreen('Login')}>
//           <Text style={styles.closeButtonText}>{t('close')}</Text>
//         </TouchableOpacity>
//       </View>
//     </SafeAreaView>
//   );
// }

// const styles = {
//   container: {
//     flex: 1,
//     backgroundColor: '#FFFFFF',
//   },
//   content: {
//     flex: 1,
//     paddingHorizontal: 40,
//     paddingTop: 80,
//     alignItems: 'center',
//   },
//   iconContainer: {
//     marginBottom: 40,
//   },
//   mailIcon: {
//     width: 100,
//     height: 100,
//   },
//   title: {
//     fontSize: 24,
//     fontWeight: '600',
//     color: '#4A90E2',
//     textAlign: 'center',
//     marginBottom: 20,
//   },
//   subtitle: {
//     fontSize: 16,
//     color: '#666',
//     textAlign: 'center',
//     marginBottom: 10,
//   },
//   phoneNumber: {
//     fontSize: 18,
//     fontWeight: '600',
//     color: '#333',
//     textAlign: 'center',
//     marginBottom: 40,
//   },
//   otpContainer: {
//     flexDirection: 'row',
//     justifyContent: 'center',
//     gap: 12,
//     marginBottom: 40,
//   },
//   otpInput: {
//     width: 45,
//     height: 50,
//     borderBottomWidth: 3,
//     borderBottomColor: '#E0E0E0',
//     backgroundColor: 'transparent',
//     fontSize: 18,
//     fontWeight: '600',
//     color: '#333',
//     textAlign: 'center',
//     paddingBottom: 8,
//   },
//   otpInputFilled: {
//     borderBottomColor: '#4A90E2',
//   },
//   resendContainer: {
//     flexDirection: 'row',
//     alignItems: 'center',
//     justifyContent: 'center',
//     gap: 10,
//     marginBottom: 40,
//   },
//   resendText: {
//     fontSize: 14,
//     color: '#666',
//   },
//   resendButton: {
//     padding: 5,
//   },
//   resendButtonText: {
//     fontSize: 14,
//     color: '#999',
//     fontWeight: '600',
//   },
//   resendButtonTextActive: {
//     color: '#FF4444',
//   },
//   confirmButton: {
//     backgroundColor: '#4A90E2',
//     paddingVertical: 16,
//     borderRadius: 25,
//     alignItems: 'center',
//     width: '100%',
//     marginBottom: 16,
//   },
//   confirmButtonText: {
//     color: '#FFFFFF',
//     fontSize: 16,
//     fontWeight: '600',
//   },
//   closeButton: {
//     backgroundColor: 'transparent',
//     paddingVertical: 16,
//     borderRadius: 25,
//     borderWidth: 1,
//     borderColor: '#E0E0E0',
//     alignItems: 'center',
//     width: '100%',
//   },
//   closeButtonText: {
//     color: '#666',
//     fontSize: 16,
//     fontWeight: '600',
//   },
// };

// export default ForgotPasswordStep2Screen;
