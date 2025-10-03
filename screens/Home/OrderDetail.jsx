import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  BackHandler,
  Platform,
  PanResponder,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANG_KEY = 'app_language';

// ========= i18n =========
const STRINGS = {
  vi: {
    headerTitle: 'Chi tiết đơn hàng',
    sectionOrder: 'Tổng quan đơn hàng',
    sectionAgent: 'Thông tin đại lý',
    sectionDevice: 'Thông tin thiết bị',
    sectionHistory: 'Lịch sử trạng thái',
    orderId: 'Mã đơn hàng',
    status: 'Trạng thái',
    amount: 'Số tiền',
    paidAt: 'Thanh toán lúc',
    createdAt: 'Ngày tạo',
    method: 'Phương thức thanh toán',
    port: 'Cổng sạc',
    close: 'Đóng',
  },
  en: {
    headerTitle: 'Order Detail',
    sectionOrder: 'Order Overview',
    sectionAgent: 'Agent Information',
    sectionDevice: 'Device Information',
    sectionHistory: 'Order History',
    orderId: 'Order ID',
    status: 'Status',
    amount: 'Amount',
    paidAt: 'Paid At',
    createdAt: 'Created At',
    method: 'Payment Method',
    port: 'Port',
    close: 'Close',
  },
};

// format tiền tệ
const fmtMoney = (n) =>
  Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ';

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch {
    return '—';
  }
};

// màu trạng thái
const STATUS_COLOR = {
  pending: '#f59e0b',
  paid: '#2563eb',
  completed: '#16a34a',
  canceled: '#ef4444',
  failed: '#ef4444',
  default: '#6b7280',
};

// dịch trạng thái
function viStatus(s) {
  const x = String(s || '').toLowerCase();
  switch (x) {
    case 'pending': return 'Đang xử lý';
    case 'paid': return 'Hoàn thành';
    case 'completed': return 'Hoàn tất';
    case 'canceled': return 'Đã hủy';
    case 'failed': return 'Thất bại';
    default: return 'Không rõ';
  }
}

export default function OrderDetail({ order, navigateToScreen }) {
  const [lang, setLang] = useState('vi');
  const navigatingRef = useRef(false);

  const t = (k) => STRINGS[lang]?.[k] || k;

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (saved) setLang(saved);
      } catch {}
    })();
  }, []);

  const goBack = () => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    try {
      navigateToScreen?.('historyExtend');
    } finally {
      // nhỏ delay để tránh double-trigger khi vừa gesture vừa nút
      setTimeout(() => { navigatingRef.current = false; }, 300);
    }
  };

  // ANDROID: back cứng → chỉ back trang, không thoát app
  useEffect(() => {
    const onHWBack = () => {
      goBack();
      return true; // chặn default (không đóng app)
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHWBack);
    return () => sub.remove();
  }, []);

  // iOS: edge-swipe (tự chế nhẹ) để back nếu m không dùng React Navigation gesture
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e, g) => {
        // chỉ bắt gesture khi bắt đầu từ mép trái
        return Platform.OS === 'ios' && g.x0 <= 20;
      },
      onMoveShouldSetPanResponder: (e, g) => {
        // kéo ngang phải đủ
        return Platform.OS === 'ios' && g.dx > 10 && Math.abs(g.dy) < 20;
      },
      onPanResponderMove: () => {},
      onPanResponderRelease: (e, g) => {
        // nếu kéo sang phải đủ xa thì back
        if (Platform.OS === 'ios' && g.dx > 60) {
          goBack();
        }
      },
    })
  ).current;

  if (!order) {
    return (
      <View style={styles.center}>
        <Text>Không có dữ liệu đơn hàng</Text>
      </View>
    );
  }

  const color = STATUS_COLOR[order?.status] || STATUS_COLOR.default;

  return (
    <View style={styles.container} {...(Platform.OS === 'ios' ? panResponder.panHandlers : {})}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('headerTitle')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Tổng quan đơn hàng */}
        <View style={styles.card}>
          <SectionHeader icon="receipt" title={t('sectionOrder')} />
          <InfoRow icon="confirmation-number" label={t('orderId')} value={order?.orderId} />
          <Divider />

          <StatusRow label={t('status')} value={viStatus(order?.status)} color={color} />
          <Divider />

          <InfoRow icon="payments" label={t('amount')} value={fmtMoney(order?.amount)} />
          <Divider />

          <InfoRow icon="account-balance-wallet" label={t('method')} value={String(order?.payment_method).toUpperCase()} />
          <Divider />

          <InfoRow icon="power" label={t('port')} value={String(order?.portNumber)} />
          <Divider />

          <InfoRow icon="event" label={t('createdAt')} value={fmtDate(order?.createdAt)} />
          <Divider />

          <InfoRow icon="check-circle" label={t('paidAt')} value={fmtDate(order?.paidAt)} />
        </View>

        {/* Đại lý */}
        <View style={styles.card}>
          <SectionHeader icon="store" title={t('sectionAgent')} />
          <InfoRow icon="person" label="Tên đại lý" value={order?.agent_id?.name} />
          <Divider />
          <InfoRow icon="place" label="Địa chỉ" value={order?.agent_id?.address} />
          <Divider />
          <InfoRow icon="phone" label="Điện thoại" value={order?.agent_id?.phone} />
          <Divider />
          <InfoRow icon="email" label="Email" value={order?.agent_id?.email} />
        </View>

        {/* Thiết bị */}
        <View style={styles.card}>
          <SectionHeader icon="devices" title={t('sectionDevice')} />
          <InfoRow icon="memory" label="Tên thiết bị" value={order?.device_id?.name} />
          <Divider />
          {/* <InfoRow icon="qr-code" label="Mã thiết bị" value={order?.device_id?.device_code} /> */}
          <Divider />
          <InfoRow icon="bolt" label="Điện áp" value={`${order?.device_id?.voltage || 0} V`} />
          <Divider />
          <InfoRow icon="device-thermostat" label="Nhiệt độ" value={`${order?.device_id?.temperature || 0} °C`} />
          <Divider />
          <InfoRow icon="system-update" label="Firmware" value={order?.device_id?.fw_version} />
        </View>

        {/* Lịch sử trạng thái */}
        <View style={styles.card}>
          <SectionHeader icon="history" title={t('sectionHistory')} />
          {(order?.history || []).map((h, idx) => {
            const hColor = STATUS_COLOR[h.status] || STATUS_COLOR.default;
            return (
              <View key={idx} style={styles.historyRow}>
                <View style={[styles.historyDot, { backgroundColor: hColor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyStatus}>{viStatus(h.status)}</Text>
                  <Text style={styles.historyNote}>{h.note}</Text>
                  <Text style={styles.historyTime}>{fmtDate(h.timestamp)}</Text>
                </View>
              </View>
            );
          })}
        </View>

        {/* Nút đóng */}
        <TouchableOpacity style={styles.closeBtn} onPress={goBack} activeOpacity={0.85}>
          <Text style={styles.closeBtnText}>{t('close')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

// ========== Component phụ ==========
const SectionHeader = ({ icon, title }) => (
  <View style={styles.sectionHeader}>
    <Icon name={icon} size={18} color="#2563eb" style={{ marginRight: 8 }} />
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.row}>
    <View style={styles.rowLeft}>
      <Icon name={icon} size={18} color="#64748b" style={{ marginRight: 6 }} />
      <Text style={styles.label}>{label}</Text>
    </View>
    <Text style={styles.value} numberOfLines={2}>
      {value || '—'}
    </Text>
  </View>
);

const StatusRow = ({ label, value, color }) => (
  <View style={styles.row}>
    <View style={styles.rowLeft}>
      <Icon name="info" size={18} color={color} style={{ marginRight: 6 }} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
    <View style={[styles.statusBadge, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]}>{value}</Text>
    </View>
  </View>
);

const Divider = () => <View style={styles.divider} />;

// ========== Styles ==========
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },

  header: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingTop: 25,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { padding: 6, marginRight: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },

  content: { flex: 1, padding: 16 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },

  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },

  label: { fontSize: 14, color: '#374151', fontWeight: '600' },
  value: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    maxWidth: '55%',
    textAlign: 'right',
  },

  divider: { height: 1, backgroundColor: '#f1f5f9', marginVertical: 4 },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: '#f8fafc',
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { fontSize: 13, fontWeight: '700' },

  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  historyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
    marginRight: 10,
  },
  historyStatus: { fontSize: 14, fontWeight: '700', color: '#111827' },
  historyNote: { fontSize: 13, color: '#475569', marginTop: 2 },
  historyTime: { fontSize: 12, color: '#94a3b8', marginTop: 2 },

  closeBtn: {
    backgroundColor: '#2563eb',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
