// screens/Home/ChargingSession.jsx (WEB ONLY, FE paginate when month filter is active)
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, ActivityIndicator, BackHandler, PanResponder,
  Pressable, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSessions } from '../../apis/devices';
import SearchBar from '../../components/SearchBar';
import PaginationControls from '../../components/PaginationControls';

// Excel export
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/* ================= helpers ================= */
const TAB_BAR_HEIGHT = 72;
const BOTTOM_PAD = TAB_BAR_HEIGHT + 36;

async function getAccessTokenSafe() {
  const keys = ['access_token', 'accessToken', 'ACCESS_TOKEN', 'token', 'auth_token'];
  for (const k of keys) { const v = await AsyncStorage.getItem(k); if (v) return v; }
  return null;
}

const STATUS_COLOR = {
  completed: '#16a34a', pending: '#f59e0b', charging: '#2563eb',
  failed: '#ef4444', canceled: '#ef4444', default: '#6b7280',
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
function monthLabelDash(key) {
  if (!key || key === 'all') return 'all';
  const [y, m] = key.split('-');
  return `${m}-${y}`; // 10-2025 (để Excel không auto-format)
}
function monthLabelSlash(key) {
  if (!key || key === 'all') return 'Tất cả (trang hiện tại)';
  const [y, m] = key.split('-');
  return `${m}/${y}`;
}

/* ===================== MonthDropdown ===================== */
function MonthDropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen(v => !v), []);
  const close = useCallback(() => setOpen(false), []);

  return (
    <View style={styles.ddWrapWeb}>
      <TouchableOpacity style={styles.ddButton} onPress={toggle} activeOpacity={0.9}>
        <Text style={styles.ddButtonText}>{monthLabelSlash(value)}</Text>
      </TouchableOpacity>

      {open && (
        <>
          <Pressable onPress={close} style={styles.popoverBackdrop} />
          <View style={styles.popoverPanel}>
            <View style={styles.ddHeader}>
              <Text style={styles.ddTitle}>Chọn tháng</Text>
              <TouchableOpacity onPress={close} style={styles.ddClose}>
                <Icon name="close" size={18} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {['all', ...options].map((k) => {
                const active = value === k;
                return (
                  <TouchableOpacity
                    key={k}
                    onPress={() => { onChange(k); close(); }}
                    style={[styles.ddItem, active && styles.ddItemActive]}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.ddItemText, active && styles.ddItemTextActive]}>
                      {k === 'all' ? 'Tất cả (trang hiện tại)' : monthLabelSlash(k)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </>
      )}
    </View>
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

  /* ====== states ====== */
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [items, setItems] = useState([]);        // danh sách hiển thị (đã cắt trang, tuỳ mode)
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');  // mã đơn
  const [selectedMonth, setSelectedMonth] = useState('all');

  // cache toàn bộ dữ liệu để FE filter khi chọn tháng
  const [allSessions, setAllSessions] = useState([]);      // dữ liệu ALL (load 1 lần, không params)
  const [allReady, setAllReady] = useState(false);         // cờ đã có all
  const [monthOptions, setMonthOptions] = useState([]);    // extract từ allSessions

  /* ====== boot: fetch ALL (no params) để dùng cho filter theo tháng ====== */
 // Gom toàn bộ sessions (loop qua tất cả trang) để dùng cho filter theo tháng
const fetchAllOnce = useCallback(async () => {
  try {
    const token = await getAccessTokenSafe();

    // dùng limit lớn để giảm số lần gọi
    const HARD_LIMIT = 20000;
    let p = 1, tp = 1;
    const all = [];

    do {
      const res = await getSessions(token, { page: p, limit: HARD_LIMIT });
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      all.push(...list);

      // tính tổng trang từ response hiện có
      const lim = Number(res?.limit ?? res?.per_page ?? HARD_LIMIT) || HARD_LIMIT;
      const totalItems = Number(res?.total ?? 0);
      tp = res?.totalPages ?? res?.total_pages
        ?? (totalItems ? Math.ceil(totalItems / lim) : (list.length < lim ? p : p + 1));

      p += 1;
    } while (p <= tp);

    setAllSessions(all);

    const keys = new Set();
    for (const it of all) {
      const mk = monthKey(it?.startTime || it?.endTime);
      if (mk) keys.add(mk);
    }
    const arr = Array.from(keys).sort((a, b) => (a > b ? -1 : 1));
    setMonthOptions(arr);
    setAllReady(true);
  } catch (e) {
    console.warn('Lỗi load ALL sessions:', e?.message || e);
    setAllSessions([]);
    setMonthOptions([]);
    setAllReady(true);
  }
}, []);


  /* ====== backend paginate khi Tháng = Tất cả ====== */
  const fetchBackendPage = useCallback(async (p = 1, q = '') => {
    setLoading(true);
    try {
      const token = await getAccessTokenSafe();
      const params = { page: p, limit };
      if (q.trim()) params.search = q.trim();
      const res = await getSessions(token, params);

      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setItems(list);

      // backend total pages fallback
      const lim = Number(res?.limit ?? res?.per_page ?? limit) || limit;
      const totalItems = Number(res?.total ?? 0);
      const tp = res?.totalPages ?? res?.total_pages
        ?? (totalItems ? Math.ceil(totalItems / lim) : (list.length < lim ? p : p + 1));
      setTotalPages(Math.max(1, Number(tp)));
      setPage(res?.page || p);
    } catch (e) {
      console.warn('Lỗi lấy trang backend:', e?.message || e);
      setItems([]);
      setTotalPages(1);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  /* ====== FE filter + paginate khi chọn Tháng ====== */
  const applyFEFilterPaginate = useCallback((targetMonth, q, p = 1) => {
  let base = allSessions;
  if (targetMonth !== 'all') {
    base = base.filter(it => monthKey(it?.startTime || it?.endTime) === targetMonth);
  }
  if (q.trim()) {
    const needle = q.trim().toLowerCase();
    base = base.filter(it => String(it?.order_id || '').toLowerCase().includes(needle));
  }
  const tp = Math.max(1, Math.ceil(base.length / limit));
  const safePage = Math.min(Math.max(1, p), tp);
  const start = (safePage - 1) * limit;
  setItems(base.slice(start, start + limit));
  setTotalPages(tp);
  setPage(safePage);
  setLoading(false);
}, [allSessions, limit]);


  /* ====== orchestrate theo selectedMonth ====== */
  // load ALL ngay từ đầu (1 lần)
 

  // khi vào trang lần đầu: nếu đang TẤT CẢ → gọi backend paginate trang 1
  useEffect(() => {
    if (selectedMonth === 'all') {
      fetchBackendPage(1, search);
    } else {
      // khi chuyển sang filter theo tháng → dùng FE paginate
      setLoading(true);
      applyFEFilterPaginate(selectedMonth, search, 1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);


   useEffect(() => { fetchAllOnce(); }, []);

  // thao tác search
  const doSearch = useCallback(() => {
    setLoading(true);
    if (selectedMonth === 'all') {
      fetchBackendPage(1, search);
    } else {
      applyFEFilterPaginate(selectedMonth, search, 1);
    }
  }, [selectedMonth, search, fetchBackendPage, applyFEFilterPaginate]);

  // pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // refresh cả 2 nguồn
      await fetchAllOnce();
      if (selectedMonth === 'all') {
        await fetchBackendPage(page, search);
      } else {
        applyFEFilterPaginate(selectedMonth, search, page);
      }
    } finally { setRefreshing(false); }
  }, [fetchAllOnce, fetchBackendPage, applyFEFilterPaginate, selectedMonth, page, search]);

  // prev/next
  const handlePrev = useCallback(() => {
    const next = Math.max(1, page - 1);
    if (next === page) return;
    setLoading(true);
    if (selectedMonth === 'all') {
      fetchBackendPage(next, search);
    } else {
      applyFEFilterPaginate(selectedMonth, search, next);
    }
  }, [page, selectedMonth, search, fetchBackendPage, applyFEFilterPaginate]);

  const handleNext = useCallback(() => {
    const next = Math.min(totalPages, page + 1);
    if (next === page) return;
    setLoading(true);
    if (selectedMonth === 'all') {
      fetchBackendPage(next, search);
    } else {
      applyFEFilterPaginate(selectedMonth, search, next);
    }
  }, [page, totalPages, selectedMonth, search, fetchBackendPage, applyFEFilterPaginate]);


 const handleGoTo = useCallback((targetPage) => {
  const safe = Math.max(1, Math.min(Number(totalPages) || 1, Number(targetPage) || 1));
  if (safe === page) return;
  setLoading(true);
  if (selectedMonth === 'all') {
     fetchBackendPage(safe, search);
  } else {
     applyFEFilterPaginate(selectedMonth, search, safe);
   }
 }, [totalPages, page, selectedMonth, search, fetchBackendPage, applyFEFilterPaginate]);

  /* ====== tổng kWh tháng (từ allSessions, không gọi backend) ====== */
  const monthTotalKWh = useMemo(() => {
    if (selectedMonth === 'all') return 0;
    let total = 0;
    for (const it of allSessions) {
      if (monthKey(it?.startTime || it?.endTime) === selectedMonth) {
        const kwh = Number(it?.energy_used_kwh ?? it?.energy_kwh ?? it?.energy ?? 0);
        if (Number.isFinite(kwh)) total += kwh;
      }
    }
    return total;
  }, [selectedMonth, allSessions]);

  /* ========== Export Excel (đa sheet + tổng) ========== */
  const ensureAllData = useCallback(async () => {
    if (allReady) return allSessions;
    try {
      const token = await getAccessTokenSafe();
      const res = await getSessions(token); // không params
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      return list;
    } catch {
      // fallback: lặp trang nếu server không trả all
      const token = await getAccessTokenSafe();
      let p = 1, tp = 1;
      const out = [];
      do {
        const res = await getSessions(token, { page: p, limit: 100 });
        const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
        out.push(...list);
        const lim = Number(res?.limit ?? 100) || 100;
        const totalItems = Number(res?.total ?? 0);
        tp = res?.totalPages ?? (totalItems ? Math.ceil(totalItems / lim) : (list.length < lim ? p : p + 1));
        p++;
      } while (p <= tp);
      return out;
    }
  }, [allReady, allSessions]);

  const toRow = (it) => ({
    'Mã đơn': String(it?.order_id ?? ''),
    'Thiết bị': String(it?.device_id?.name ?? ''),
    'Cổng': String(it?.portNumber ?? ''),
    'Trạng thái': viStatus(it?.status),
    'Bắt đầu': fmt(it?.startTime),
    'Kết thúc': fmt(it?.endTime),
    'Năng lượng (kWh)': Number(it?.energy_used_kwh ?? it?.energy_kwh ?? it?.energy ?? 0),
    'Tháng': monthLabelDash(monthKey(it?.startTime || it?.endTime)),
  });
  const autoCols = (headers) => headers.map(w => ({ wch: w }));

  const exportExcel = useCallback(async () => {
    try {
      const data = await ensureAllData();

      // nhóm theo tháng + tổng
      const monthMap = new Map();
      const monthTotals = new Map();
      for (const it of data) {
        const key = monthKey(it?.startTime || it?.endTime);
        if (!key) continue;
        const row = toRow(it);
        if (!monthMap.has(key)) monthMap.set(key, []);
        monthMap.get(key).push(row);
        const kwh = Number(row['Năng lượng (kWh)'] || 0);
        monthTotals.set(key, (monthTotals.get(key) || 0) + (Number.isFinite(kwh) ? kwh : 0));
      }

      const wb = XLSX.utils.book_new();

      // Sheet "Tong"
      const sums = Array.from(monthTotals.entries())
        .sort((a, b) => (a[0] > b[0] ? -1 : 1))
        .map(([k, v]) => ({ 'Tháng': monthLabelDash(k), 'Tổng kWh': Number(v.toFixed(3)) }));
      const wsSum = XLSX.utils.json_to_sheet(sums.length ? sums : [{ 'Tháng': '-', 'Tổng kWh': 0 }]);
      wsSum['!cols'] = autoCols([12, 14]);

      const totalRows = data.map(toRow);
      const wsDetail = XLSX.utils.json_to_sheet(totalRows);
      wsDetail['!cols'] = autoCols([14, 22, 8, 12, 19, 19, 16, 10]);

      const sumRange = XLSX.utils.decode_range(wsSum['!ref'] || 'A1:A1');
      const sumRows = (sumRange.e.r - sumRange.s.r + 1) || 1;
      const wsTong = {};
      wsTong['A1'] = { t: 's', v: 'Tổng kWh theo tháng' };

      // shift wsSum xuống 1 hàng
      const shifted = {};
      Object.keys(wsSum).forEach((addr) => {
        if (addr[0] === '!') return;
        const cell = wsSum[addr];
        const { r, c } = XLSX.utils.decode_cell(addr);
        shifted[XLSX.utils.encode_cell({ r: r + 1, c })] = cell;
      });
      Object.keys(shifted).forEach((a) => { wsTong[a] = shifted[a]; });

      const startRow = sumRows + 3;
      const detailAOA = XLSX.utils.sheet_to_json(wsDetail, { header: 1 });
      XLSX.utils.sheet_add_aoa(wsTong, [['Chi tiết toàn bộ']], { origin: `A${startRow}` });
      XLSX.utils.sheet_add_aoa(wsTong, detailAOA, { origin: `A${startRow + 1}` });

      const lastRow = startRow + detailAOA.length;
      const lastCol = Math.max(
        XLSX.utils.decode_range(wsDetail['!ref'] || 'A1:A1').e.c,
        XLSX.utils.decode_range(wsSum['!ref'] || 'A1:A1').e.c,
      );
      wsTong['!ref'] = XLSX.utils.encode_range({ r: 0, c: 0 }, { r: lastRow, c: lastCol });
      wsTong['!cols'] = autoCols([22, 14, 8, 12, 19, 19, 16, 12]);
      XLSX.utils.book_append_sheet(wb, wsTong, 'Tong');

      // Sheets theo tháng
      const sortedKeys = Array.from(monthMap.keys()).sort((a, b) => (a > b ? -1 : 1));
      for (const key of sortedKeys) {
        const rows = monthMap.get(key);
        const label = monthLabelDash(key);
        const total = Number((monthTotals.get(key) || 0).toFixed(3));

        const base = XLSX.utils.json_to_sheet(rows);
        const content = [
          [`Tổng kWh tháng ${label}`, total],
          [''],
          ...XLSX.utils.sheet_to_json(base, { header: 1 }),
        ];
        const wsFinal = XLSX.utils.aoa_to_sheet(content);
        wsFinal['!cols'] = autoCols([28, 16, 8, 14, 20, 20, 18, 10]);
        XLSX.utils.book_append_sheet(wb, wsFinal, label);
      }

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const now = new Date();
      const fname = `Bao_cao_phien_sac_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.xlsx`;
      saveAs(blob, fname);
    } catch (e) {
      console.warn('Export error:', e);
      alert('Xuất Excel thất bại: ' + (e?.message || e));
    }
  }, [ensureAllData]);

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
          <Text style={styles.k}>Bắt đầu</Text>
          <Text style={styles.v}>{fmt(item?.startTime)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.k}>Kết thúc</Text>
          <Text style={styles.v}>{fmt(item?.endTime)}</Text>
        </View>
        <View style={styles.row}>
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent:'space-between' }}>
          <Text style={styles.totalTitle}>Tổng tháng {monthLabelSlash(selectedMonth)}</Text>
          <Text style={styles.totalValue}>{Number(monthTotalKWh || 0).toFixed(2)} kWh</Text>
        </View>
        <Text style={styles.totalHint}>(Tính từ toàn bộ dữ liệu đã tải, không phụ thuộc trang)</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Text style={{ fontSize: 30, color: '#fff' }}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Phiên sạc</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Hàng 1: Search */}
      <View style={styles.searchWrap}>
        <SearchBar
          placeholder="Nhập mã đơn để tìm kiếm"
          value={search}
          onChange={(txt) => { setSearch(txt); }}
          onClear={() => { setSearch(''); doSearch(); }}
          onSubmit={doSearch}
        />
      </View>

      {/* Hàng 2: Dropdown + Export */}
      <View style={styles.actionRow}>
        <MonthDropdown
          options={monthOptions}
          value={selectedMonth}
          onChange={(k) => { setSelectedMonth(k); setPage(1); }}
        />
        <TouchableOpacity onPress={exportExcel} style={styles.exportBtn} activeOpacity={0.9}>
          <Icon name="download" size={16} color="#fff" />
          <Text style={styles.exportText}>Xuất Excel</Text>
        </TouchableOpacity>
      </View>

      {/* Tổng tháng */}
      <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
        <MonthTotalCard />
      </View>

      {/* Nội dung */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4A90E2" />
          <Text style={{ marginTop: 8, color: '#64748b' }}>Đang tải dữ liệu…</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it, idx) => String(it?._id || it?.order_id || idx)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_PAD, overflow: 'visible' }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>Không có phiên phù hợp</Text>
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

/* ================= styles ================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },

  header: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { padding: 6, marginRight: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },

  // hàng search (riêng)
  searchWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    zIndex: 20,
  },

  // hàng dropdown + export
  actionRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    zIndex: 19,
  },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // dropdown (clean)
  ddWrapWeb: { position: 'relative', zIndex: 99, minWidth: 220, flex: 1, maxWidth: 360 },
  ddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2563EB',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    justifyContent: 'space-between',
  },
  ddButtonText: { color: '#2563EB', fontWeight: '800', flex: 1, marginRight: 6, textAlign: 'left' },

  popoverBackdrop: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'transparent',
  },
  popoverPanel: {
    position: 'absolute',
    top: 50,
    left: 0,
    right: 'auto',
    width: 280,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    boxShadow: '0 12px 30px rgba(0,0,0,0.12)',
    elevation: 8,
  },

  ddHeader: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFF',
  },
  ddTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  ddClose: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center', justifyContent: 'center',
  },
  ddItem: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#fff',
  },
  ddItemActive: { backgroundColor: '#2563EB' },
  ddItemText: { color: '#111827', fontWeight: '700', textAlign: 'left' },
  ddItemTextActive: { color: '#fff', fontWeight: '800' },

  // export
  exportBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
  },
  exportText: { color: '#fff', fontWeight: '800' },

  // total card
  totalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  totalTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  totalValue: { fontSize: 18, fontWeight: '900', color: '#111827' },
  totalHint: { marginTop: 4, fontSize: 11, color: '#6B7280' },

  // list cards
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
});
