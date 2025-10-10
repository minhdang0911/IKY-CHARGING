// screens/Home/HistoryExtend.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, Platform, Modal, Pressable, BackHandler, PanResponder,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrders, getDevices } from '../../apis/devices';
import SearchBar from '../../components/SearchBar';
import PaginationControls from '../../components/PaginationControls';
import EVChargingLoader from '../../components/EVChargingLoader';

/* ================= DEBUG ================= */
const DEBUG = true;
const dlog = () => {};  

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
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2,'0');
    const mi = String(d.getMinutes()).padStart(2,'0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch { return '—'; }
}

function diffDays(fromISO) {
  if (!fromISO) return Number.POSITIVE_INFINITY;
  const from = new Date(fromISO).getTime();
  return Math.floor((Date.now() - from) / (24*60*60*1000));
}

function parseMonthLabel(s) {
  const m = Number(s?.slice(0,2));
  const y = Number(s?.slice(3,7));
  if (!m || !y) return null;
  return { m, y };
}

/* ================ Dropdown custom ================ */
function Dropdown({ label, value, options, onChange, minWidth = 160 }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    dlog(`Dropdown<${label}> mount. value=`, value, 'selected=', selected);
    return () => dlog(`Dropdown<${label}> unmount.`);
  }, []);

  useEffect(() => {
    dlog(`Dropdown<${label}> value change ->`, value, 'selected=', options.find(o=>o.value===value));
  }, [value, label, options]);

  return (
    <View>
      <TouchableOpacity
        style={[styles.dropdownBtn, {minWidth}]}
        onPress={() => { dlog(`Dropdown<${label}> open. options.len=`, options.length); setOpen(true); }}
      >
        <Text style={styles.dropdownText}>
          {label}: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{selected?.label}</Text>
        </Text>
        <Icon name="expand-more" size={20} color="#0ea5e9" />
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
                  onPress={() => { dlog(`Dropdown<${label}> select ->`, opt); onChange(opt.value); setOpen(false); }}
                >
                  <Text style={[styles.optionText, active && { color: '#0369a1', fontWeight: '800' }]}>{opt.label}</Text>
                  {active && <Icon name="check" size={18} color="#0369a1" />}
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
const K_HISTORY_PREF = 'EV_HISTORY_PREF';
const FE_LIMIT = 10;
const API_LIMIT = 10;

const getOrderDevCode = (it) => String(
  it?.device_id?.device_code ??
  it?.device_id?.code ??
  it?.device_id?.id ??
  it?.device_id?._id ??
  (typeof it?.device_id === 'string' ? it?.device_id : '')
).trim();

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

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (e) => e.nativeEvent.pageX <= 24,
    onMoveShouldSetPanResponder: (e, g) => e.nativeEvent.pageX <= 24 && Math.abs(g.dx) > 8,
    onPanResponderRelease: (e, g) => { if (g.dx > 60 && Math.abs(g.dy) < 40) goBack(); },
  }), [goBack]);

  // ======= MODE =======
  const [mode, setMode] = useState('backend'); // 'backend' | 'frontend'
  const [booted, setBooted] = useState(false); // <-- chặn hiệu ứng phụ khi init

  // ======= STATE =======
  const [items, setItems] = useState([]);       // BE page hoặc FE slice
  const [allItems, setAllItems] = useState([]); // kho full cho FE
  const [loadingHard, setLoadingHard] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // filters
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [range, setRange] = useState('all');
  const [deviceCode, setDeviceCode] = useState('all'); // VALUE = device_code
  const [deviceOptions, setDeviceOptions] = useState([{ label: 'Tất cả', value: 'all' }]);
  const [selectedMonth, setSelectedMonth] = useState(''); // "MM-YYYY"

  // paginate
  const [apiPage, setApiPage] = useState(1);
  const [apiTotalPages, setApiTotalPages] = useState(1);
  const [fePage, setFePage] = useState(1);

  // Refs
  const qRef = useRef(q);
  const apiPageRef = useRef(apiPage);
  const modeRef = useRef(mode);
  useEffect(() => { qRef.current = q; }, [q]);
  useEffect(() => { apiPageRef.current = apiPage; }, [apiPage]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const qPresent = useMemo(() => q.trim().length > 0, [q]);
  const filtersActive = useMemo(() =>
    (deviceCode !== 'all') || (status !== 'all') || (range !== 'all') || !!selectedMonth,
  [deviceCode, status, range, selectedMonth]);

  // ===== Prefs & devices =====
  const hydratePrefAndDevices = useCallback(async () => {
    try {
      const pref = await AsyncStorage.getItem(K_HISTORY_PREF);
      dlog('hydratePrefAndDevices: rawPref=', pref);

      let monthLabel = '';
      let preselectedCode = 'all';
      let preselectedName = null; // bwd-compat
      let preselectedId   = null; // bwd-compat
      let snapshot = null;

      if (pref) {
        const parsed = JSON.parse(pref);
        monthLabel = typeof parsed?.month === 'string' ? parsed.month : '';
        preselectedCode = typeof parsed?.preselectedDeviceCode === 'string'
          ? parsed.preselectedDeviceCode : 'all';
        preselectedName = typeof parsed?.preselectedDeviceName === 'string' ? parsed.preselectedDeviceName : null;
        preselectedId   = parsed?.preselectedDeviceId || null;
        snapshot = Array.isArray(parsed?.devices) ? parsed.devices : null;
        dlog('hydrate parsed:', { monthLabel, preselectedCode, preselectedName, preselectedId, snapshotLen: snapshot?.length||0 });
      }

      setSelectedMonth(monthLabel);

    const buildOptsFrom = (list) => {
  // đếm số lần xuất hiện của name để biết có trùng không
  const nameCount = {};
  (list || []).forEach(d => {
    const name = String(d?.name || '').trim();
    if (name) nameCount[name] = (nameCount[name] || 0) + 1;
  });

  const opts = [{ label: 'Tất cả', value: 'all' }].concat(
    (list || []).map(d => {
      const name = String(d?.name || '').trim();
      const code = String(d?.code ?? d?.device_code ?? d?.id ?? d?._id ?? '').trim();

      // label: chỉ hiện tên; nếu tên bị trùng => kèm (#code) để phân biệt
      let label;
      if (name) {
        label = nameCount[name] > 1 ? `${name} (#${code || '-'})` : name;
      } else {
        // không có tên thì mới đành show code
        label = code || '(không tên)';
      }

      return { label, value: code || 'all' }; // VALUE = code (để filter chuẩn)
    })
  );

  dlog('buildOptsFrom ->', opts.slice(0, 6)); // optional log
  return opts;
};

      if (snapshot && snapshot.length) {
        dlog('hydrate: use SNAPSHOT devices.');
        const opts = buildOptsFrom(snapshot);
        setDeviceOptions(opts);

        if (preselectedCode === 'all' && (preselectedName || preselectedId)) {
          const found = snapshot.find(d => {
            const code = String(d?.code ?? d?.device_code ?? d?.id ?? d?._id ?? '').trim();
            const name = String(d?.name || '').trim();
            return (preselectedId && String(d?.id || d?._id || d?.device_code) === String(preselectedId))
                || (preselectedName && name === preselectedName);
          });
          preselectedCode = found ? String(found?.code ?? found?.device_code ?? found?.id ?? found?._id ?? '').trim() || 'all' : 'all';
          dlog('hydrate: mapped legacy to code ->', preselectedCode);
        }
        setDeviceCode(preselectedCode || 'all');
      } else {
        dlog('hydrate: fetch devices from API');
        const token = await getAccessTokenSafe();
        if (token) {
          const res = await getDevices(token);
          const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
          dlog('hydrate: api devices len=', list.length);
          const opts = buildOptsFrom(list);
          setDeviceOptions(opts);

          if (preselectedCode === 'all' && (preselectedName || preselectedId)) {
            const found = list.find(d => {
              const code = String(d?.device_code ?? d?._id ?? d?.id ?? '').trim();
              const name = String(d?.name || '').trim();
              return (preselectedId && String(d?._id || d?.id || d?.device_code) === String(preselectedId))
                  || (preselectedName && name === preselectedName);
            });
            preselectedCode = found ? String(found?.device_code ?? found?._id ?? found?.id ?? '').trim() || 'all' : 'all';
            dlog('hydrate: mapped legacy to code (api) ->', preselectedCode);
          }
          setDeviceCode(preselectedCode || 'all');
        }
      }

      // trả về cho init quyết định mode
      return { monthLabel, preselectedCode: preselectedCode || 'all' };
    } catch (e) {
      dlog('hydrate error:', e?.message || e);
      setDeviceOptions([{ label: 'Tất cả', value: 'all' }]);
      setDeviceCode('all');
      setSelectedMonth('');
      return { monthLabel: '', preselectedCode: 'all' };
    }
  }, []);

  /* ================= Fetchers ================= */
  const fetchBackendPage = useCallback(async (page, { showSpinner = false } = {}) => {
    if (showSpinner) setLoadingHard(true);
    try {
      const token = await getAccessTokenSafe();
      if (!token) throw new Error('No token');

      const params = { page, limit: API_LIMIT };
      const search = qRef.current.trim();
      if (search) params.search = search;

      const res = await getOrders(token, params);
      const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setItems(data);
      dlog('fetchBackendPage page=', page, 'items=', data.length);

      const lim = Number(res?.limit ?? res?.per_page ?? API_LIMIT) || API_LIMIT;
      const totalItems = Number(res?.total ?? 0);
      const tp = res?.totalPages ?? res?.total_pages ?? (totalItems ? Math.ceil(totalItems/lim) : 1);
      setApiTotalPages(tp || 1);
      dlog('fetchBackendPage totalPages=', tp || 1);
    } catch (e) {
      console.warn('fetchBackendPage error:', e?.message || e);
      setItems([]); setApiTotalPages(1);
    } finally {
      if (showSpinner) setLoadingHard(false);
    }
  }, []);

  const fetchAllNoParams = useCallback(async ({ showSpinner = true } = {}) => {
    if (showSpinner) setLoadingHard(true);
    try {
      const token = await getAccessTokenSafe();
      if (!token) throw new Error('No token');

      const first = await getOrders(token, { page: 1, limit: 1000 });
      let list = Array.isArray(first?.data) ? first.data : (Array.isArray(first) ? first : []);
      const lim = Number(first?.limit ?? first?.per_page ?? 1000) || 1000;
      const totalItems = Number(first?.total ?? 0);
      let totalPages = first?.totalPages ?? first?.total_pages ?? (totalItems ? Math.ceil(totalItems/lim) : 1);
      if (!totalPages || Number.isNaN(totalPages)) totalPages = 1;

      for (let p = 2; p <= totalPages; p += 1) {
        // eslint-disable-next-line no-await-in-loop
        const chunk = await getOrders(token, { page: p, limit: 1000 });
        const arr = Array.isArray(chunk?.data) ? chunk.data : (Array.isArray(chunk) ? chunk : []);
        list = list.concat(arr);
      }

      setAllItems(list);
      const uniqCodes = Array.from(new Set(list.map(getOrderDevCode))).slice(0, 10);
      dlog('fetchAllNoParams total=', list.length, 'sampleDevCodes=', uniqCodes);
    } catch (e) {
      console.warn('fetchAllNoParams error:', e?.message || e);
      setAllItems([]);
    } finally {
      if (showSpinner) setLoadingHard(false);
    }
  }, []);

  /* ================= INIT – tránh race ================= */
  useEffect(() => {
    (async () => {
      const { monthLabel, preselectedCode } = await hydratePrefAndDevices();
      const shouldFrontend = !!monthLabel || (preselectedCode && preselectedCode !== 'all');
      dlog('init decide:', { monthLabel, preselectedCode, shouldFrontend });

      if (shouldFrontend) {
        setMode('frontend'); setFePage(1);
        dlog('init: mode=frontend');
        await fetchAllNoParams({ showSpinner: true });
      } else {
        setMode('backend'); setApiPage(1);
        dlog('init: mode=backend');
        await fetchBackendPage(1, { showSpinner: true });
      }

      setBooted(true); // <-- unlock các effect khác
    })();
  }, [hydratePrefAndDevices, fetchBackendPage, fetchAllNoParams]);

  // Recompute mode khi q/filters đổi (chỉ sau khi booted)
  useEffect(() => {
    if (!booted) return;
    dlog('mode decision: qPresent=', qPresent, 'filtersActive=', filtersActive);
    if (qPresent) setMode('backend');
    else if (filtersActive) setMode('frontend');
    else setMode('backend');
  }, [booted, qPresent, filtersActive]);

  // Khi filters đổi, fetch tương ứng (chỉ sau khi booted)
  useEffect(() => {
    (async () => {
      if (!booted) return;
      dlog('filters changed -> deviceCode=', deviceCode, 'status=', status, 'range=', range, 'month=', selectedMonth);
      if (qPresent) return;
      if (filtersActive) {
        if (modeRef.current !== 'frontend') setMode('frontend');
        setFePage(1);
        await fetchAllNoParams({ showSpinner: true });
      } else {
        if (modeRef.current !== 'backend') setMode('backend');
        setApiPage(1);
        await fetchBackendPage(1, { showSpinner: true });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booted, deviceCode, status, range, selectedMonth]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      dlog('pull-to-refresh');
      await hydratePrefAndDevices();
      if (modeRef.current === 'backend') {
        await fetchBackendPage(apiPageRef.current, { showSpinner: false });
      } else {
        await fetchAllNoParams({ showSpinner: false });
      }
    } finally { setRefreshing(false); }
  }, [hydratePrefAndDevices, fetchBackendPage, fetchAllNoParams]);

  /* ================= Client filtering (FE mode) ================= */
  const filteredFE = useMemo(() => {
    if (mode !== 'frontend') return items;
    const list = allItems || [];

    const result = list.filter((it) => {
      const devCode = getOrderDevCode(it);
      const matchDevice = deviceCode === 'all' || (devCode && devCode === deviceCode);

      const st = String(it?.status || '').toLowerCase();
      const matchStatus = status === 'all' || st === status;

      let matchRange = true;
      if (range === '7d')  matchRange = diffDays(it?.createdAt) <= 7;
      if (range === '30d') matchRange = diffDays(it?.createdAt) <= 30;

      let matchMonth = true;
      if (selectedMonth) {
        const p = parseMonthLabel(selectedMonth);
        if (p) {
          const d = new Date(it?.createdAt);
          matchMonth = (d.getMonth() + 1 === p.m && d.getFullYear() === p.y);
        }
      }
      return matchDevice && matchStatus && matchRange && matchMonth;
    });

    if (DEBUG) {
      const allLen = list.length, resLen = result.length;
      const first3Before = list.slice(0, 3).map(o => ({ orderId: o?.orderId, code: getOrderDevCode(o), status: o?.status }));
      const first3After  = result.slice(0, 3).map(o => ({ orderId: o?.orderId, code: getOrderDevCode(o), status: o?.status }));
      const uniqCodesBefore = Array.from(new Set(list.map(getOrderDevCode)));
      const uniqCodesAfter  = Array.from(new Set(result.map(getOrderDevCode)));
      dlog('FILTER SUMMARY', {
        mode, allLen, resLen, deviceCode, status, range, month: selectedMonth,
        uniqCodesBefore: uniqCodesBefore.slice(0, 10),
        uniqCodesAfter: uniqCodesAfter.slice(0, 10),
        sampleBefore: first3Before, sampleAfter: first3After
      });
    }
    return result;
  }, [mode, items, allItems, deviceCode, status, range, selectedMonth]);

  // Tính trang & data hiển thị
  const totalPagesRender = useMemo(() => {
    if (mode === 'backend') return Math.max(1, apiTotalPages);
    return Math.max(1, Math.ceil((filteredFE?.length || 0) / FE_LIMIT));
  }, [mode, apiTotalPages, filteredFE?.length]);

  const currentPage = mode === 'backend' ? apiPage : fePage;

  const pagedData = useMemo(() => {
    if (mode === 'backend') return items;
    const start = (fePage - 1) * FE_LIMIT;
    return filteredFE.slice(start, start + FE_LIMIT);
  }, [mode, items, filteredFE, fePage]);

  // Chuyển trang
  const handlePrev = useCallback(async () => {
    if (modeRef.current === 'backend') {
      const nextPage = Math.max(1, apiPageRef.current - 1);
      if (nextPage === apiPageRef.current) return;
      setApiPage(nextPage); apiPageRef.current = nextPage;
      await fetchBackendPage(nextPage, { showSpinner: false });
    } else {
      setFePage((p) => Math.max(1, p - 1));
    }
  }, [fetchBackendPage]);

  const handleNext = useCallback(async () => {
    if (modeRef.current === 'backend') {
      const nextPage = Math.min(totalPagesRender, apiPageRef.current + 1);
      if (nextPage === apiPageRef.current) return;
      setApiPage(nextPage); apiPageRef.current = nextPage;
      await fetchBackendPage(nextPage, { showSpinner: false });
    } else {
      setFePage((p) => Math.min(totalPagesRender, p + 1));
    }
  }, [fetchBackendPage, totalPagesRender]);

  // ===== Render item =====
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
            <Icon name="receipt-long" size={14} color={color} />
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

        <View style={styles.row}><Icon name="account-balance-wallet" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Phương thức</Text><Text style={styles.v}>{String(item?.payment_method || '').toUpperCase() || '—'}</Text></View>

        <View style={styles.row}><Icon name="event" size={18} color="#64748b" style={{ marginRight: 6 }} />
          <Text style={styles.k}>Ngày tạo</Text><Text style={styles.v}>{fmtDate(item?.createdAt)}</Text></View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}><Icon name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Lịch sử đơn hàng</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.filterBar}>
        {selectedMonth ? (
          <View style={styles.monthChipRow}>
            <TouchableOpacity
              style={[styles.monthChip, mode === 'frontend' && { backgroundColor: '#c7d2fe' }]}
              onPress={async () => {
                dlog('handleToggleFrontMode. selectedMonth=', selectedMonth, 'filtersActive=', filtersActive, 'qPresent=', qPresent);
                if (selectedMonth) { setMode('frontend'); setFePage(1); await fetchAllNoParams({ showSpinner: true }); }
              }}
            >
              <Icon name="calendar-month" size={16} color="#1d4ed8" />
              <Text style={styles.monthChipText}>{mode === 'frontend' ? `Đang lọc: ${selectedMonth}` : `Chỉ xem tháng: ${selectedMonth}`}</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <SearchBar
          placeholder="Tìm theo mã đơn (VD: 2509200001)"
          value={q}
          onChange={(text) => { setQ(text); setApiPage(1); }}
          onClear={() => { setQ(''); setApiPage(1); }}
          onSubmit={async () => { dlog('handleSearchSubmit q=', q); setMode('backend'); setApiPage(1); await fetchBackendPage(1, { showSpinner: true }); }}
        />

        <View style={styles.filterRow}>
          <Dropdown
            label="Thiết bị"
            value={deviceCode}
            onChange={(v) => {
              dlog('onChange deviceCode ->', v, '(prev=', deviceCode, ')');
              setDeviceCode(v);
              (async () => {
                try {
                  const s = await AsyncStorage.getItem(K_HISTORY_PREF);
                  const prev = s ? JSON.parse(s) : {};
                  await AsyncStorage.setItem(K_HISTORY_PREF, JSON.stringify({ ...prev, preselectedDeviceCode: v || 'all' }));
                  dlog('persist preselectedDeviceCode =', v || 'all');
                } catch (e) { dlog('persist preselectedDeviceCode error:', e?.message || e); }
              })();
            }}
            options={deviceOptions}
            minWidth={200}
          />

          <Dropdown
            label="Trạng thái"
            value={status}
            onChange={(v) => { dlog('onChange status ->', v); setStatus(v); }}
            options={[
              { label: 'Tất cả', value: 'all' },
              { label: 'Đang xử lý', value: 'pending' },
              { label: 'Hoàn thành', value: 'paid' },
              { label: 'Hoàn tất', value: 'completed' },
              { label: 'Đã hủy', value: 'canceled' },
              { label: 'Thất bại', value: 'failed' },
            ]}
          />

          <Dropdown
            label="Khoảng thời gian"
            value={range}
            onChange={(v) => { dlog('onChange range ->', v); setRange(v); }}
            options={[
              { label: 'Tất cả', value: 'all' },
              { label: '7 ngày', value: '7d' },
              { label: '30 ngày', value: '30d' },
            ]}
          />
        </View>
      </View>

      {loadingHard ? (
        <View style={styles.center}><EVChargingLoader message="Đang tải dữ liệu đơn hàng…" /></View>
      ) : (
        <>
          <FlatList
            data={mode === 'backend' ? items : pagedData}
            keyExtractor={(it) => String(it?._id || it?.orderId || Math.random())}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={<View style={styles.emptyWrap}><Icon name="hourglass-empty" size={28} color="#94a3b8" /><Text style={styles.emptyText}>Không có đơn hàng phù hợp</Text></View>}
          />

          <PaginationControls page={currentPage} totalPages={totalPagesRender} onPrev={handlePrev} onNext={handleNext} />
        </>
      )}
    </SafeAreaView>
  );
}

/* ================= styles ================= */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },
  header: { backgroundColor: '#4A90E2', paddingHorizontal: 16, paddingTop: Platform.OS==='ios'?16:12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center' },
  backButton: { padding: 6, marginRight: 6 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
  filterBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 },
  monthChipRow: { marginBottom: 8 },
  monthChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#e0e7ff', borderWidth: 1, borderColor: '#c7d2fe', gap: 6 },
  monthChipText: { color: '#1d4ed8', fontWeight: '800' },
  filterRow: { flexDirection: 'row', gap: 10, marginTop: 10, flexWrap: 'wrap' },
  dropdownBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1, borderColor: '#e2e8f0', justifyContent: 'space-between' },
  dropdownText: { color: '#0369a1', fontWeight: '600' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden' },
  optionRow: { paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  optionText: { color: '#0f172a', fontSize: 14 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#111827' },
  sub: { marginTop: 2, fontSize: 12, color: '#6b7280' },
  bold: { fontWeight: '800', color: '#111827' },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, marginLeft: 8 },
  statusText: { fontSize: 12, fontWeight: '700', marginLeft: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee' },
  k: { flex: 1, fontSize: 13, color: '#6b7280' },
  v: { fontSize: 13, fontWeight: '700', color: '#111827' },
  emptyWrap: { padding: 24, alignItems: 'center' },
  emptyText: { marginTop: 8, color: '#94a3b8', fontWeight: '600' },
});
