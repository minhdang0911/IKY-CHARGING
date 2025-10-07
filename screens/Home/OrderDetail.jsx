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
const ICON_W = 24; // hộp cố định cho icon

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
      setTimeout(() => { navigatingRef.current = false; }, 300);
    }
  };

  // ANDROID: back cứng
  useEffect(() => {
    const onHWBack = () => {
      goBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHWBack);
    return () => sub.remove();
  }, []);

  // iOS: edge-swipe back
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e, g) => Platform.OS === 'ios' && g.x0 <= 20,
      onMoveShouldSetPanResponder: (e, g) =>
        Platform.OS === 'ios' && g.dx > 10 && Math.abs(g.dy) < 20,
      onPanResponderMove: () => {},
      onPanResponderRelease: (e, g) => {
        if (Platform.OS === 'ios' && g.dx > 60) goBack();
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
          <Text style={styles.backIcon}>{'‹'}</Text>
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

          <InfoRow icon="payments" label={t('method')} value={String(order?.payment_method).toUpperCase()} />
          <Divider />

          <InfoRow icon="power" label={t('port')} value={String(order?.portNumber)} />
          <Divider />

          <InfoRow icon="event" label={t('createdAt')} value={fmtDate(order?.createdAt)} />
          <Divider />

          <InfoRow icon="payments" label={t('paidAt')} value={fmtDate(order?.paidAt)} />
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
          <InfoRow icon="bolt" label="Nhiệt độ" value={`${order?.device_id?.temperature || 0} °C`} />
          <Divider />
          <InfoRow icon="bolt" label="Firmware" value={order?.device_id?.fw_version} />
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
                  {!!h.note && <Text style={styles.historyNote}>{h.note}</Text>}
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

/* ================== Components ================== */
const SectionHeader = ({ icon, title }) => (
  <View style={styles.sectionHeader}>
    <View style={styles.iconBox}>
      <Icon name={icon} size={18} color="#2563eb" />
    </View>
    <Text style={styles.sectionTitle}>{title}</Text>
  </View>
);

const InfoRow = ({ icon, label, value }) => (
  <View style={styles.row}>
    <View style={styles.rowLeft}>
      <View style={styles.iconBox}>
        <Icon name={icon} size={18} color="#64748b" />
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>

    <View style={styles.valueBox}>
      <Text style={styles.value} numberOfLines={2}>
        {value || '—'}
      </Text>
    </View>
  </View>
);

const StatusRow = ({ label, value, color }) => (
  <View style={styles.row}>
    <View style={styles.rowLeft}>
      <View style={styles.iconBox}>
        <Icon name="info" size={18} color={color} />
      </View>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>

    <View style={[styles.statusBadge, { borderColor: color }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  </View>
);

const Divider = () => <View style={styles.divider} />;

/* ================== Styles ================== */
const BASE_TEXT = {
  includeFontPadding: false,           // Android: bỏ padding font
  textAlignVertical: 'center',         // Android
  // lineHeight đặt ~ fontSize để baseline đều giữa các platform
};

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
  backIcon: { ...BASE_TEXT, fontSize: 30, color: '#fff', lineHeight: 32 },
  headerTitle: { ...BASE_TEXT, flex: 1, color: '#fff', fontSize: 18, fontWeight: '700', lineHeight: 22 },

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
  iconBox: {
    width: ICON_W,
    height: 20,
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { ...BASE_TEXT, fontSize: 15, fontWeight: '800', color: '#111827', lineHeight: 18 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    minHeight: 32,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, flexGrow: 1 },

  label: { ...BASE_TEXT, fontSize: 14, color: '#374151', fontWeight: '600', lineHeight: 18, flexShrink: 1 },

  // box bên phải để text không đẩy lệch layout
  valueBox: {
    flexShrink: 1,
    maxWidth: '60%',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 8,
  },
  value: {
    ...BASE_TEXT,
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
    textAlign: 'right',
    lineHeight: 18,
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
    marginLeft: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 6 },
  statusText: { ...BASE_TEXT, fontSize: 13, fontWeight: '700', lineHeight: 16 },

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
  historyStatus: { ...BASE_TEXT, fontSize: 14, fontWeight: '700', color: '#111827', lineHeight: 18 },
  historyNote: { ...BASE_TEXT, fontSize: 13, color: '#475569', marginTop: 2, lineHeight: 16 },
  historyTime: { ...BASE_TEXT, fontSize: 12, color: '#94a3b8', marginTop: 2, lineHeight: 14 },

  closeBtn: {
    backgroundColor: '#2563eb',
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  closeBtnText: { ...BASE_TEXT, color: '#fff', fontWeight: '700', fontSize: 15, lineHeight: 18 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
