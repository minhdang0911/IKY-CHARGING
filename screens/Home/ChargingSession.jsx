import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Platform,
  BackHandler,
  PanResponder,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessions } from '../../apis/devices';
import SearchBar from '../../components/SearchBar';
import PaginationControls from '../../components/PaginationControls';

/* ================= helpers ================= */
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
  completed: '#16a34a',
  pending: '#f59e0b',
  charging: '#2563eb',
  failed: '#ef4444',
  canceled: '#ef4444',
  default: '#6b7280',
};

function viStatus(s) {
  const x = String(s || '').toLowerCase();
  switch (x) {
    case 'completed': return 'Hoàn tất';
    case 'pending':   return 'Đang chờ';
    case 'charging':  return 'Đang sạc';
    case 'failed':    return 'Thất bại';
    case 'canceled':  return 'Đã hủy';
    default:          return 'Không rõ';
  }
}

function fmt(dt) {
  if (!dt) return '—';
  try {
    const d = new Date(dt);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch { return '—'; }
}

function diffDays(fromISO) {
  if (!fromISO) return Number.POSITIVE_INFINITY;
  const from = new Date(fromISO).getTime();
  return Math.floor((Date.now() - from) / (24 * 60 * 60 * 1000));
}

/* ===================== Screen ===================== */

export default function ChargingSession({ navigateToScreen }) {
  // back handlers
  const goBack = useCallback(() => {
    if (navigateToScreen) navigateToScreen('Device');
    return true;
  }, [navigateToScreen]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
  }, [goBack]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) => e.nativeEvent.pageX <= 24,
        onMoveShouldSetPanResponder: (e, g) =>
          e.nativeEvent.pageX <= 24 && Math.abs(g.dx) > 8,
        onPanResponderRelease: (e, g) => {
          if (g.dx > 60 && Math.abs(g.dy) < 40) goBack();
        },
      }),
    [goBack]
  );

  // pagination + data
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // search + filter
  const [search, setSearch] = useState(''); // chỉ search theo mã đơn
  const [status, setStatus] = useState('all'); // giữ sẵn nếu sau này thêm dropdown
  const [range, setRange] = useState('all');

  const fetchPage = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const token = await getAccessTokenSafe();
      const params = { page: p, limit };
      if (search.trim()) params.search = search.trim(); // ?search=ORDER_ID
      const res = await getSessions(token, params);

      setItems(Array.isArray(res?.data) ? res.data : []);
      setTotalPages(res?.totalPages || 1);
      setPage(res?.page || p);
    } catch (e) {
      console.warn('Lỗi lấy phiên sạc:', e?.message || e);
      setItems([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [limit, search]);

  useEffect(() => { fetchPage(1); }, [fetchPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await fetchPage(page); } finally { setRefreshing(false); }
  }, [fetchPage, page]);

  // FE filter cho status & range (search đã do backend xử lý)
  const filtered = useMemo(() => {
    return (items || []).filter((it) => {
      const st = String(it?.status || '').toLowerCase();
      const matchStatus = status === 'all' || st === status;

      let matchRange = true;
      if (range === '7d') matchRange = diffDays(it?.startTime || it?.endTime) <= 7;
      if (range === '30d') matchRange = diffDays(it?.startTime || it?.endTime) <= 30;

      return matchStatus && matchRange;
    });
  }, [items, status, range]);

  const renderItem = ({ item }) => {
    const dev = item?.device_id || {};
    const st = String(item?.status || '').toLowerCase();
    const color = STATUS_COLOR[st] || STATUS_COLOR.default;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{dev?.name || 'Thiết bị'}</Text>
            <Text style={styles.sub}>
              Mã đơn: <Text style={styles.bold}>{item?.order_id || '—'}</Text> · Cổng{' '}
              <Text style={styles.bold}>{item?.portNumber ?? '—'}</Text>
            </Text>
          </View>

          <View style={[styles.statusPill, { backgroundColor: `${color}1A`, borderColor: color }]}>
            <Icon name="bolt" size={14} color={color} />
            <Text style={[styles.statusText, { color }]}>{viStatus(st)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Icon name="schedule" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Bắt đầu</Text>
          <Text style={styles.v}>{fmt(item?.startTime)}</Text>
        </View>
        <View style={styles.row}>
          <Icon name="event" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Kết thúc</Text>
          <Text style={styles.v}>{fmt(item?.endTime)}</Text>
        </View>
        <View style={styles.row}>
          <Icon name="event" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Năng lượng</Text>
          <Text style={styles.v}>{(item?.energy_used_kwh ?? 0) + ' kWh'}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Text style={{fontSize: 30, color: '#fff'}}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Phiên sạc</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search (chỉ mã đơn) */}
      <View style={styles.filterBar}>
        <SearchBar
          placeholder="Nhập mã đơn để tìm kiếm"
          value={search}
          onChange={(txt) => { setSearch(txt); setPage(1); }}
          onClear={() => { setSearch(''); fetchPage(1); }}
          onSubmit={() => fetchPage(1)}
        />
      </View>

      {/* Nội dung */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={{ marginTop: 8, color: '#64748b' }}>Đang tải dữ liệu…</Text>
        </View>
      ) : (
        <>
          <FlatList
            data={filtered}
            keyExtractor={(it) => String(it?._id || Math.random())}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Icon name="hourglass-empty" size={28} color="#94a3b8" />
                <Text style={styles.emptyText}>Không có phiên phù hợp</Text>
              </View>
            }
          />

          <PaginationControls
            page={page}
            totalPages={totalPages}
            onPrev={() => fetchPage(page - 1)}
            onNext={() => fetchPage(page + 1)}
          />
        </>
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
    alignItems: 'center',
  },
  backButton: { padding: 6, marginRight: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  filterBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
    marginLeft: 8,
  },
  statusText: { fontSize: 12, fontWeight: '700', marginLeft: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  k: { flex: 1, fontSize: 13, color: '#6b7280' },
  v: { fontSize: 13, fontWeight: '700', color: '#111827' },
  emptyWrap: { padding: 24, alignItems: 'center' },
  emptyText: { marginTop: 8, color: '#94a3b8', fontWeight: '600' },
});
