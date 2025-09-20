// screens/Home/DeviceList.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image,
  Modal, TextInput, RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDevice, getVehicleCategories, buildVehicleCategoryMap, getExtendHistory } from '../../apis/devices';
import { showMessage } from '../../components/Toast/Toast';
import { login as loginApi } from '../../apis/auth';
import logoGPS from '../../assets/img/ic_gps_2-removebg-preview.png';
import iconsGpsExpires from '../../assets/img/ic_gps_1.png';

const K_DEVICES = 'devices_cache_v1';
const K_VEH_CATS = 'vehicle_cats_cache_v1';
const LANG_KEY = 'app_language';

const STRINGS = {
  vi: {
    header: 'Danh sách thiết bị',
    searchPH: 'Tìm theo biển số, SĐT...',
    vehiclePlate: 'Biển số xe',
    driver: 'Lái xe',
    vehicleType: 'Loại xe',
    devicePhone: 'SĐT thiết bị',
    activedDate: 'Ngày kích hoạt',
    expiredDate: 'Ngày hết hạn',
    isExpired: 'Hết hạn sử dụng',
    extend: 'Gia hạn',
    addDevice: 'Thêm thiết bị',
    edit: 'Sửa',
    call: 'Gọi',
    settings: 'Thiết lập',
    empty: 'Chưa có thiết bị nào.',
    // modal
    modalTitle: 'Thay đổi thông tin',
    modalPH: 'Mật khẩu xác nhận',
    close: 'Đóng',
    agree: 'Đồng ý',
    checking: 'Đang kiểm tra...',
    // messages
    enterConfirmPwd: 'Vui lòng nhập mật khẩu xác nhận',
    missingUsername: 'Thiếu username. Vui lòng đăng nhập lại.',
    wrongPwd: 'Mật khẩu không đúng',
    missingToken: 'Thiếu access token. Vui lòng đăng nhập lại.',
    loadFail: 'Tải danh sách thiết bị thất bại',
    // fallback
    unknownType: 'Chưa xác định',
  },
  en: {
    header: 'Devices',
    searchPH: 'Search by plate, phone...',
    vehiclePlate: 'Plate',
    driver: 'Driver',
    vehicleType: 'Vehicle type',
    devicePhone: 'Device phone',
    activedDate: 'Activated on',
    expiredDate: 'Expiry date',
    isExpired: 'Expired on',
    extend: 'Extend',
    addDevice: 'Add device',
    edit: 'Edit',
    call: 'Call',
    settings: 'Settings',
    empty: 'No devices yet.',
    // modal
    modalTitle: 'Change information',
    modalPH: 'Confirmation password',
    close: 'Close',
    agree: 'Confirm',
    checking: 'Checking...',
    // messages
    enterConfirmPwd: 'Please enter the confirmation password',
    missingUsername: 'Missing username. Please sign in again.',
    wrongPwd: 'Incorrect password',
    missingToken: 'Missing access token. Please sign in again.',
    loadFail: 'Failed to load devices',
    // fallback
    unknownType: 'Unknown',
  },
};

const formatPhone = (p) => {
  if (!p) return '—';
  const s = String(p).trim();
  if (s.length === 10 && s[0] !== '0') return '0' + s;
  return s;
};

const DeviceList = ({ navigateToScreen }) => {
  const isMountedRef = useRef(true);
  const [language, setLanguage] = useState('vi');
  const [rawDevices, setRawDevices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [query, setQuery] = useState('');
  // modal password
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [checking, setChecking] = useState(false);
  // pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  
  const t = useCallback((k) => STRINGS[language][k] || k, [language]);
  const locale = language === 'en' ? 'en-US' : 'vi-VN';

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Load language - chỉ chạy một lần
  useEffect(() => {
    let mounted = true;
    
    const loadLanguage = async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (mounted && saved) {
          setLanguage(saved);
        }
      } catch (error) {
        console.log('Error loading language:', error);
      }
    };
    
    loadLanguage();
    
    return () => {
      mounted = false;
    };
  }, []);

  const catMap = useMemo(() => buildVehicleCategoryMap(categories), [categories]);

  // Load cache - stable function
  const loadFromCache = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const [dStr, cStr] = await Promise.all([
        AsyncStorage.getItem(K_DEVICES),
        AsyncStorage.getItem(K_VEH_CATS),
      ]);
      
      if (!isMountedRef.current) return;
      
      if (dStr) {
        const parsed = JSON.parse(dStr);
        if (Array.isArray(parsed)) {
          setRawDevices(parsed);
        }
      }
      if (cStr) {
        const parsed = JSON.parse(cStr);
        if (Array.isArray(parsed)) {
          setCategories(parsed);
        }
      }
    } catch (error) {
      console.log('Error loading cache:', error);
    }
  }, []);

  // Fetch fresh data - stable function
  const fetchFresh = useCallback(async (showToastOnError = false) => {
    if (!isMountedRef.current) return;
    
    try {
      const token = await AsyncStorage.getItem('access_token');
      
      if (!isMountedRef.current) return;
      
      if (!token) {
        if (showToastOnError) {
          showMessage('Thiếu access token. Vui lòng đăng nhập lại.');
        }
        return;
      }

      const [devicesRes, catsRes] = await Promise.all([
        getDevice(token),
        getVehicleCategories(token).catch(() => []),
      ]);

      if (!isMountedRef.current) return;

      const d = Array.isArray(devicesRes) ? devicesRes : [];
      const c = Array.isArray(catsRes) ? catsRes : [];
      
      setRawDevices(d);
      setCategories(c);

      // Save to cache
      await AsyncStorage.setItem(K_DEVICES, JSON.stringify(d));
      await AsyncStorage.setItem(K_VEH_CATS, JSON.stringify(c));
      
    } catch (err) {
      if (!isMountedRef.current) return;
      
      if (showToastOnError) {
        let msg = err?.message || 'Tải danh sách thiết bị thất bại';
        try {
          const parsed = JSON.parse(err.message);
          msg = parsed?.message || msg;
        } catch {}
        showMessage(msg);
      }
    } finally {
      if (isMountedRef.current) {
        setHasFetchedOnce(true);
      }
    }
  }, []);

  // Initial load - chỉ chạy một lần
  useEffect(() => {
    let mounted = true;
    
    const initialLoad = async () => {
      if (!mounted) return;
      await loadFromCache();
      if (!mounted) return;
      await fetchFresh(false);
    };
    
    initialLoad();
    
    return () => {
      mounted = false;
    };
  }, [loadFromCache, fetchFresh]);

  const onRefresh = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    setRefreshing(true);
    await fetchFresh(true);
    
    if (isMountedRef.current) {
      setRefreshing(false);
    }
  }, [fetchFresh]);

  const devices = useMemo(() => {
    return (rawDevices || []).map((d) => {
      // ngày hết hạn
      const expiryDateRaw = d?.date_exp || d?.expiry_date;
      let formattedExpiryDate = '—';
      let isExpired = false;
      
      if (expiryDateRaw) {
        try {
          const exp = new Date(expiryDateRaw);
          if (!isNaN(exp.getTime())) {
            formattedExpiryDate = exp.toLocaleDateString(locale, { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric' 
            });
            const today = new Date();
            exp.setHours(0,0,0,0);
            today.setHours(0,0,0,0);
            isExpired = exp.getTime() < today.getTime();
          }
        } catch {}
      }

      // ngày kích hoạt
      const activeDateRaw = d?.date_actived || d?.activated_date || d?.active_date;
      let formattedActiveDate = '—';
      if (activeDateRaw) {
        try {
          const act = new Date(activeDateRaw);
          if (!isNaN(act.getTime())) {
            formattedActiveDate = act.toLocaleDateString(locale, { 
              day: '2-digit', 
              month: '2-digit', 
              year: 'numeric' 
            });
          }
        } catch {}
      }

      return {
        id: d?._id || d?.imei || Math.random().toString(36).slice(2),
        imei: d?.imei || '',
        vehicleNumber: d?.license_plate || d?.imei || '—',
        driverNumber: d?.driver || '—',
        vehicleType: catMap[d?.vehicle_category_id] || 'Chưa xác định',
        devicePhone: formatPhone(d?.phone_number),
        expiryDate: formattedExpiryDate,
        activeDate: formattedActiveDate,
        isExpired,
        version: d?.version || '—',
        raw: d,
      };
    });
  }, [rawDevices, catMap, locale]);

  const filteredDevices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter(d =>
      [
        d.vehicleNumber || '',
        d.driverNumber || '',
        d.devicePhone || '',
        d.expiryDate || '',
        d.activeDate || '',
        d.imei || '',
        d.vehicleType || '',
      ].join(' ').toLowerCase().includes(q)
    );
  }, [devices, query]);

  const handleAddDevice = () => setShowPasswordModal(true);
  
  const handleEditDevice = (deviceRaw) => {
    navigateToScreen('devicesInfo', { device: deviceRaw });
  };
  
  const handleCallDevice = (deviceRaw) => {
   navigateToScreen('phoneUser', { device: deviceRaw });
 
  };
  
  const handleExtendDevice = (deviceRaw) => {
    navigateToScreen('extend', { from: 'Device', device: deviceRaw });
  };

  const handleDeviceSettings = async (deviceRaw) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const raw = await getExtendHistory({ 
        accessToken: token, 
        deviceId: deviceRaw?._id || deviceRaw?.id || deviceRaw?.imei 
      });
      navigateToScreen('historyExtend', { device: deviceRaw, prefetched: raw });
    } catch (error) {
      console.log('Error getting extend history:', error);
      navigateToScreen('historyExtend', { device: deviceRaw });
    }
  };

  const handlePasswordSubmit = async () => {
    if (!password) {
      showMessage(t('enterConfirmPwd'));
      return;
    }
    
    try {
      setChecking(true);
      const savedUsername = await AsyncStorage.getItem('username');
      
      if (!savedUsername) {
        showMessage(t('missingUsername'));
        return;
      }
      
      const res = await loginApi(savedUsername, password);
      
      await AsyncStorage.setItem('access_token', res.access_token);
      await AsyncStorage.setItem('refresh_token', res.refresh_token || '');
      
      setShowPasswordModal(false);
      setPassword('');
      
      navigateToScreen('AddDevices', {
        rawDevices,
        devices,
        suggestedIMEI: devices?.[0]?.imei || '',
        from: 'DeviceList',
      });
    } catch {
      showMessage(t('wrongPwd'));
    } finally {
      setChecking(false);
    }
  };

  const handlePasswordCancel = () => {
    setShowPasswordModal(false);
    setPassword('');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {!isSearching ? (
          <>
            <Text style={styles.headerTitle}>{t('header')}</Text>
            <TouchableOpacity style={styles.iconBtn} onPress={() => setIsSearching(true)}>
              <Icon name="search" size={24} color="white" />
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity style={styles.iconBtn} onPress={() => { setIsSearching(false); setQuery(''); }}>
              <Icon name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <View style={styles.searchBar}>
              <Icon name="search" size={20} color="#cfe3ff" />
              <TextInput
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder={t('searchPH')}
                placeholderTextColor="#cfe3ff"
                autoFocus
                returnKeyType="search"
                selectionColor="#fff"
              />
              {!!query && (
                <TouchableOpacity onPress={() => setQuery('')}>
                  <Icon name="close" size={20} color="#cfe3ff" />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.iconBtn} />
          </>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {filteredDevices.map((d) => (
           <TouchableOpacity
  key={d.id}
  style={[styles.deviceCard, d.isExpired && styles.expiredCard]}
  activeOpacity={0.8}
  onPress={() => handleDeviceSettings(d.raw)} // 👈 bấm card cũng mở settings
>
  <Image source={d.isExpired ? iconsGpsExpires : logoGPS} style={styles.logoGps} />
  <View style={{ flex: 1 }}>
    <View style={styles.cardHeaderRow}>
      <Text style={styles.vehicleNumber} numberOfLines={1}>
        {t('vehiclePlate')}: {d.vehicleNumber}
      </Text>
      <TouchableOpacity style={styles.smallIconBtn} onPress={() => handleEditDevice(d.raw)}>
         
        <Icon name="edit" size={18} color="#4A90E2" />
      </TouchableOpacity>
    </View>
    <Text style={styles.infoText} numberOfLines={1}>{t('driver')}: {d.driverNumber}</Text>
    <Text style={styles.infoText} numberOfLines={1}>{t('vehicleType')}: {d.vehicleType}</Text>
    <View style={styles.row}>
      <Text style={styles.infoText} numberOfLines={1}>{t('devicePhone')}: {d.devicePhone}</Text>
      <View style={styles.stackRight}>
        <TouchableOpacity style={styles.smallIconBtn} onPress={() => handleCallDevice(d.raw)}>
          <Icon name="phone" size={18} color="#4A90E2" />
        </TouchableOpacity>
      </View>
    </View>
    <Text style={[styles.infoText, styles.dateLine]} numberOfLines={1}>
      {t('activedDate')}: {d.activeDate}
    </Text>
    <Text
      style={[
        styles.infoText,
        styles.dateLine,
        d.isExpired && styles.expiredText
      ]}
      numberOfLines={1}
    >
      {d.isExpired ? `${t('isExpired')}: ` : `${t('expiredDate')}: `}{d.expiryDate}
    </Text>
    <View style={styles.bottomRow}>
      <TouchableOpacity style={styles.extendButton} onPress={() => handleExtendDevice(d.raw)}>
        <Text style={styles.extendText}>{t('extend')}</Text>
        <Icon name="arrow-forward" size={18} color="white" />
      </TouchableOpacity>
      <View style={{ flex: 1 }} />
      <TouchableOpacity
        style={[styles.trailingIconBtn, { marginLeft: 6 }]}
        onPress={() => handleDeviceSettings(d.raw)}
      >
        <Icon name="tune" size={22} color="#4A90E2" />
      </TouchableOpacity>
    </View>
  </View>
</TouchableOpacity>

          ))}
          
          {/* Empty state */}
          {hasFetchedOnce && filteredDevices.length === 0 && (
            <Text style={{ textAlign: 'center', color: '#666', marginTop: 24 }}>
              {t('empty')}
            </Text>
          )}
        </ScrollView>
        
        <TouchableOpacity style={styles.addButton} onPress={handleAddDevice}>
          <View style={styles.addCircle}>
            <Icon name="add" size={18} color="#4A90E2" />
          </View>
          <Text style={styles.addButtonText}>{t('addDevice')}</Text>
        </TouchableOpacity>
      </View>

      {/* Password Modal */}
      <Modal animationType="fade" transparent visible={showPasswordModal} onRequestClose={handlePasswordCancel}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{t('modalTitle')}</Text>
            <View style={styles.passwordInputContainer}>
              <View style={styles.passwordInputWrapper}>
                <Icon name="lock" size={20} color="#999" style={styles.lockIcon} />
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('modalPH')}
                  secureTextEntry={!showPassword}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity onPress={() => setShowPassword(s => !s)} style={styles.eyeIcon}>
                  <Icon name={showPassword ? 'visibility-off' : 'visibility'} size={20} color="#999" />
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={handlePasswordCancel}>
                <Text style={styles.modalCancelButtonText}>{t('close')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, checking && { opacity: 0.6 }]}
                onPress={handlePasswordSubmit}
                disabled={checking}
              >
                <Text style={styles.modalConfirmButtonText}>{checking ? t('checking') : t('agree')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default DeviceList;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    paddingTop: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: '600' },
  iconBtn: { padding: 6 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginHorizontal: 6,
    height: 38,
  },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 0 },
  content: { flex: 1, paddingHorizontal: 12, paddingTop: 12 },
  deviceCard: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#4A90E2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 1.5,
    elevation: 1,
  },
  expiredCard: {
    borderColor: '#E53935',
  },
  logoGps: {
    width: 40, height: 40,
    resizeMode: 'contain',
    marginRight: 10,
    marginTop: 4,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  vehicleNumber: { fontSize: 15, fontWeight: '700', color: '#333', flex: 1, paddingRight: 8 },
  infoText: { fontSize: 13, color: '#333', marginBottom: 2, lineHeight: 18 },
  dateLine: { marginTop: 2 },
  expiredText: { color: '#E53935', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  stackRight: { alignItems: 'center' },
  smallIconBtn: {
    width: 30, height: 30,
    borderRadius: 15,
    backgroundColor: '#E3F2FD',
    alignItems: 'center', justifyContent: 'center',
  },
  bottomRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6 },
  extendButton: {
    backgroundColor: '#4A90E2',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  extendText: { color: 'white', fontSize: 14, fontWeight: '600' },
  trailingIconBtn: {
    width: 32, height: 32,
    borderRadius: 16,
    backgroundColor: '#E3F2FD',
    alignItems: 'center', justifyContent: 'center',
  },
  addButton: {
    alignSelf: 'center',
    marginTop: 6,
    marginBottom: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#4A90E2',
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addCircle: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#E3F2FD', alignItems: 'center', justifyContent: 'center' },
  addButtonText: { color: '#4A90E2', fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContainer: { backgroundColor: 'white', borderRadius: 15, padding: 24, margin: 20, width: '90%', maxWidth: 360 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#4A90E2', textAlign: 'center', marginBottom: 20 },
  passwordInputContainer: { marginBottom: 24 },
  passwordInputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10,
    backgroundColor: 'white', paddingHorizontal: 14, height: 50,
  },
  lockIcon: { marginRight: 8 },
  passwordInput: { flex: 1, fontSize: 16, color: '#333', paddingVertical: 0 },
  eyeIcon: { padding: 4, marginLeft: 6 },
  modalButtonContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  modalCancelButton: { flex: 1, backgroundColor: 'white', borderRadius: 26, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  modalCancelButtonText: { color: '#666', fontSize: 16, fontWeight: '600' },
  modalConfirmButton: { flex: 1, backgroundColor: '#4A90E2', borderRadius: 26, paddingVertical: 12, alignItems: 'center' },
  modalConfirmButtonText: { color: 'white', fontSize: 16, fontWeight: '600' },
});