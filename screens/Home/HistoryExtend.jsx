// screens/Home/HistoryExtend.jsx
import React, { useEffect, useMemo, useState, useCallback, useContext } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, RefreshControl, BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExtendHistory } from '../../apis/devices';
import { NotificationContext } from '../../App'; // badge
import iconsLoading from '../../assets/img/ic_order_inprocessing.png';
import iconsDone from '../../assets/img/ic_order_approve.png';
import iconsCancel from '../../assets/img/ic_order_cancel.png';

const LANG_KEY = 'app_language';

const STRINGS = {
  vi: {
    headerPrefix: 'Lịch sử gia hạn',
    orderCode: 'Mã đơn hàng',
    package: 'Gói dịch vụ',
    createdAt: 'Ngày tạo',
    price: 'Giá tiền',
    duration: 'Thời hạn',
    months: 'Tháng',
    status: 'Trạng thái',
    s_active: 'Kích hoạt',
    s_pending: 'Chờ duyệt',
    s_canceled: 'Đã hủy',
    s_unknown: 'Không rõ',
    empty: 'Chưa có lịch sử gia hạn.',
    locale: 'vi-VN',
    hour12: false,
  },
  en: {
    headerPrefix: 'Extension history',
    orderCode: 'Order code',
    package: 'Package',
    createdAt: 'Created at',
    price: 'Price',
    duration: 'Duration',
    months: 'months',
    status: 'Status',
    s_active: 'Activated',
    s_pending: 'Pending',
    s_canceled: 'Canceled',
    s_unknown: 'Unknown',
    empty: 'No extension history yet.',
    locale: 'en-US',
    hour12: true,
  },
};

export default function HistoryExtend({ navigateToScreen, screenData, navigation }) {
  const device     = screenData?.device || {};
  const deviceId   = device?._id || device?.id || device?.imei || '';
  const plate      = device?.license_plate || device?.imei || '';
  const prefetched = screenData?.prefetched || null;

  const [lang, setLang] = useState('vi');
  const L = STRINGS[lang];

  // NotificationContext safe
  const notifCtx = useContext(NotificationContext) || {};
  const notifications = Array.isArray(notifCtx.notifications) ? notifCtx.notifications : [];
  const setNotifications = typeof notifCtx.setNotifications === 'function' ? notifCtx.setNotifications : () => {};
  const unreadCount = notifications.reduce((acc, n) => acc + (n?.isRead ? 0 : 1), 0);

  const handleNotificationPress = () => {
    setNotifications(prev => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.map(n => ({ ...(n && typeof n === 'object' ? n : {}), isRead: true }));
    });
    navigateToScreen('notification', { from: 'historyExtend', device });
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (saved) setLang(saved);
      } catch {}
    })();
  }, []);

  const headerTitle = useMemo(
    () => `${L.headerPrefix} ${plate || deviceId || ''}`,
    [plate, deviceId, L.headerPrefix]
  );

  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);

  const formatMoney = useCallback(
    (n) => `${Number(n || 0).toLocaleString(L.locale, { maximumFractionDigits: 0 })} VND`,
    [L.locale]
  );

  const formatDateTime = useCallback((iso) => {
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '—';
      const dd = d.toLocaleDateString(L.locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
      const tt = d.toLocaleTimeString(L.locale, { hour12: L.hour12 });
      return `${dd} ${tt}`;
    } catch { return '—'; }
  }, [L.locale, L.hour12]);

  const statusMeta = useCallback((st) => {
    switch (Number(st)) {
      case 1:  return { text: L.s_active,   icon: iconsDone,    style: styles.statusActive };
      case 3:  return { text: L.s_pending,  icon: iconsLoading, style: styles.statusPending };
      case 0:  return { text: L.s_canceled, icon: iconsCancel,  style: styles.statusCanceled };
      default: return { text: L.s_unknown,  icon: iconsLoading, style: styles.statusPending };
    }
  }, [L.s_active, L.s_pending, L.s_canceled, L.s_unknown]);

  const shapeItemLocal = useCallback((r, i = 0) => {
    const st = statusMeta(r.status);
    return {
      id: i + 1,
      orderCode: r.code,
      package: r.name,
      createDate: formatDateTime(r.created_at),
      price: formatMoney(r.price),
      duration: `${r.time} ${L.months}`,
      statusText: st.text,
      statusStyle: st.style,
      statusIcon: st.icon,
      _raw: r,
    };
  }, [statusMeta, formatDateTime, formatMoney, L.months]);

  const load = useCallback(async (initial = false) => {
    if (!deviceId) return;
    try {
      if (!initial) setRefreshing(true);
      const token = await AsyncStorage.getItem('access_token');
      const raw = await getExtendHistory({ accessToken: token, deviceId });
      const sorted = (raw || []).slice().sort(
        (a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0)
      );
      setItems(sorted.map(shapeItemLocal));
    } catch {
      setItems([]);
    } finally {
      if (!initial) setRefreshing(false);
      setHasFetched(true);
    }
  }, [deviceId, shapeItemLocal]);

  useEffect(() => {
    if (prefetched && Array.isArray(prefetched)) {
      const sorted = prefetched.slice().sort(
        (a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0)
      );
      setItems(sorted.map(shapeItemLocal));
      setHasFetched(true);
    }
  }, [prefetched, shapeItemLocal]);

  useEffect(() => { load(true); }, [load]);

  // ===== BACK HANDLERS =====
  const goDevice = useCallback(() => {
    navigateToScreen && navigateToScreen('Device');
  }, [navigateToScreen]);

  const handleBackPress = useCallback(() => {
    // về Device, không đóng app
    goDevice();
    return true; // chặn default
  }, [goDevice]);

  // Android hardware back
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => sub.remove();
  }, [handleBackPress]);

  // iOS back gesture (react-navigation)
  useEffect(() => {
    if (!navigation || typeof navigation.addListener !== 'function') return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault(); // chặn pop mặc định
      goDevice();         // tự điều hướng
    });
    return unsub;
  }, [navigation, goDevice]);

  const handleHeaderBack = () => goDevice();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleHeaderBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{headerTitle}</Text>

        <TouchableOpacity style={styles.headerBtn} onPress={handleNotificationPress}>
          <View style={styles.notificationContainer}>
            <Icon name="notifications" size={24} color="white" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(false)} />}
      >
        {items.map(item => (
          <TouchableOpacity
            key={item.id}
            style={styles.historyCard}
            onPress={() => navigateToScreen('orderDetail', { order: item._raw, device })}
            activeOpacity={0.8}
          >
            <View style={styles.iconContainer}>
              <Image source={item.statusIcon} style={styles.statusIcon} />
            </View>
            <View style={styles.historyInfo}>
              <Text style={styles.orderCode}>{L.orderCode}: {item.orderCode}</Text>
              <Text style={styles.packageName}>{L.package}: {item.package}</Text>
              <Text style={styles.infoText}>{L.createdAt}: <Text style={styles.italicText}>{item.createDate}</Text></Text>
              <Text style={styles.infoText}>{L.price}: <Text style={styles.italicText}>{item.price}</Text></Text>
              <Text style={styles.infoText}>{L.duration}: <Text style={styles.italicText}>{item.duration}</Text></Text>
              <Text style={styles.infoText}>
                {L.status}: <Text style={[styles.italicText, item.statusStyle]}>{item.statusText}</Text>
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        {hasFetched && !items.length && (
          <Text style={{ textAlign: 'center', color: '#666', marginTop: 24 }}>
            {L.empty}
          </Text>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20, paddingVertical: 15, paddingTop: 25,
    flexDirection: 'row', alignItems: 'center',
  },
  backButton: { padding: 4, marginRight: 8 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '500', flex: 1 },

  // 🔔 badge
  headerBtn: { padding: 4 },
  notificationContainer: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },

  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },

  historyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    borderWidth: 2,
    borderColor: '#4A90E2',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 3,
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },  
  iconContainer: { marginRight: 15, alignItems: 'center', justifyContent: 'center' },
  statusIcon: { width: 35, height: 35, resizeMode: 'contain' },

  historyInfo: { flex: 1 },
  orderCode: { fontSize: 15, fontWeight: '600', color: '#333', marginBottom: 5 },
  packageName: { fontSize: 13, fontWeight: '500', color: '#333', marginBottom: 3 },
  infoText: { fontSize: 13, color: '#333', marginBottom: 2, lineHeight: 18 },
  italicText: { fontStyle: 'italic', fontWeight: 'normal' },

  statusPending: { color: '#E65100' },
  statusActive:  { color: '#2E7D32' },
  statusCanceled:{ color: '#C62828' },
});
