// screens/Home/ChangeInfo.jsx
import React, { useContext, useEffect, useRef, useState, useMemo, useCallback, useRef as useRefRN } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  BackHandler,
  Animated,
  Easing,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserInfo, changeProfile } from '../../apis/auth';
import { NotificationContext } from '../../App';

const LANG_KEY = 'app_language';

const STRINGS = {
  vi: {
    headerTitle: 'Thông tin',
    loading: 'Đang tải thông tin',
    notLogged: 'Chưa đăng nhập hoặc thiếu token.',
    reloadLogin: 'Đăng nhập lại',
    account: 'Tài khoản',
    phoneOwner: 'Số điện thoại chủ xe',
    phoneOwnerPH: 'Số điện thoại chủ xe',
    vehicleName: 'Tên chủ xe',
    vehicleNamePH: 'VD: Trần Văn Nam',
    email: 'Email',
    emailPH: 'Email',
    edit: 'Chỉnh sửa',
    agree: 'Đồng ý',
    close: 'Đóng',
    deleteAccount: 'Xóa tài khoản',
    missingNameTitle: 'Thiếu thông tin',
    missingNameMsg: 'Tên chủ xe không được để trống.',
    invalidEmailTitle: 'Email không hợp lệ',
    invalidEmailMsg: 'Nhập đúng định dạng email.',
    successTitle: 'Thành công',
    successMsg: 'Thông tin đã được cập nhật!',
    errorTitle: 'Lỗi',
    updateFail: 'Cập nhật thất bại',
    warnTitle: 'Cảnh báo',
    warnLead: 'Xóa tài khoản sẽ:',
    warn1: '• Xóa thông tin tài khoản',
    warn2: '• Xóa thiết bị định vị khỏi tài khoản',
    warn3: '• Không thể hoàn tác và phục hồi dữ liệu cũ',
    modalClose: 'Đóng',
    modalConfirm: 'Đồng ý',
    deleteOkTitle: 'Thành công',
    deleteOkMsg: 'Tài khoản đã được xóa!',
    saving: 'Đang lưu',
  },
  en: {
    headerTitle: 'Information',
    loading: 'Loading profile',
    notLogged: 'Not signed in or missing token.',
    reloadLogin: 'Sign in again',
    account: 'Account',
    phoneOwner: 'Owner phone number',
    phoneOwnerPH: 'Owner phone number',
    vehicleName: 'Owner full name',
    vehicleNamePH: 'e.g., Tran Van Nam',
    email: 'Email',
    emailPH: 'Email',
    edit: 'Edit',
    agree: 'Confirm',
    close: 'Close',
    deleteAccount: 'Delete account',
    missingNameTitle: 'Missing info',
    missingNameMsg: 'Owner name must not be empty.',
    invalidEmailTitle: 'Invalid email',
    invalidEmailMsg: 'Please enter a valid email.',
    successTitle: 'Success',
    successMsg: 'Profile updated!',
    errorTitle: 'Error',
    updateFail: 'Update failed',
    warnTitle: 'Warning',
    warnLead: 'Deleting your account will:',
    warn1: '• Remove your account information',
    warn2: '• Unlink tracking device from your account',
    warn3: '• Be irreversible and data cannot be recovered',
    modalClose: 'Close',
    modalConfirm: 'Confirm',
    deleteOkTitle: 'Success',
    deleteOkMsg: 'Account deleted!',
    saving: 'Saving',
  },
};

/* =========================
   Shimmer Skeleton Helpers
   ========================= */
const Shimmer = ({ style }) => {
  const shimmerX = useRefRN(new Animated.Value(-1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(shimmerX, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [shimmerX]);

  return (
    <View style={[styles.skelBase, style]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.skelShine,
          {
            transform: [
              {
                translateX: shimmerX.interpolate({
                  inputRange: [-1, 1],
                  outputRange: [-200, 200], // chạy ngang qua block
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
};

const SkeletonLine = ({ width = '100%', height = 14, radius = 6, style }) => (
  <Shimmer style={[{ width, height, borderRadius: radius }, style]} />
);

const SkeletonBlock = ({ height = 44, radius = 10, style }) => (
  <Shimmer style={[{ width: '100%', height, borderRadius: radius }, style]} />
);

/* Loading screen với skeleton */
const FancyLoading = ({ t }) => {
  // Animated dots cho caption
  const dot1 = useRefRN(new Animated.Value(0)).current;
  const dot2 = useRefRN(new Animated.Value(0)).current;
  const dot3 = useRefRN(new Animated.Value(0)).current;

  useEffect(() => {
    const mk = (val, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(val, { toValue: 1, duration: 350, delay, useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 350, useNativeDriver: true }),
        ])
      ).start();
    mk(dot1, 0);
    mk(dot2, 150);
    mk(dot3, 300);
    return () => {
      dot1.stopAnimation();
      dot2.stopAnimation();
      dot3.stopAnimation();
    };
  }, [dot1, dot2, dot3]);

  const Dot = ({ val }) => (
    <Animated.Text style={{ opacity: val, fontSize: 16, color: '#5c6b7a' }}>{' .'}</Animated.Text>
  );

  return (
    <View style={styles.loadingRoot}>
      {/* Header skeleton */}
      <View style={styles.header}>
        <SkeletonLine width={28} height={24} radius={6} style={{ opacity: 0.55 }} />
        <SkeletonLine width={120} height={22} radius={6} style={{ opacity: 0.75 }} />
        <View style={{ width: 28 }}>
          <SkeletonLine width={24} height={24} radius={12} style={{ alignSelf: 'flex-end', opacity: 0.6 }} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollInner}>
        {/* account */}
        <SkeletonLine width={90} height={12} style={{ marginBottom: 8 }} />
        <SkeletonBlock height={44} />

        {/* phone */}
        <View style={{ height: 16 }} />
        <SkeletonLine width={140} height={12} style={{ marginBottom: 8 }} />
        <SkeletonBlock height={44} />

        {/* name */}
        <View style={{ height: 16 }} />
        <SkeletonLine width={120} height={12} style={{ marginBottom: 8 }} />
        <SkeletonBlock height={44} />

        {/* email */}
        <View style={{ height: 16 }} />
        <SkeletonLine width={60} height={12} style={{ marginBottom: 8 }} />
        <SkeletonBlock height={44} />

        {/* buttons */}
        <View style={{ height: 24 }} />
        <SkeletonBlock height={46} radius={24} />
        <View style={{ height: 12 }} />
        <SkeletonBlock height={46} radius={24} />
        <View style={{ height: 12 }} />
        <SkeletonBlock height={46} radius={24} />

        {/* caption */}
        <View style={{ alignItems: 'center', marginTop: 24 }}>
          <Text style={{ color: '#5c6b7a' }}>
            {t('loading')}
            <Dot val={dot1} />
            <Dot val={dot2} />
            <Dot val={dot3} />
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

/* =========================
       Main Component
   ========================= */
const ChangeInfo = ({ logout, navigateToScreen, navigation }) => {
  const [language, setLanguage] = useState('vi');
  const t = (k) => STRINGS[language][k] || k;

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState('');
  const [saving, setSaving] = useState(false);

  const notifCtx = useContext(NotificationContext) || {};
  const notifications = Array.isArray(notifCtx.notifications) ? notifCtx.notifications : [];
  const setNotifications =
    typeof notifCtx.setNotifications === 'function' ? notifCtx.setNotifications : () => {};

  const [accountInfo, setAccountInfo] = useState({
    account: '',
    phoneOwner: '',
    vehicleName: '',
    email: '',
  });

  const phoneRef = useRef(null);
  const nameRef = useRef(null);
  const emailRef = useRef(null);

  const unreadCount = useMemo(
    () => (Array.isArray(notifications) ? notifications.reduce((acc, n) => acc + (n?.isRead ? 0 : 1), 0) : 0),
    [notifications]
  );

  // ===== load language =====
  useEffect(() => {
    (async () => {
      try {
        const savedLang = await AsyncStorage.getItem(LANG_KEY);
        if (savedLang) setLanguage(savedLang);
      } catch {}
    })();
  }, []);

  // ===== load profile =====
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setLoadErr('');
        const token = await AsyncStorage.getItem('access_token');
        if (!token) {
          setLoadErr(t('notLogged'));
          setLoading(false);
          return;
        }
        const data = await getUserInfo(token);
        if (mounted) {
          setAccountInfo({
            account: data?.username ?? '',
            phoneOwner: data?.phone ?? '',
            vehicleName: data?.name ?? '',
            email: data?.email ?? '',
          });
        }
      } catch (e) {
        setLoadErr(typeof e === 'string' ? e : (e?.message || t('errorTitle')));
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const splitFullName = (fullName) => {
    if (!fullName || typeof fullName !== 'string') return { first_name: '', last_name: '' };
    const parts = fullName.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return { first_name: '', last_name: '' };
    if (parts.length === 1) return { first_name: parts[0], last_name: '' };
    const first_name = parts[0];
    const last_name = parts.slice(1).join(' ');
    return { first_name, last_name };
  };

  const goInformation = useCallback(() => {
    navigateToScreen && navigateToScreen('Information');
  }, [navigateToScreen]);

  const handleBackPress = useCallback(() => {
    if (showDeleteModal) {
      setShowDeleteModal(false);
      return true;
    }
    if (isEditing) {
      setIsEditing(false);
      return true;
    }
    goInformation();
    return true;
  }, [showDeleteModal, isEditing, goInformation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => sub.remove();
  }, [handleBackPress]);

  useEffect(() => {
    if (!navigation || typeof navigation.addListener !== 'function') return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (showDeleteModal) {
        e.preventDefault();
        setShowDeleteModal(false);
        return;
      }
      if (isEditing) {
        e.preventDefault();
        setIsEditing(false);
        return;
      }
      e.preventDefault();
      goInformation();
    });
    return unsub;
  }, [navigation, showDeleteModal, isEditing, goInformation]);

  const handleEditPress = () => setIsEditing((v) => !v);

  const handleSavePress = async () => {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    try {
      const email = (accountInfo.email || '').trim();
      const phone = (accountInfo.phoneOwner || '').trim();
      const fullName = (accountInfo.vehicleName || '').trim();

      if (!fullName) return Alert.alert(t('missingNameTitle'), t('missingNameMsg'));
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return Alert.alert(t('invalidEmailTitle'), t('invalidEmailMsg'));

      setSaving(true);
      const token = await AsyncStorage.getItem('access_token');
      if (!token) throw new Error('Missing accessToken.');

      const { first_name, last_name } = splitFullName(fullName);

      await changeProfile(token, { first_name, last_name, email, phone });

      const fresh = await getUserInfo(token);
      setAccountInfo((prev) => ({
        ...prev,
        account: fresh?.username ?? prev.account,
        phoneOwner: fresh?.phone ?? phone,
        vehicleName: fresh?.name ?? fullName,
        email: fresh?.email ?? email,
      }));

      setIsEditing(false);
      Alert.alert(t('successTitle'), t('successMsg'));
    } catch (e) {
      const msg = typeof e === 'string' ? e : (e?.message || t('updateFail'));
      Alert.alert(t('errorTitle'), msg);
    } finally {
      setSaving(false);
    }
  };

  const handleClosePress = () => setIsEditing(false);

  const handleDeleteAccount = () => setShowDeleteModal(true);
  const confirmDeleteAccount = () => {
    setShowDeleteModal(false);
    Alert.alert(t('deleteOkTitle'), t('deleteOkMsg'), [{ text: 'OK', onPress: () => logout && logout() }]);
  };
  const cancelDeleteAccount = () => setShowDeleteModal(false);

  if (loading) {
    return <FancyLoading t={t} />;
  }

  if (loadErr) {
    return (
      <View style={[styles.container, { justifyContent: 'center', padding: 20 }]}>
        <Text style={{ color: '#d32f2f', textAlign: 'center', marginBottom: 12 }}>{loadErr}</Text>
        <TouchableOpacity style={styles.saveButton} onPress={() => navigateToScreen && navigateToScreen('Login')}>
          <Text style={styles.saveButtonText}>{t('reloadLogin')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleNotificationPress = () => {
    setNotifications((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.map((n) => ({ ...(n && typeof n === 'object' ? n : {}), isRead: true }));
    });
    navigateToScreen && navigateToScreen('notification', { from: 'changeInfo' });
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{t('headerTitle')}</Text>

        <TouchableOpacity style={styles.notificationButton} onPress={handleNotificationPress}>
          <View style={styles.notificationContainer}>
            <Icon name="notifications" size={24} color="white" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Body */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView contentContainerStyle={styles.scrollInner} keyboardShouldPersistTaps="handled">
          {/* Account */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('account')}</Text>
            <View style={[styles.inputContainer, styles.accountInput, styles.disabledInput]}>
              <TextInput
                style={[styles.input, styles.disabledText]}
                value={accountInfo.account}
                editable={false}
                placeholder={t('account')}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => phoneRef.current?.focus()}
              />
            </View>
          </View>

          {/* Phone */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('phoneOwner')}</Text>
            <View style={styles.inputContainer}>
              <TextInput
                ref={phoneRef}
                style={styles.input}
                value={accountInfo.phoneOwner}
                onChangeText={(text) => setAccountInfo({ ...accountInfo, phoneOwner: text })}
                editable={isEditing && !saving}
                placeholder={t('phoneOwnerPH')}
                keyboardType="phone-pad"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => nameRef.current?.focus()}
              />
            </View>
          </View>

          {/* Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('vehicleName')}</Text>
            <View style={styles.inputContainer}>
              <TextInput
                ref={nameRef}
                style={styles.input}
                value={accountInfo.vehicleName}
                onChangeText={(text) => setAccountInfo({ ...accountInfo, vehicleName: text })}
                editable={isEditing && !saving}
                placeholder={t('vehicleNamePH')}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('email')}</Text>
            <View style={styles.inputContainer}>
              <TextInput
                ref={emailRef}
                style={styles.input}
                value={accountInfo.email}
                onChangeText={(text) => setAccountInfo({ ...accountInfo, email: text })}
                editable={isEditing && !saving}
                placeholder={t('emailPH')}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="done"
              />
            </View>
          </View>

          {/* Actions */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.saveButton, saving && { opacity: 0.7 }]}
              onPress={handleSavePress}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#fff" /> : (
                <Text style={styles.saveButtonText}>{isEditing ? t('agree') : t('edit')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={isEditing ? handleClosePress : handleBackPress}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>{t('close')}</Text>
            </TouchableOpacity>

            {!isEditing && (
              <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount} disabled={saving}>
                <Text style={styles.deleteButtonText}>{t('deleteAccount')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Saving overlay (fancy) */}
      {saving && (
        <View style={styles.savingOverlay} pointerEvents="none">
          <View style={styles.savingCard}>
            <ActivityIndicator size="small" color="#1e88e5" />
            <SavingDots label={t('saving')} />
          </View>
        </View>
      )}

      {/* Delete Modal */}
      <Modal animationType="fade" transparent visible={showDeleteModal} onRequestClose={cancelDeleteAccount}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{t('warnTitle')}</Text>

            <View style={styles.warningContainer}>
              <Icon name="error" size={24} color="#FF5722" />
              <Text style={styles.warningTitle}>{t('warnLead')}</Text>
            </View>

            <View style={styles.warningList}>
              <Text style={styles.warningItem}>{t('warn1')}</Text>
              <Text style={styles.warningItem}>{t('warn2')}</Text>
              <Text style={styles.warningItem}>{t('warn3')}</Text>
            </View>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={cancelDeleteAccount}>
                <Text style={styles.modalCancelButtonText}>{t('modalClose')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={confirmDeleteAccount}>
                <Text style={styles.modalConfirmButtonText}>{t('modalConfirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

/* Dots label for saving */
const SavingDots = ({ label }) => {
  const d1 = useRefRN(new Animated.Value(0)).current;
  const d2 = useRefRN(new Animated.Value(0)).current;
  const d3 = useRefRN(new Animated.Value(0)).current;
  useEffect(() => {
    const seq = (v, delay) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 300, delay, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 300, useNativeDriver: true }),
        ])
      ).start();
    seq(d1, 0);
    seq(d2, 120);
    seq(d3, 240);
    return () => {
      d1.stopAnimation();
      d2.stopAnimation();
      d3.stopAnimation();
    };
  }, [d1, d2, d3]);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
      <Text style={{ color: '#1e88e5', fontWeight: '600' }}>{label}</Text>
      <Animated.Text style={{ opacity: d1, color: '#1e88e5' }}> .</Animated.Text>
      <Animated.Text style={{ opacity: d2, color: '#1e88e5' }}> .</Animated.Text>
      <Animated.Text style={{ opacity: d3, color: '#1e88e5' }}> .</Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  /* Header */
  header: {
    backgroundColor: '#1e88e5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingTop: 45,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: { padding: 4 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '500' },
  notificationButton: { padding: 4 },
  notificationContainer: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold', textAlign: 'center' },

  /* Form */
  scrollInner: { padding: 16, paddingBottom: 28 },
  inputGroup: { marginBottom: 12 },
  label: { fontSize: 13, color: '#666', marginBottom: 6, marginLeft: 4 },
  inputContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  disabledInput: { backgroundColor: '#f9f9f9' },
  input: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#333' },
  disabledText: { color: '#999' },
  accountInput: { flex: 1 },

  /* Buttons */
  buttonContainer: { marginTop: 18, gap: 12 },
  saveButton: { backgroundColor: '#1e88e5', borderRadius: 24, paddingVertical: 12, alignItems: 'center' },
  saveButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
  cancelButton: {
    backgroundColor: 'white',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: { color: '#666', fontSize: 15, fontWeight: '500' },
  deleteButton: {
    backgroundColor: 'white',
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1e88e5',
  },
  deleteButtonText: { color: '#FF5722', fontSize: 15, fontWeight: '500' },

  /* Modal */
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { backgroundColor: 'white', borderRadius: 15, padding: 25, margin: 20, maxWidth: 350, width: '90%' },
  modalTitle: { fontSize: 18, fontWeight: '600', color: '#1e88e5', textAlign: 'center', marginBottom: 20 },
  warningContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  warningTitle: { fontSize: 16, fontWeight: '500', color: '#FF5722', marginLeft: 10 },
  warningList: { marginBottom: 25, paddingLeft: 10 },
  warningItem: { fontSize: 14, color: '#666', marginBottom: 8, lineHeight: 20 },
  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
  modalCancelButton: {
    flex: 1, backgroundColor: 'white', borderRadius: 25, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ddd',
  },
  modalCancelButtonText: { color: '#666', fontSize: 16, fontWeight: '500' },
  modalConfirmButton: {
    flex: 1, backgroundColor: 'white', borderRadius: 25, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ddd',
  },
  modalConfirmButtonText: { color: '#666', fontSize: 16, fontWeight: '500' },

  /* Skeleton */
  loadingRoot: { flex: 1, backgroundColor: '#f5f7fb' },
  skelBase: {
    overflow: 'hidden',
    backgroundColor: '#e9eef5',
  },
  skelShine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 120,
    backgroundColor: '#f6f9ff',
    opacity: 0.9,
  },

  /* Saving overlay */
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245, 247, 251, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  savingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    width: 180,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 3,
  },
});

export default ChangeInfo;
