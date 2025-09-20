// screens/Home/OrderDetail.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANG_KEY = 'app_language';

const STRINGS = {
  vi: {
    headerTitle: 'Chi tiết đơn hàng',
    createdAt: 'Ngày tạo',
    sectionOrderInfo: 'Chi tiết đơn hàng',
    orderCode: 'Mã đơn hàng',
    package: 'Gói dịch vụ',
    duration: 'Thời gian',
    months: 'Tháng',
    price: 'Giá tiền',
    status: 'Trạng thái',
    status_activated: 'Kích hoạt',
    status_pending: 'Chờ duyệt',
    status_cancelled: 'Đã hủy',
    status_unknown: 'Không rõ',
    close: 'Đóng',
  },
  en: {
    headerTitle: 'Order Detail',
    createdAt: 'Created at',
    sectionOrderInfo: 'Order Information',
    orderCode: 'Order Code',
    package: 'Package',
    duration: 'Duration',
    months: 'Months',
    price: 'Price',
    status: 'Status',
    status_activated: 'Activated',
    status_pending: 'Pending',
    status_cancelled: 'Cancelled',
    status_unknown: 'Unknown',
    close: 'Close',
  },
};

const formatVND = (n) =>
  Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' VNĐ';

const formatDateTime = (iso) => {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const dd = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const tt = d.toLocaleTimeString('vi-VN', { hour12: false });
    return `${dd} ${tt}`;
  } catch { return '—'; }
};

const statusText = (st, t) => {
  switch (Number(st)) {
    case 1:  return t('status_activated');
    case 3:  return t('status_pending');
    case 0:  return t('status_cancelled');
    default: return t('status_unknown');
  }
};

// chấm màu nhỏ, còn lại trung tính
const tinyDotColor = (st) => {
  switch (Number(st)) {
    case 1:  return '#16a34a'; // xanh nhưng rất nhỏ 
    case 3:  return '#d97706'; // cam nhỏ
    case 0:  return '#dc2626'; // đỏ nhỏ
    default: return '#6b7280'; // xám
  }
};

export default function OrderDetail({ order, navigateToScreen, device }) {
  const [language, setLanguage] = useState('vi');
  const t = (k) => (STRINGS[language]?.[k] ?? k);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (saved) setLanguage(saved);
      } catch {}
    })();
  }, []);

  // `order` là _raw từ HistoryExtend (code, name, time, price, status, created_at)
  const shaped = useMemo(() => {
    if (!order) return {};
    return {
      orderCode : order.code ?? '',
      pkgName   : order.name ?? '',
      duration  : order.time ? `${order.time} ${t('months')}` : '—',
      priceText : formatVND(order.price),
      createdAt : formatDateTime(order.created_at),
      status    : statusText(order.status, t),
      _status   : order.status,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, language]);

  const handleBackPress = () => navigateToScreen('historyExtend', { device });

  return (
    <View style={styles.container}>
      {/* Header GIỮ NGUYÊN */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('headerTitle')}</Text>
        <TouchableOpacity style={styles.notificationButton}>
          <Icon name="notifications" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Content mới: tối giản, hiện đại */}
      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Card tổng quan tinh gọn */}
        <View style={styles.card}>
          <View style={styles.summaryTop}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryTitle}>{t('sectionOrderInfo')}</Text>
              <Text style={styles.metaText}>
                {t('createdAt')}: <Text style={styles.metaStrong}>{shaped.createdAt || '—'}</Text>
              </Text>
            </View>

            <View style={styles.statusWrap}>
              <View style={[styles.dot, { backgroundColor: tinyDotColor(order?.status) }]} />
              <Text style={styles.statusText} numberOfLines={1}>
                {shaped.status || '—'}
              </Text>
            </View>
          </View>

          <View style={styles.amountBlock}>
            <Text style={styles.amountLabel}>{t('price')}</Text>
            <Text style={styles.amountValue}>{shaped.priceText || '—'}</Text>
          </View>
        </View>

        {/* Info list tối giản */}
        <View style={styles.card}>
          <InfoRow label={t('orderCode')} value={shaped.orderCode} mono />
          <Divider />
          <InfoRow label={t('package')} value={shaped.pkgName} />
          <Divider />
          <InfoRow label={t('duration')} value={shaped.duration} />
          <Divider />
          <InfoRow label={t('status')} value={shaped.status} withBadge badgeDotColor={tinyDotColor(order?.status)} />
        </View>

        {/* Nút đóng — trung tính */}
        <TouchableOpacity style={styles.closeBtn} onPress={handleBackPress} activeOpacity={0.8}>
          <Text style={styles.closeBtnText}>{t('close')}</Text>
        </TouchableOpacity>

        <View style={{ height: 16 }} />
      </ScrollView>
    </View>
  );
}

/* --- small presentational helpers (tối giản) --- */
const Divider = () => <View style={styles.divider} />;

const InfoRow = ({ label, value, mono, withBadge, badgeDotColor }) => {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      {withBadge ? (
        <View style={styles.badge}>
          <View style={[styles.badgeDot, { backgroundColor: badgeDotColor || '#6b7280' }]} />
          <Text style={styles.badgeText} numberOfLines={1}>{value || '—'}</Text>
        </View>
      ) : (
        <Text
          style={[styles.value, mono && styles.mono]}
          numberOfLines={1}
        >
          {value || '—'}
        </Text>
      )}
    </View>
  );
};

/* --- styles: palette xám – trắng, nhấn rất nhẹ --- */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f4f6f8' },

  // Header GIỮ NGUYÊN
  header: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 45,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { padding: 4, marginRight: 8 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '500', flex: 1 },
  notificationButton: { padding: 4 },

  // Content
  content: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 32 },

  // Card nền trắng, bóng nhẹ, bo mềm
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },

  // Summary block
  summaryTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  summaryLeft: { flex: 1, paddingRight: 8 },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  metaText: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  metaStrong: { color: '#374151', fontWeight: '600' },

  statusWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, color: '#111827', fontWeight: '600' },

  amountBlock: { marginTop: 12 },
  amountLabel: { fontSize: 12, color: '#6b7280' },
  amountValue: { fontSize: 22, color: '#111827', fontWeight: '800', marginTop: 4 },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  label: { fontSize: 14, color: '#374151', fontWeight: '600', marginRight: 12 },
  value: { fontSize: 14, color: '#111827', fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e5e7eb',
  },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 13, color: '#111827', fontWeight: '700' },

  divider: { height: 1, backgroundColor: '#f1f5f9' },

  // Close button: trung tính xám đậm
  closeBtn: {
    marginTop: 6,
    backgroundColor: '#111827',
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
