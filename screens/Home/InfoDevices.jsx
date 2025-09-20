// screens/Home/DevicesInfo.jsx
import React, { useEffect, useMemo, useRef, useState, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
  BackHandler,
  FlatList,
  TouchableWithoutFeedback,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { updateDevice, getVehicleCategories, deleteDevice } from '../../apis/devices';
import { NotificationContext } from '../../App';

const PRIMARY = '#1e88e5';
const BORDER  = '#e5e7eb';
const TEXT    = '#0f172a';
const MUTED   = '#667085';

const DevicesInfo = ({ navigateToScreen, screenData, navigation }) => {
  const dev = screenData?.device || {};

  const [deviceInfo, setDeviceInfo] = useState({
    devicePhone  : dev?.phone_number  || '',
    vehicleNumber: dev?.license_plate || '',
    driverName   : dev?.driver        || '',
  });

  const [saving, setSaving] = useState(false);

  // vehicle categories
  const [categories, setCategories] = useState([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catErr, setCatErr] = useState('');
  const [selectedCatId, setSelectedCatId] = useState(dev?.vehicle_category_id || null);

  // dropdown overlay
  const [openCat, setOpenCat] = useState(false);
  const anchorRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  const catMap = useMemo(() => {
    const m = {};
    for (const c of categories) m[c._id] = c.name;
    return m;
  }, [categories]);

  // notification badge
  const { notifications, setNotifications } = useContext(NotificationContext);
  const unreadCount = (notifications || []).filter(n => !n.isRead).length;

  const handleNotificationPress = () => {
    setNotifications(prev => (Array.isArray(prev) ? prev.map(n => ({ ...n, isRead: true })) : []));
    navigateToScreen('notification', { from: 'devicesInfo', device: dev });
  };

  // load categories
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setCatLoading(true);
        setCatErr('');
        const token = await AsyncStorage.getItem('access_token');
        const list = await getVehicleCategories(token);
        if (!alive) return;
        const arr = Array.isArray(list) ? list : [];
        setCategories(arr);
        if (!selectedCatId && arr.length) setSelectedCatId(arr[0]._id);
      } catch (e) {
        setCatErr(e?.message || 'Không tải được danh mục loại xe');
      } finally {
        setCatLoading(false);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // back handlers
  const goBack = useCallback(() => {
    navigateToScreen && navigateToScreen('Device');
    return true;
  }, [navigateToScreen]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
  }, [goBack]);

  useEffect(() => {
    if (!navigation || typeof navigation.addListener !== 'function') return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      goBack();
    });
    return unsub;
  }, [navigation, goBack]);

  // helpers
  const handleInputChange = (field, value) =>
    setDeviceInfo((prev) => ({ ...prev, [field]: value }));

  const handleVehicleTypeSelect = (typeId) => {
    setSelectedCatId(typeId);
    setOpenCat(false);
  };

  const measureAnchor = () => {
    if (!anchorRef.current) return;
    // cần collapsable={false} ở View chứa ref
    setTimeout(() => {
      anchorRef.current?.measureInWindow?.((x, y, w, h) => {
        setMenuPos({ top: y + h + 4, left: x, width: w });
      });
    }, 0);
  };

  const handleAgreePress = async () => {
    try {
      const phone_number  = (deviceInfo.devicePhone  || '').trim();
      const license_plate = (deviceInfo.vehicleNumber|| '').trim();
      const driver        = (deviceInfo.driverName   || '').trim();

      if (!license_plate) return showAlert('Thiếu thông tin', 'Biển số xe không được để trống.', 'warning');
      if (!selectedCatId) return showAlert('Thiếu thông tin', 'Chọn loại xe giùm cái.', 'warning');

      setSaving(true);
      const token = await AsyncStorage.getItem('access_token');
      if (!token) throw new Error('Thiếu accessToken');

      await updateDevice(
        token,
        dev?._id || dev?.id || dev?.imei,
        { vehicle_category_id: selectedCatId, phone_number, driver, license_plate },
        { debug: false }
      );

      showAlert('Thành công', 'Cập nhật thông tin xe thành công!', 'success', [
        { text: 'Xong', onPress: goBack },
      ]);
    } catch (e) {
      let msg = e?.message || 'Cập nhật thất bại';
      try { const j = JSON.parse(msg); msg = j?.message || msg; } catch {}
      showAlert('Lỗi', msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDevice = () => {
    showAlert(
      'Thông báo',
      'Tất cả thông tin về thiết bị này sẽ bị xoá khỏi điện thoại, bạn có chắc chắn muốn thực hiện thao tác này?',
      'warning',
      [
        { text: 'Đóng' },
        {
          text: 'Đồng ý',
          primary: true,
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('access_token');
              if (!token) throw new Error('Thiếu accessToken');
              await deleteDevice(token, dev?._id || dev?.id || dev?.imei);
              showAlert('Thành công', 'Thiết bị đã được xoá thành công!', 'success', [
                { text: 'Xong', onPress: () => navigateToScreen('Device') },
              ]);
            } catch (e) {
              let msg = e?.message || 'Xoá thất bại';
              try { const j = JSON.parse(msg); msg = j?.message || msg; } catch {}
              showAlert('Lỗi', msg, 'error');
            }
          }
        }
      ]
    );
  };

  // ======= Modern alert (re-usable) =======
  const [alertState, setAlertState] = useState({
    visible: false, title: '', message: '', type: 'info', actions: [],
  });

  const showAlert = (title, message, type = 'info', actions = [{ text: 'OK' }]) => {
    setAlertState({ visible: true, title, message, type, actions });
  };

  const closeAlert = () => setAlertState(s => ({ ...s, visible: false }));

  // ===================== UI =====================
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Thông tin xe: {dev?.license_plate || dev?.imei || '—'}
        </Text>

        <TouchableOpacity style={styles.headerBtn} onPress={handleNotificationPress}>
          <View style={styles.notificationContainer}>
            <Icon name="notifications" size={22} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Body */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>

          {/* License plate */}
          <Text style={styles.label}>Biển số xe</Text>
          <View style={styles.inputRow}>
            <View style={styles.leftIconBox}><Icon name="confirmation-number" size={18} color={PRIMARY} /></View>
            <TextInput
              style={styles.input}
              value={deviceInfo.vehicleNumber}
              onChangeText={(v) => handleInputChange('vehicleNumber', v)}
              placeholder="VD: 51A-123.45"
              placeholderTextColor="#9aa4b2"
              autoCapitalize="characters"
            />
          </View>

          {/* Driver name */}
          <Text style={styles.label}>Tên lái xe</Text>
          <View style={styles.inputRow}>
            <View style={styles.leftIconBox}><Icon name="person" size={18} color={PRIMARY} /></View>
            <TextInput
              style={styles.input}
              value={deviceInfo.driverName}
              onChangeText={(v) => handleInputChange('driverName', v)}
              placeholder="VD: Nguyễn Văn A"
              placeholderTextColor="#9aa4b2"
            />
          </View>

          {/* Vehicle type (dropdown overlay) */}
          <Text style={styles.label}>Loại xe</Text>
          <View ref={anchorRef} collapsable={false}>
            <TouchableOpacity
              style={styles.inputRow}
              activeOpacity={0.85}
              onPress={() => {
                if (catLoading) return;
                measureAnchor();
                setOpenCat(true);
              }}
            >
              <View style={styles.leftIconBox}><Icon name="directions-car" size={18} color={PRIMARY} /></View>
              <Text style={[styles.input, { paddingVertical: 14, color: catLoading ? '#9aa4b2' : TEXT }]}>
                {catLoading ? 'Đang tải…' : (catMap[selectedCatId] || 'Chưa xác định')}
              </Text>
              <Icon name={openCat ? 'expand-less' : 'expand-more'} size={22} color="#98a2b3" />
            </TouchableOpacity>
          </View>
          {!!catErr && <Text style={{ color: '#d32f2f', marginTop: 6 }}>{catErr}</Text>}

          {/* Device phone */}
          <Text style={styles.label}>SĐT thiết bị</Text>
          <View style={styles.inputRow}>
            <View style={styles.leftIconBox}><Icon name="phone-android" size={18} color={PRIMARY} /></View>
            <TextInput
              style={styles.input}
              value={deviceInfo.devicePhone}
              onChangeText={(v) => handleInputChange('devicePhone', v)}
              placeholder="VD: 0901234567"
              keyboardType="phone-pad"
              placeholderTextColor="#9aa4b2"
            />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.primaryBtn, saving && { opacity: 0.7 }]}
            onPress={handleAgreePress}
            disabled={saving}
            activeOpacity={0.9}
          >
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.primaryBtnText}>Đồng ý</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.ghostBtn} onPress={goBack} disabled={saving} activeOpacity={0.9}>
            <Text style={styles.ghostBtnText}>Đóng</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteDevice} disabled={saving} activeOpacity={0.9}>
            <Text style={styles.dangerBtnText}>Xoá thiết bị</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: Platform.OS === 'ios' ? 20 : 12 }} />
      </ScrollView>

      {/* Vehicle type overlay menu */}
      <Modal transparent visible={openCat} animationType="fade" onRequestClose={() => setOpenCat(false)}>
        <TouchableWithoutFeedback onPress={() => setOpenCat(false)}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={[styles.dropdownOverlay, { top: menuPos.top, left: menuPos.left, width: menuPos.width }]}>
          {catLoading ? (
            <View style={{ padding: 16, alignItems: 'center' }}>
              <ActivityIndicator />
            </View>
          ) : (
            <FlatList
              data={categories}
              keyExtractor={(it) => String(it._id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => handleVehicleTypeSelect(item._id)}
                >
                  <Text style={styles.optionText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      </Modal>

      {/* Custom Alert */}
      <Modal transparent visible={alertState.visible} animationType="fade" onRequestClose={closeAlert}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconWrap}>
              {alertState.type === 'success' && <Icon name="check-circle" size={52} color="#22c55e" />}
              {alertState.type === 'error'   && <Icon name="error-outline" size={52} color="#ef4444" />}
              {alertState.type === 'warning' && <Icon name="warning-amber" size={52} color="#f59e0b" />}
              {alertState.type === 'info'    && <Icon name="info" size={52} color={PRIMARY} />}
            </View>
            <Text style={styles.modalTitle}>{alertState.title}</Text>
            <Text style={styles.modalMsg}>{alertState.message}</Text>
            <View style={styles.modalActions}>
              {(alertState.actions || [{ text: 'OK' }]).map((a, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.modalBtn, a.primary && styles.modalBtnPrimary]}
                  onPress={() => { closeAlert(); a.onPress && a.onPress(); }}
                >
                  <Text style={[styles.modalBtnText, a.primary && styles.modalBtnPrimaryText]}>{a.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f9fc' },

  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { padding: 6, marginRight: 6 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },

  headerBtn: { padding: 6 },
  notificationContainer: { position: 'relative' },
  badge: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: '#ff4444', borderRadius: 10, minWidth: 18, height: 18,
    paddingHorizontal: 3, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },

  body: { padding: 16, paddingBottom: 20 },

  formCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: BORDER,
    padding: 14,
  },

  label: { fontSize: 12, color: MUTED, marginTop: 10, marginBottom: 6, fontWeight: '700' },

  inputRow: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: BORDER,
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },
  input: { flex: 1, fontSize: 15, color: TEXT, paddingVertical: 10 },

  actions: { marginTop: 16, gap: 10 },
  primaryBtn: {
    height: 48, borderRadius: 12, backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  ghostBtn: {
    height: 48, borderRadius: 12, backgroundColor: '#fff',
    borderWidth: 1.2, borderColor: BORDER, alignItems: 'center', justifyContent: 'center',
  },
  ghostBtnText: { color: TEXT, fontSize: 15, fontWeight: '700' },

  dangerBtn: {
    height: 48, borderRadius: 12, backgroundColor: '#fff',
    borderWidth: 1.2, borderColor: '#ef4444', alignItems: 'center', justifyContent: 'center',
  },
  dangerBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '800' },

  // dropdown overlay
  backdrop: { flex: 1, backgroundColor: 'transparent' },
  dropdownOverlay: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 6,
    maxHeight: 260,
    elevation: 12,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
  },
  optionItem: { paddingVertical: 14, paddingHorizontal: 12 },
  optionText: { fontSize: 16, color: TEXT },

  // alert modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '86%', backgroundColor: '#fff', borderRadius: 16, padding: 18, alignItems: 'center' },
  modalIconWrap: { marginBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: TEXT, marginBottom: 6, textAlign: 'center' },
  modalMsg: { fontSize: 15, color: '#475569', textAlign: 'center', marginBottom: 14 },
  modalActions: { flexDirection: 'row', alignSelf: 'flex-end', gap: 10 },
  modalBtn: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 10,
    backgroundColor: '#eef2f7',
  },
  modalBtnText: { color: TEXT, fontSize: 15, fontWeight: '700' },
  modalBtnPrimary: { backgroundColor: PRIMARY },
  modalBtnPrimaryText: { color: '#fff' },
});

export default DevicesInfo;
