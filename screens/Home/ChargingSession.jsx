// screens/Home/ChargingSession.jsx  (MOBILE - search trên, dưới là dropdown + tải CSV)
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
  Modal,
  Pressable,
  ScrollView,
  PermissionsAndroid,
  ToastAndroid,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
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

function monthKey(dt) {
  if (!dt) return null;
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`; // 2025-10
}
function monthLabelSlash(key) {
  if (!key || key === 'all') return 'Tất cả (trang hiện tại)';
  const [y, m] = key.split('-');
  return `${m}/${y}`;
}

function diffDays(fromISO) {
  if (!fromISO) return Number.POSITIVE_INFINITY;
  const from = new Date(fromISO).getTime();
  return Math.floor((Date.now() - from) / (24 * 60 * 60 * 1000));
}

const toast = (msg) => {
  if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
  else Alert.alert('', msg);
};

/* ===================== Month Picker (native Modal) ===================== */
function MonthPickerModal({ visible, onClose, options = [], value, onSelect }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalSheet} onStartShouldSetResponder={() => true}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chọn tháng</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Icon name="close" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ maxHeight: 360 }}>
            <TouchableOpacity
              onPress={() => { onSelect('all'); onClose(); }}
              style={[styles.mItem, value === 'all' && styles.mItemActive]}
              activeOpacity={0.8}
            >
              <Text style={[styles.mItemText, value === 'all' && styles.mItemTextActive]}>
                Tất cả (trang hiện tại)
              </Text>
            </TouchableOpacity>

            {options.map((k) => {
              const active = value === k;
              return (
                <TouchableOpacity
                  key={k}
                  onPress={() => { onSelect(k); onClose(); }}
                  style={[styles.mItem, active && styles.mItemActive]}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.mItemText, active && styles.mItemTextActive]}>
                    {monthLabelSlash(k)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
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

  // month filter (mobile)
  const [monthOptions, setMonthOptions] = useState([]); // ['2025-10', ...] từ trang hiện tại
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [monthModal, setMonthModal] = useState(false);
  const [monthTotalKWh, setMonthTotalKWh] = useState(0);
  const [monthLoading, setMonthLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const fetchPage = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const token = await getAccessTokenSafe();
      const params = { page: p, limit };
      if (search.trim()) params.search = search.trim(); // ?search=ORDER_ID
      const res = await getSessions(token, params);

      const arr = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setItems(arr);
      setTotalPages(res?.totalPages || 1);
      setPage(res?.page || p);

      // build month options from this page
      const keys = new Set();
      for (const it of arr) {
        const mk = monthKey(it?.startTime || it?.endTime);
        if (mk) keys.add(mk);
      }
      const opts = Array.from(keys).sort((a, b) => (a > b ? -1 : 1));
      setMonthOptions(opts);
      if (selectedMonth !== 'all' && !opts.includes(selectedMonth)) {
        setSelectedMonth('all');
      }
    } catch (e) {
      console.warn('Lỗi lấy phiên sạc:', e?.message || e);
      setItems([]);
      setTotalPages(1);
      setMonthOptions([]);
    } finally {
      setLoading(false);
    }
  }, [limit, search, selectedMonth]);

  useEffect(() => { fetchPage(1); }, [fetchPage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await fetchPage(page); } finally { setRefreshing(false); }
  }, [fetchPage, page]);

  // tính tổng kWh toàn tháng (đi qua tất cả page)
  const recomputeMonthTotal = useCallback(async (targetMonth) => {
    if (targetMonth === 'all') {
      setMonthTotalKWh(0);
      return;
    }
    try {
      setMonthLoading(true);
      const token = await getAccessTokenSafe();

      let p = 1;
      let tp = 1;
      let total = 0;

      do {
        const params = { page: p, limit };
        if (search.trim()) params.search = search.trim();
        const res = await getSessions(token, params);
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);

        for (const it of list) {
          const mk = monthKey(it?.startTime || it?.endTime);
          if (mk === targetMonth) {
            const kwh = Number(it?.energy_used_kwh ?? it?.energy_kwh ?? it?.energy ?? 0);
            if (Number.isFinite(kwh)) total += kwh;
          }
        }

        const lim = Number(res?.limit ?? res?.per_page ?? limit) || limit;
        const totalItems = Number(res?.total ?? 0);
        tp = res?.totalPages ?? res?.total_pages
          ?? (totalItems ? Math.ceil(totalItems / lim) : (list.length < lim ? p : p + 1));

        p += 1;
      } while (p <= tp);

      setMonthTotalKWh(total);
    } catch (e) {
      console.warn('Lỗi tính tổng tháng:', e?.message || e);
      setMonthTotalKWh(0);
    } finally {
      setMonthLoading(false);
    }
  }, [limit, search]);

  useEffect(() => { recomputeMonthTotal(selectedMonth); }, [selectedMonth, recomputeMonthTotal]);

  // FE filter cho status, range, month (trên trang hiện tại)
  const filtered = useMemo(() => {
    return (items || []).filter((it) => {
      const mk = monthKey(it?.startTime || it?.endTime);
      const matchMonth = selectedMonth === 'all' || mk === selectedMonth;

      const st = String(it?.status || '').toLowerCase();
      const matchStatus = status === 'all' || st === status;

      let matchRange = true;
      if (range === '7d') matchRange = diffDays(it?.startTime || it?.endTime) <= 7;
      if (range === '30d') matchRange = diffDays(it?.startTime || it?.endTime) <= 30;

      return matchMonth && matchStatus && matchRange;
    });
  }, [items, status, range, selectedMonth]);

  /* ================= Export CSV (save to device) ================= */
  const fetchAllPages = useCallback(async () => {
    const token = await getAccessTokenSafe();
    let p = 1;
    let tp = 1;
    const all = [];
    do {
      const params = { page: p, limit };
      if (search.trim()) params.search = search.trim();
      const res = await getSessions(token, params);
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      all.push(...list);

      const lim = Number(res?.limit ?? res?.per_page ?? limit) || limit;
      const totalItems = Number(res?.total ?? 0);
      tp = res?.totalPages ?? res?.total_pages
        ?? (totalItems ? Math.ceil(totalItems / lim) : (list.length < lim ? p : p + 1));
      p += 1;
    } while (p <= tp);
    return all;
  }, [limit, search]);

  const csvEscape = (v) => {
    const s = String(v ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const toRow = (it) => ({
    order: String(it?.order_id ?? ''),
    device: String(it?.device_id?.name ?? ''),
    port: String(it?.portNumber ?? ''),
    status: viStatus(it?.status),
    start: fmt(it?.startTime),
    end: fmt(it?.endTime),
    kwh: Number(it?.energy_used_kwh ?? it?.energy_kwh ?? it?.energy ?? 0),
    month: monthLabelSlash(monthKey(it?.startTime || it?.endTime) || ''),
  });

  const exportCSV = useCallback(async () => {
    try {
      setExporting(true);

      // Android < 29 xin quyền ghi
      if (Platform.OS === 'android' && Platform.Version < 29) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          toast('Thiếu quyền lưu file');
          setExporting(false);
          return;
        }
      }

      const data = await fetchAllPages();

      // tổng theo tháng
      const totals = new Map();
      for (const it of data) {
        const k = monthLabelSlash(monthKey(it?.startTime || it?.endTime) || '');
        if (!k) continue;
        const kwh = Number(it?.energy_used_kwh ?? it?.energy_kwh ?? it?.energy ?? 0) || 0;
        totals.set(k, (totals.get(k) || 0) + kwh);
      }
      const totalRows = Array.from(totals.entries())
        .sort((a, b) => (a[0] > b[0] ? -1 : 1))
        .map(([k, v]) => [k, Number(v.toFixed(3))]);

      // build CSV text
      const lines = [];
      lines.push('Tổng kWh theo tháng,,');
      lines.push(['Tháng','Tổng kWh'].map(csvEscape).join(','));
      totalRows.forEach(r => lines.push(r.map(csvEscape).join(',')));
      lines.push('');

      const header = ['Mã đơn','Thiết bị','Cổng','Trạng thái','Bắt đầu','Kết thúc','Năng lượng (kWh)','Tháng'];
      lines.push(header.map(csvEscape).join(','));
      data.map(toRow).forEach((r) => {
        lines.push([
          r.order, r.device, r.port, r.status, r.start, r.end, r.kwh, r.month
        ].map(csvEscape).join(','));
      });

      const csv = lines.join('\n');

      const now = new Date();
      const fname = `charging_sessions_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.csv`;

      let path = '';
      if (Platform.OS === 'android') {
        path = (RNFS.DownloadDirectoryPath || RNFS.ExternalStorageDirectoryPath) + '/' + fname;
      } else {
        path = RNFS.DocumentDirectoryPath + '/' + fname;
      }

      await RNFS.writeFile(path, csv, 'utf8');
      toast(`Đã lưu: ${path}`);
    } catch (e) {
      console.warn('Export CSV error:', e);
      toast('Xuất CSV lỗi: ' + (e?.message || e));
    } finally {
      setExporting(false);
    }
  }, [fetchAllPages]);

  /* ================= RENDER ================= */
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
          <Icon name="electric-bolt" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Năng lượng</Text>
          <Text style={styles.v}>{(item?.energy_used_kwh ?? 0) + ' kWh'}</Text>
        </View>
      </View>
    );
  };

  const MonthTotalCard = () => {
    if (selectedMonth === 'all') return null;
    return (
      <View style={styles.totalCard}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.totalTitle}>Tổng tháng {monthLabelSlash(selectedMonth)}</Text>
          {monthLoading
            ? <ActivityIndicator size="small" color="#2563EB" />
            : <Text style={styles.totalValue}>{Number(monthTotalKWh || 0).toFixed(2)} kWh</Text>}
        </View>
        <Text style={styles.totalHint}>(Tính trên toàn bộ dữ liệu của tháng qua tất cả các trang)</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Phiên sạc</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search: 1 hàng riêng */}
      <View style={styles.searchWrap}>
        <SearchBar
          placeholder="Nhập mã đơn để tìm kiếm"
          value={search}
          onChange={(txt) => { setSearch(txt); setPage(1); }}
          onClear={() => { setSearch(''); fetchPage(1); }}
          onSubmit={() => fetchPage(1)}
        />
      </View>

      {/* Hàng actions: Dropdown tháng + Tải CSV */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          onPress={() => setMonthModal(true)}
          style={styles.monthBtn}
          activeOpacity={0.85}
        >
          <Text style={styles.monthBtnText} numberOfLines={1}>
            {monthLabelSlash(selectedMonth)}
          </Text>
          <Icon name="arrow-drop-down" size={22} color="#2563EB" />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={exportCSV}
          style={[styles.exportBtn, exporting && { opacity: 0.7 }]}
          activeOpacity={0.85}
          disabled={exporting}
        >
          <Icon name="file-download" size={18} color="#fff" />
          <Text style={styles.exportText}>{exporting ? 'Đang xuất…' : 'Tải báo cáo'}</Text>
        </TouchableOpacity>
      </View>

      {/* Tổng tháng */}
      <View style={{ paddingHorizontal: 16 }}>
        <MonthTotalCard />
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
            keyExtractor={(it, idx) => String(it?._id || it?.order_id || idx)}
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
            onPrev={() => fetchPage(Math.max(1, page - 1))}
            onNext={() => fetchPage(Math.min(totalPages, page + 1))}
          />
        </>
      )}

      {/* Month picker modal */}
      <MonthPickerModal
        visible={monthModal}
        onClose={() => setMonthModal(false)}
        options={monthOptions}
        value={selectedMonth}
        onSelect={(k) => { setSelectedMonth(k); setPage(1); }}
      />
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

  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },

  actionRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  monthBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2563EB',
    paddingHorizontal: 10,
    height: 40,
    backgroundColor: '#fff',
  },
  monthBtnText: { color: '#2563EB', fontWeight: '800', flex: 1 },

  exportBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  exportText: { color: '#fff', fontWeight: '800' },

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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusText: { fontSize: 12, fontWeight: '700' },

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

  // month modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalSheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFF',
  },
  modalTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  modalClose: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  mItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#fff',
  },
  mItemActive: { backgroundColor: '#2563EB' },
  mItemText: { color: '#111827', fontWeight: '700' },
  mItemTextActive: { color: '#fff', fontWeight: '800' },

  // tổng tháng
  totalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 6,
  },
  totalTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  totalValue: { fontSize: 18, fontWeight: '900', color: '#111827' },
  totalHint: { marginTop: 4, fontSize: 11, color: '#6B7280' },
});
