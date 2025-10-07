// screens/Home/HistoryExtend.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, Platform, Modal, Pressable, BackHandler, PanResponder,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrders } from '../../apis/devices';
import SearchBar from '../../components/SearchBar';
import PaginationControls from '../../components/PaginationControls';
import EVChargingLoader from '../../components/EVChargingLoader';

/* ================= helpers ================= */
async function getAccessTokenSafe() {
  const keys = ['access_token', 'accessToken', 'ACCESS_TOKEN', 'token', 'auth_token'];
  for (const k of keys) {
    const v = await AsyncStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

const STATUS_COLOR = {
  pending: '#f59e0b',
  paid: '#2563eb',
  completed: '#16a34a',
  canceled: '#ef4444',
  failed: '#ef4444',
  default: '#6b7280',
};

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

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ';
}

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch { return '—'; }
}

/* ===================== Dropdown ===================== */
function Dropdown({ label, value, options, onChange, minWidth = 160 }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View>
      <TouchableOpacity
        style={[styles.dropdownBtn, { minWidth }]}
        onPress={() => setOpen(true)}
      >
        <Text style={styles.dropdownText}>
          {label}: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{selected?.label}</Text>
        </Text>
        <Icon name="expand-more" size={20} color="#0ea5e9" style={StyleSheet.flatten([styles.iconFix])} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.modalSheet}>
            {options.map((opt, idx) => {
              const active = opt.value === value;
              return (
                <TouchableOpacity
                  key={`${String(opt.value)}-${idx}`}
                  style={[styles.optionRow, active && { backgroundColor: '#e0f2fe' }]}
                  onPress={() => { onChange(opt.value); setOpen(false); }}
                >
                  <Text style={[styles.optionText, active && { color: '#0369a1', fontWeight: '800' }]}>{opt.label}</Text>
                  {active && <Icon name="check" size={18} color="#0369a1" style={StyleSheet.flatten([styles.iconFix])} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ===================== Screen ===================== */
export default function HistoryExtend({ navigateToScreen }) {
  const goBack = useCallback(() => {
    if (navigateToScreen) navigateToScreen('Device');
    return true;
  }, [navigateToScreen]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
  }, [goBack]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (e) => e.nativeEvent.pageX <= 24,
    onMoveShouldSetPanResponder: (e, g) => e.nativeEvent.pageX <= 24 && Math.abs(g.dx) > 8,
    onPanResponderRelease: (e, g) => { if (g.dx > 60 && Math.abs(g.dy) < 40) goBack(); },
  }), [goBack]);

  const [items, setItems] = useState([]);
  const [loadingHard, setLoadingHard] = useState(true);

  const fetchBackendPage = useCallback(async () => {
    try {
      setLoadingHard(true);
      const token = await getAccessTokenSafe();
      if (!token) throw new Error('No token');
      const res = await getOrders(token, { page: 1, limit: 10 });
      const data = Array.isArray(res?.data) ? res.data : [];
      setItems(data);
    } catch (e) {
      setItems([]);
    } finally {
      setLoadingHard(false);
    }
  }, []);

  useEffect(() => { fetchBackendPage(); }, [fetchBackendPage]);

  const renderItem = ({ item }) => {
    const dev = item?.device_id || {};
    const agent = item?.agent_id || {};
    const plan = item?.plan_snapshot || {};
    const st = String(item?.status || '').toLowerCase();
    const color = STATUS_COLOR[st] || STATUS_COLOR.default;

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85}
        onPress={() => navigateToScreen && navigateToScreen('orderDetail', { order: item })}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{dev?.name || 'Thiết bị'}</Text>
            <Text style={styles.sub}>Mã đơn: <Text style={styles.bold}>{item?.orderId || '—'}</Text> · Cổng <Text style={styles.bold}>{item?.portNumber ?? '—'}</Text></Text>
          </View>

          <View style={[styles.statusPill, { backgroundColor: `${color}1A`, borderColor: color }]}>
            <Icon name="receipt-long" size={14} color={color} style={StyleSheet.flatten([styles.pillIcon])} />
            <Text style={[styles.statusText, { color }]}>{viStatus(st)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Icon name="store" size={18} color="#64748b" style={StyleSheet.flatten([styles.iconFix])} />
          <Text style={styles.k}>Đại lý</Text>
          <Text style={styles.v}>{agent?.name || '—'}</Text>
        </View>

        <View style={styles.row}>
          <Icon name="category" size={18} color="#64748b" style={StyleSheet.flatten([styles.iconFix])} />
          <Text style={styles.k}>Gói</Text>
          <Text style={styles.v}>{plan?.name || '—'}</Text>
        </View>

        <View style={styles.row}>
          <Icon name="schedule" size={18} color="#64748b" style={StyleSheet.flatten([styles.iconFix])} />
          <Text style={styles.k}>Thời lượng</Text>
          <Text style={styles.v}>{plan?.duration_minutes ? `${plan.duration_minutes} phút` : '—'}</Text>
        </View>

        <View style={styles.row}>
          <Icon name="payments" size={18} color="#64748b" style={StyleSheet.flatten([styles.iconFix])} />
          <Text style={styles.k}>Số tiền</Text>
          <Text style={styles.v}>{fmtMoney(item?.amount)}</Text>
        </View>

        <View style={styles.row}>
          <Icon
            name="payments"
            size={18}
            color="#64748b"
            style={
              Platform.OS === 'web'
                ? StyleSheet.flatten([styles.iconFix, { transform: [{ translateY: 2 }] }])
                : styles.iconFix
            }
          />
          <Text style={styles.k}>Phương thức</Text>
          <Text style={styles.v}>{String(item?.payment_method || '').toUpperCase() || '—'}</Text>
        </View>

        <View style={styles.row}>
          <Icon name="event" size={18} color="#64748b" style={StyleSheet.flatten([styles.iconFix])} />
          <Text style={styles.k}>Ngày tạo</Text>
          <Text style={styles.v}>{fmtDate(item?.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
         <Text style={{fontSize: 30, color: '#fff'}}>{'‹'}</Text>

        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lịch sử đơn hàng</Text>
        <View style={{ width: 24 }} />
      </View>

      {loadingHard ? (
        <View style={styles.center}><EVChargingLoader message="Đang tải dữ liệu đơn hàng…" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it) => String(it?._id || it?.orderId || Math.random())}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={fetchBackendPage} />}
          ListEmptyComponent={<View style={styles.emptyWrap}><Icon name="hourglass-empty" size={28} color="#94a3b8" style={StyleSheet.flatten([styles.iconFix])} /><Text style={styles.emptyText}>Không có đơn hàng phù hợp</Text></View>}
        />
      )}
    </SafeAreaView>
  );
}

/* ================= styles ================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  header: { backgroundColor: '#4A90E2', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 16 : 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' },
  backButton: { padding: 12, marginRight: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  sub: { marginTop: 2, fontSize: 12, lineHeight: 14, color: '#6b7280' },
  bold: { fontWeight: '800', color: '#111827' },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, marginLeft: 8 },
  statusText: { fontSize: 12, lineHeight: 14, fontWeight: '700', marginLeft: 4 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
    minHeight: 32,
  },
  k: { flex: 1, fontSize: 13, lineHeight: 16, color: '#6b7280' },
  v: { fontSize: 13, lineHeight: 16, fontWeight: '700', color: '#111827' },

  iconFix: {
    marginRight: 6,
    alignSelf: 'center',
    ...(Platform.OS === 'web' ? { transform: [{ translateY: 1 }] } : null),
  },
  pillIcon: {
    alignSelf: 'center',
    ...(Platform.OS === 'web' ? { transform: [{ translateY: 1 }] } : null),
  },

  emptyWrap: { padding: 24, alignItems: 'center' },
  emptyText: { marginTop: 8, color: '#94a3b8', fontWeight: '600' },

  dropdownBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'space-between' },
  dropdownText: { color: '#0369a1', fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' },
  optionRow: { paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  optionText: { color: '#0f172a', fontSize: 14 },
});
