// screens/Home/HistoryExtend.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, Platform, BackHandler, PanResponder
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrders } from '../../apis/devices';
import SearchBar from '../../components/SearchBar';
import PaginationControls from '../../components/PaginationControls';
import WebFilters from '../../components/WebFilters';

const TAB_BAR_HEIGHT = 72;
const BOTTOM_PAD = Platform.OS === 'web' ? TAB_BAR_HEIGHT + 36 : TAB_BAR_HEIGHT + 16;
const API_LIMIT = 10;
const HARD_LIMIT = 20000;
const FE_PAGE_LIMIT = 10;

async function getAccessTokenSafe() {
  const keys = ['access_token', 'accessToken', 'ACCESS_TOKEN', 'token', 'auth_token'];
  for (const k of keys) { const v = await AsyncStorage.getItem(k); if (v) return v; }
  return null;
}
const STATUS_COLOR = {
  pending: '#f59e0b', paid: '#2563eb', completed: '#16a34a',
  canceled: '#ef4444', failed: '#ef4444', default: '#6b7280',
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
function fmtMoney(n) { return Number(n || 0).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + 'đ'; }
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
function isInRange(dt, from, to) {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}
// time helpers
function startOfDayLocal(d = new Date()) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0,0); }
function endOfDayLocal(d = new Date())   { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999); }
function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1, 0,0,0,0); }
function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999); }

export default function HistoryExtend({ navigateToScreen }) {
  // back
  const goBack = useCallback(() => { navigateToScreen?.('Device'); return true; }, [navigateToScreen]);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
  }, [goBack]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const TARGET_PATH = '/';
    window.history.replaceState(null, '', TARGET_PATH);
    const handlePopState = () => { window.history.replaceState(null, '', TARGET_PATH); goBack(); };
    window.history.pushState(null, '', TARGET_PATH);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [goBack]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (e) => e.nativeEvent.pageX <= 24,
    onMoveShouldSetPanResponder: (e, g) => e.nativeEvent.pageX <= 24 && Math.abs(g.dx) > 8,
    onPanResponderRelease: (e, g) => { if (g.dx > 60 && Math.abs(g.dy) < 40) goBack(); },
  }), [goBack]);

  // states
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [q, setQ] = useState('');
  const qRef = useRef(q);
  useEffect(() => { qRef.current = q; }, [q]); // BE search only

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // FE filter source
  const [allOrders, setAllOrders] = useState([]);
  const [portOptions, setPortOptions] = useState([]);
  const [selectedPort, setSelectedPort] = useState('all');

  const [dateFromStr, setDateFromStr] = useState('');
  const [dateToStr, setDateToStr] = useState('');
  const dateFrom = useMemo(() => (dateFromStr ? new Date(dateFromStr) : null), [dateFromStr]);
  const dateTo   = useMemo(() => (dateToStr   ? new Date(dateToStr)   : null), [dateToStr]);

  // tháng
  const [monthKey, setMonthKey] = useState('all'); // 'YYYY-MM' | 'all' | 'custom'
  const monthOptions = useMemo(()=>{
    const set = new Set();
    for (const it of allOrders) {
      const d = new Date(it?.createdAt || it?.updatedAt);
      if (!Number.isNaN(d.getTime())) {
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        set.add(key);
      }
    }
    const arr = [...set].sort((a,b)=> b.localeCompare(a));
    return arr.map((key)=>{
      const [y, m] = key.split('-').map(Number);
      return { key, label: `Tháng ${m}/${y}` };
    });
  }, [allOrders]);

  const isFEFilter = useMemo(
    () => selectedPort !== 'all' || !!dateFrom || !!dateTo || q.trim().length > 0,
    [selectedPort, dateFrom, dateTo, q]
  );

  // BE page
  const fetchPage = useCallback(async (p, { showSpinner = false } = {}) => {
    if (showSpinner) setLoading(true);
    try {
      const token = await getAccessTokenSafe();
      const params = { page: p, limit: API_LIMIT };
      const search = qRef.current.trim();
      if (search) params.search = search;

      const res = await getOrders(token, params);
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setItems(list);
      setPage(p);

      const lim = Number(res?.limit ?? res?.per_page ?? API_LIMIT) || API_LIMIT;
      const totalItems = Number(res?.total ?? 0);
      const tp = res?.totalPages ?? res?.total_pages
        ?? (totalItems ? Math.ceil(totalItems / lim) : (list.length < lim ? p : p + 1));
      setTotalPages(Math.max(1, Number(tp)));
    } catch {
      setItems([]); setTotalPages(1);
    } finally { if (showSpinner) setLoading(false); }
  }, []);

  // ALL for FE
  const fetchAllOnce = useCallback(async () => {
    try {
      const token = await getAccessTokenSafe();
      let p = 1, tp = 1; const all = [];
      do {
        const res = await getOrders(token, { page: p, limit: HARD_LIMIT });
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        all.push(...list);
        const lim = Number(res?.limit ?? res?.per_page ?? HARD_LIMIT) || HARD_LIMIT;
        const totalItems = Number(res?.total ?? 0);
        tp = res?.totalPages ?? res?.total_pages
          ?? (totalItems ? Math.ceil(totalItems / lim) : (list.length < lim ? p : p + 1));
        p += 1;
      } while (p <= tp);

      setAllOrders(all);
      const pset = new Set();
      for (const it of all) if (it?.portNumber != null) pset.add(String(it.portNumber));
      setPortOptions([...pset].map(Number).sort((a, b) => a - b));
    } catch { setAllOrders([]); setPortOptions([]); }
  }, []);

  useEffect(() => { fetchAllOnce(); }, [fetchAllOnce]);
  useEffect(() => { fetchPage(1, { showSpinner: true }); }, [fetchPage]);

  // FE paginate
  const applyFEFilterPaginate = useCallback((p = 1) => {
    let base = allOrders.slice();
    if (selectedPort !== 'all')
      base = base.filter(it => String(it?.portNumber ?? '') === String(selectedPort));
    if (dateFrom || dateTo)
      base = base.filter(it =>
        isInRange(it?.createdAt, dateFrom, dateTo) || isInRange(it?.updatedAt, dateFrom, dateTo)
      );
    const search = q.trim().toLowerCase();
    if (search)
      base = base.filter(it => String(it?.orderId || '').toLowerCase().includes(search));

    const tp = Math.max(1, Math.ceil(base.length / FE_PAGE_LIMIT));
    const safe = Math.max(1, Math.min(p, tp));
    setItems(base.slice((safe - 1) * FE_PAGE_LIMIT, safe * FE_PAGE_LIMIT));
    setTotalPages(tp);
    setPage(safe);
    setLoading(false);
  }, [allOrders, selectedPort, dateFrom, dateTo, q]);

  // Live apply (debounce)
  const runFilterOrFetch = useCallback((targetPage = 1) => {
    if (isFEFilter) { setLoading(true); applyFEFilterPaginate(targetPage); }
    else { fetchPage(targetPage, { showSpinner: true }); }
  }, [isFEFilter, applyFEFilterPaginate, fetchPage]);

  useEffect(() => {
    const t = setTimeout(() => { runFilterOrFetch(1); }, 250);
    return () => clearTimeout(t);
  }, [q, selectedPort, dateFromStr, dateToStr, runFilterOrFetch]);

  // refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchAllOnce(), fetchPage(page, { showSpinner: false })]);
      runFilterOrFetch(page);
    } finally { setRefreshing(false); }
  }, [fetchAllOnce, fetchPage, page, runFilterOrFetch]);

  // pager
  const handlePrev = useCallback(() => {
    const next = Math.max(1, page - 1);
    if (next !== page) runFilterOrFetch(next);
  }, [page, runFilterOrFetch]);

  const handleNext = useCallback(() => {
    const next = Math.min(totalPages, page + 1);
    if (next !== page) runFilterOrFetch(next);
  }, [page, totalPages, runFilterOrFetch]);

  const handleGoTo = useCallback((targetPage) => {
    const safe = Math.max(1, Math.min(Number(totalPages) || 1, Number(targetPage) || 1));
    if (safe !== page) runFilterOrFetch(safe);
  }, [page, totalPages, runFilterOrFetch]);

  // Quick chips
  const setToday = useCallback(() => {
    const s = startOfDayLocal(); const e = endOfDayLocal();
    setMonthKey('custom');
    setDateFromStr(s.toISOString()); setDateToStr(e.toISOString()); setPage(1);
  }, []);
  const set7Days = useCallback(() => {
    const t = new Date(); const s = startOfDayLocal(new Date(t.getTime() - 6*24*3600*1000)); const e = endOfDayLocal(t);
    setMonthKey('custom');
    setDateFromStr(s.toISOString()); setDateToStr(e.toISOString()); setPage(1);
  }, []);
  const set30Days = useCallback(() => {
    const t = new Date(); const s = startOfDayLocal(new Date(t.getTime() - 29*24*3600*1000)); const e = endOfDayLocal(t);
    setMonthKey('custom');
    setDateFromStr(s.toISOString()); setDateToStr(e.toISOString()); setPage(1);
  }, []);

  // Month change
  const onMonthChange = useCallback((key)=>{
    if (!key || key === 'all') {
      setMonthKey('all');
      setDateFromStr('');
      setDateToStr('');
    } else {
      setMonthKey(key);
      const [y, m] = key.split('-').map(Number);
      const base = new Date(y, m-1, 15);
      setDateFromStr(startOfMonth(base).toISOString());
      setDateToStr(endOfMonth(base).toISOString());
    }
    setPage(1);
  }, []);

  // highlight match
  const highlightText = (text, query) => {
    const raw = String(text ?? '');
    const needle = String(query ?? '').trim();
    if (!needle) return <Text style={styles.bold}>{raw || '—'}</Text>;
    const idx = raw.toLowerCase().indexOf(needle.toLowerCase());
    if (idx < 0) return <Text style={styles.bold}>{raw}</Text>;
    const before = raw.slice(0, idx);
    const match = raw.slice(idx, idx + needle.length);
    const after = raw.slice(idx + needle.length);
    return (
      <Text style={styles.bold}>
        {before}<Text style={styles.hlMatch}>{match}</Text>{after}
      </Text>
    );
  };

  // skeleton
  const SkeletonCard = () => (
    <View style={styles.card}>
      <View style={[styles.skel, { width: '48%', height: 16, marginBottom: 8 }]} />
      <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:8 }}>
        <View style={[styles.skel, { width: 120, height: 12 }]} />
        <View style={[styles.skel, { width: 60, height: 12 }]} />
      </View>
      <View style={[styles.skel, { width: '80%', height: 12, marginTop: 6 }]} />
      <View style={[styles.skel, { width: '70%', height: 12, marginTop: 6 }]} />
      <View style={[styles.skel, { width: '60%', height: 12, marginTop: 6 }]} />
    </View>
  );

  // item
  const renderItem = ({ item }) => {
    const dev = item?.device_id || {};
    const agent = item?.agent_id || {};
    const plan = item?.plan_snapshot || {};
    const st = String(item?.status || '').toLowerCase();
    const color = STATUS_COLOR[st] || STATUS_COLOR.default;

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.85}
        onPress={() => navigateToScreen?.('orderDetail', { order: item })}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{dev?.name || 'Thiết bị'}</Text>
            <Text style={styles.sub}>
              Mã đơn: {highlightText(item?.orderId || '—', q)} · Cổng <Text style={styles.bold}>{item?.portNumber ?? '—'}</Text>
            </Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: `${color}1A`, borderColor: color }]}>
            <Text style={[styles.statusText, { color }]}>{viStatus(st)}</Text>
          </View>
        </View>

        <View style={styles.row}><Icon name="store" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Đại lý</Text><Text style={styles.v}>{agent?.name || '—'}</Text></View>

        <View style={styles.row}><Icon name="category" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Gói</Text><Text style={styles.v}>{plan?.name || '—'}</Text></View>

        <View style={styles.row}><Icon name="schedule" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Thời lượng</Text><Text style={styles.v}>{plan?.duration_minutes ? `${plan.duration_minutes} phút` : '—'}</Text></View>

        <View style={styles.row}><Icon name="payments" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Số tiền</Text><Text style={styles.v}>{fmtMoney(item?.amount)}</Text></View>

        <View style={styles.row}><Text style={styles.k}>Phương thức</Text>
          <Text style={styles.v}>{String(item?.payment_method || '').toUpperCase() || '—'}</Text></View>

        <View style={styles.row}><Icon name="event" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Ngày tạo</Text><Text style={styles.v}>{fmtDate(item?.createdAt)}</Text></View>
      </TouchableOpacity>
    );
  };

  // Quick chips + (để đó, ai thích bấm tay thì bấm)
  const QuickChips = (
    <View style={styles.quickChipsRow}>
      <TouchableOpacity onPress={setToday} style={styles.chipBtn} activeOpacity={0.9}>
        <Text style={styles.chipText}>Hôm nay</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={set7Days} style={styles.chipBtn} activeOpacity={0.9}>
        <Text style={styles.chipText}>7 ngày</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={set30Days} style={styles.chipBtn} activeOpacity={0.9}>
        <Text style={styles.chipText}>30 ngày</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => runFilterOrFetch(1)} style={[styles.applyBtn, { marginLeft: 8 }]} activeOpacity={0.9}>
        <Icon name="filter-alt" size={16} color="#fff" />
        <Text style={styles.applyText}>Lọc</Text>
      </TouchableOpacity>
    </View>
  );

  // clear all
  const handleClearAll = useCallback(() => {
    setSelectedPort('all');
    setDateFromStr('');
    setDateToStr('');
    setMonthKey('all');
    setQ(''); // clear luôn input
    setPage(1);
    setLoading(true);
    runFilterOrFetch(1);
  }, [runFilterOrFetch]);

  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={{ padding: 6, marginRight: 6 }}>
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
          onChange={setQ}
          onClear={() => { setQ(''); runFilterOrFetch(1); }}
        />
      </View>

      {/* Filters */}
      <WebFilters
        // port
        portOptions={portOptions}
        portValue={selectedPort}
        onPortChange={(k) => { setSelectedPort(k); setPage(1); }}

        // tháng
        monthOptions={monthOptions}     // [{key:'2025-10', label:'Tháng 10/2025'}, ...]
        monthValue={monthKey}           // 'all' | 'YYYY-MM' | 'custom'
        onMonthChange={onMonthChange}

        // date range
        fromStr={dateFromStr}
        toStr={dateToStr}
        onFromChange={(v) => { setDateFromStr(v); setMonthKey(v ? 'custom' : 'all'); setPage(1); }}
        onToChange={(v) => { setDateToStr(v); setMonthKey(v ? 'custom' : 'all'); setPage(1); }}
        onClearDates={handleClearAll}

        // right slot
        rightSlot={QuickChips}
      />

      {/* List */}
      {loading ? (
        <FlatList
          data={[...Array(6).keys()]}
          keyExtractor={(i) => `skel-${i}`}
          renderItem={() => <SkeletonCard />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_PAD }}
          showsVerticalScrollIndicator={false}
        />
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
                onGoTo={handleGoTo}
              />
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

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
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },

  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 }, elevation: 2
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  sub: { marginTop: 2, fontSize: 12, color: '#6b7280' },
  bold: { fontWeight: '800', color: '#111827' },

  hlMatch: { backgroundColor: '#FEF3C7', color: '#111827', borderRadius: 4, paddingHorizontal: 2 },

  statusPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
    borderWidth: 1, marginLeft: 8
  },
  statusText: { fontSize: 12, lineHeight: 14, fontWeight: '700', marginLeft: 4 },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee', minHeight: 32,
  },
  k: { flex: 1, fontSize: 13, lineHeight: 16, color: '#6b7280' },
  v: { fontSize: 13, lineHeight: 16, fontWeight: '700', color: '#111827' },

  emptyWrap: { padding: 24, alignItems: 'center' },
  emptyText: { marginTop: 8, color: '#94a3b8', fontWeight: '600' },

  applyBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 10, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    height: 40, alignSelf: 'flex-start'
  },
  applyText: { color: '#fff', fontWeight: '800' },

  quickChipsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  chipBtn: {
    backgroundColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', height: 40
  },
  chipText: { fontSize: 12, fontWeight: '700', color: '#111827' },

  skel: { backgroundColor: '#E5E7EB', borderRadius: 8 }
});
