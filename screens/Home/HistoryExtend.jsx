// screens/Home/HistoryExtend.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, Platform, BackHandler, PanResponder,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrders } from '../../apis/devices';
import SearchBar from '../../components/SearchBar';
import PaginationControls from '../../components/PaginationControls';
import EVChargingLoader from '../../components/EVChargingLoader';

/* ====== constants / helpers ====== */
const TAB_BAR_HEIGHT = 72; // chiều cao bottom tab ở App.js
const BOTTOM_PAD = Platform.OS === 'web' ? TAB_BAR_HEIGHT + 36 : TAB_BAR_HEIGHT + 16;
const API_LIMIT = 10;

async function getAccessTokenSafe() {
  const keys = ['access_token', 'accessToken', 'ACCESS_TOKEN', 'token', 'auth_token'];
  for (const k of keys) {
    // eslint-disable-next-line no-await-in-loop
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

/* ===================== Screen ===================== */
export default function HistoryExtend({ navigateToScreen }) {
  // back handlers
  const goBack = useCallback(() => {
    if (navigateToScreen) navigateToScreen('Device');
    return true;
  }, [navigateToScreen]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
  }, [goBack]);

  // Chặn back web về root để xử lý trong app
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const TARGET_PATH = '/';
    window.history.replaceState(null, '', TARGET_PATH);

    const handlePopState = () => {
      window.history.replaceState(null, '', TARGET_PATH);
      goBack();
    };
    window.history.pushState(null, '', TARGET_PATH);
    window.addEventListener('popstate', handlePopState);
    return () => { window.removeEventListener('popstate', handlePopState); };
  }, [goBack]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (e) => e.nativeEvent.pageX <= 24,
    onMoveShouldSetPanResponder: (e, g) => e.nativeEvent.pageX <= 24 && Math.abs(g.dx) > 8,
    onPanResponderRelease: (e, g) => { if (g.dx > 60 && Math.abs(g.dy) < 40) goBack(); },
  }), [goBack]);

  // state
  const [items, setItems] = useState([]);
  const [loadingHard, setLoadingHard] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // search + paginate (backend only)
  const [q, setQ] = useState('');
  const qRef = useRef(q);
  useEffect(() => { qRef.current = q; }, [q]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // fetch 1 trang từ backend
  const fetchPage = useCallback(async (p, { showSpinner = false } = {}) => {
    if (showSpinner) setLoadingHard(true);
    try {
      const token = await getAccessTokenSafe();
      if (!token) throw new Error('No token');

      const params = { page: p, limit: API_LIMIT };
      const search = qRef.current.trim();
      if (search) params.search = search;

      const res = await getOrders(token, params);
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setItems(list);
      setPage(p);

      // tính total pages nếu backend trả
      const lim = Number(res?.limit ?? res?.per_page ?? API_LIMIT) || API_LIMIT;
      const totalItems = Number(res?.total ?? 0);
      const tp = res?.totalPages ?? res?.total_pages
        ?? (totalItems ? Math.ceil(totalItems / lim) : (list.length < lim ? p : p + 1));
      setTotalPages(Math.max(1, Number(tp)));
    } catch (e) {
      setItems([]);
      setTotalPages(1);
    } finally {
      if (showSpinner) setLoadingHard(false);
    }
  }, []);

  useEffect(() => { fetchPage(1, { showSpinner: true }); }, [fetchPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await fetchPage(page, { showSpinner: false }); } finally { setRefreshing(false); }
  }, [fetchPage, page]);

  // prev/next
  const handlePrev = useCallback(() => {
    const next = Math.max(1, page - 1);
    if (next !== page) fetchPage(next, { showSpinner: true });
  }, [page, fetchPage]);

  const handleNext = useCallback(() => {
    const next = Math.min(totalPages, page + 1);
    if (next !== page) fetchPage(next, { showSpinner: true });
  }, [page, totalPages, fetchPage]);

  // ✅ go to page
  const handleGoTo = useCallback((targetPage) => {
    const tp = Number(totalPages) || 1;
    const safe = Math.max(1, Math.min(tp, Number(targetPage) || 1));
    if (safe !== page) fetchPage(safe, { showSpinner: true });
  }, [page, totalPages, fetchPage]);

  // render item
  const renderItem = ({ item }) => {
    const dev = item?.device_id || {};
    const agent = item?.agent_id || {};
    const plan = item?.plan_snapshot || {};
    const st = String(item?.status || '').toLowerCase();
    const color = STATUS_COLOR[st] || STATUS_COLOR.default;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.85}
        onPress={() => navigateToScreen && navigateToScreen('orderDetail', { order: item })}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{dev?.name || 'Thiết bị'}</Text>
            <Text style={styles.sub}>
              Mã đơn: <Text style={styles.bold}>{item?.orderId || '—'}</Text> · Cổng <Text style={styles.bold}>{item?.portNumber ?? '—'}</Text>
            </Text>
          </View>

          <View style={[styles.statusPill, { backgroundColor: `${color}1A`, borderColor: color }]}>
            <Text style={[styles.statusText, { color }]}>{viStatus(st)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Icon name="store" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Đại lý</Text>
          <Text style={styles.v}>{agent?.name || '—'}</Text>
        </View>

        <View style={styles.row}>
          <Icon name="category" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Gói</Text>
          <Text style={styles.v}>{plan?.name || '—'}</Text>
        </View>

        <View style={styles.row}>
          <Icon name="schedule" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Thời lượng</Text>
          <Text style={styles.v}>{plan?.duration_minutes ? `${plan.duration_minutes} phút` : '—'}</Text>
        </View>

        <View style={styles.row}>
          <Icon name="payments" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Số tiền</Text>
          <Text style={styles.v}>{fmtMoney(item?.amount)}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.k}>Phương thức</Text>
          <Text style={styles.v}>{String(item?.payment_method || '').toUpperCase() || '—'}</Text>
        </View>

        <View style={styles.row}>
          <Icon name="event" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Ngày tạo</Text>
          <Text style={styles.v}>{fmtDate(item?.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Text style={{ fontSize: 30, color: '#fff' }}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lịch sử đơn hàng</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <SearchBar
          placeholder="Tìm theo mã đơn (VD: 2509200001)"
          value={q}
          onChange={(text) => { setQ(text); }}
          onClear={() => { setQ(''); }}
          onSubmit={() => fetchPage(1, { showSpinner: true })}
        />
      </View>

      {loadingHard ? (
        <View style={styles.center}>
          <EVChargingLoader message="Đang tải dữ liệu đơn hàng…" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it, idx) => String(it?._id || it?.orderId || idx)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_PAD }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Icon name="hourglass-empty" size={28} color="#94a3b8" />
              <Text style={styles.emptyText}>Không có đơn hàng phù hợp</Text>
            </View>
          }
          ListFooterComponent={
            <View style={{ marginTop: 12, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden' }}>
              <PaginationControls
                page={page}
                totalPages={totalPages}
                onPrev={handlePrev}
                onNext={handleNext}
                onGoTo={handleGoTo}   // ✅ Go to page
              />
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

/* ================= styles ================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },

  header: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 12,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center'
  },
  backButton: { padding: 6, marginRight: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },

  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  sub: { marginTop: 2, fontSize: 12, color: '#6b7280' },
  bold: { fontWeight: '800', color: '#111827' },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    marginLeft: 8
  },
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

  emptyWrap: { padding: 24, alignItems: 'center' },
  emptyText: { marginTop: 8, color: '#94a3b8', fontWeight: '600' },
});
