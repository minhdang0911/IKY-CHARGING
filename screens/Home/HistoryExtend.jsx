// screens/Home/HistoryExtend.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, TouchableOpacity, FlatList,
  RefreshControl, Platform, BackHandler, PanResponder, Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrders, getDevices } from '../../apis/devices';

import PaginationControls from '../../components/PaginationControls';
import EVChargingLoader from '../../components/EVChargingLoader';

import HistoryFilterBar from '../../components/HistoryFilterBar';
import DateTimeRangePickerModal from '../../components/DateTimeRangePickerModal';

// icons
import icBack from '../../assets/img/ic_back.png';
import icStore from '../../assets/img/ic_store.png';
import icCategory from '../../assets/img/ic_category.png';
import icSchedule from '../../assets/img/ic_schedule.png';
import icWallet from '../../assets/img/ic_wallet.png';
import icEvent from '../../assets/img/ic_event.png';
import icHourglass from '../../assets/img/ic_hourglass.png';
import icReceipt from '../../assets/img/ic_receipt.png';

const K_HISTORY_PREF = 'EV_HISTORY_PREF';
const FE_LIMIT = 10;
const API_LIMIT = 10;

const STATUS_COLOR = {
  pending: '#f59e0b',
  paid: '#2563eb',
  completed: '#16a34a',
  canceled: '#ef4444',
  failed: '#ef4444',
  default: '#6b7280',
};

// helpers
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
function inCustomRangeTs(createdAtISO, fromTs, toTs) {
  if (!fromTs && !toTs) return true;
  const t = new Date(createdAtISO).getTime();
  if (Number.isNaN(t)) return false;
  if (fromTs != null && t < fromTs) return false;
  if (toTs   != null && t > toTs)   return false;
  return true;
}
function getOrderDevCode(it) {
  return String(
    it?.device_id?.device_code ??
    it?.device_id?.code ??
    it?.device_id?.id ??
    it?.device_id?._id ??
    (typeof it?.device_id === 'string' ? it?.device_id : '')
  ).trim();
}
async function getAccessTokenSafe() {
  const keys = ['access_token', 'accessToken', 'ACCESS_TOKEN', 'token', 'auth_token'];
  for (const k of keys) {
    // eslint-disable-next-line no-await-in-loop
    const v = await AsyncStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

export default function HistoryExtend({ navigateToScreen }) {
  // back gesture
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

  // MODE / FETCH STATE
  const [mode, setMode] = useState('backend'); // 'backend' | 'frontend'
  const [booted, setBooted] = useState(false);
  const [loadingHard, setLoadingHard] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // DATA
  const [items, setItems] = useState([]);
  const [allItems, setAllItems] = useState([]);

  // FILTER STATE
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('all');
  const [range, setRange] = useState('all');
  const [deviceCode, setDeviceCode] = useState('all');
  const [deviceOptions, setDeviceOptions] = useState([{ label: 'Tất cả', value: 'all' }]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [portFilter, setPortFilter] = useState('all');

  // custom time range (applied filters)
  const [customFromTs, setCustomFromTs] = useState(null);
  const [customToTs, setCustomToTs] = useState(null);

  // modal / temp range state
  const [showRangeModal, setShowRangeModal] = useState(false);
  const [tmpFromTs, setTmpFromTs] = useState(null);
  const [tmpToTs, setTmpToTs] = useState(null);
  const [iosPickerTarget, setIosPickerTarget] = useState(null);
  const [iosPickerValue, setIosPickerValue] = useState(new Date());

  // PAGINATION
  const [apiPage, setApiPage] = useState(1);
  const [apiTotalPages, setApiTotalPages] = useState(1);
  const [fePage, setFePage] = useState(1);

  const qRef = useRef(q);
  const apiPageRef = useRef(apiPage);
  const modeRef = useRef(mode);
  useEffect(() => { qRef.current = q; }, [q]);
  useEffect(() => { apiPageRef.current = apiPage; }, [apiPage]);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // check filters active (để auto chuyển mode frontend)
  const filtersActive = useMemo(() => (
    (deviceCode !== 'all') ||
    (status !== 'all') ||
    (range !== 'all') ||
    !!selectedMonth ||
    (portFilter !== 'all') ||
    (customFromTs != null || customToTs != null)
  ), [deviceCode, status, range, selectedMonth, portFilter, customFromTs, customToTs]);

  /* ===== Prefs & devices ===== */
  const hydratePrefAndDevices = useCallback(async () => {
    try {
      const pref = await AsyncStorage.getItem(K_HISTORY_PREF);

      let monthLabel = '';
      let preselectedCode = 'all';
      let preselectedName = null;
      let preselectedId   = null;
      let snapshot = null;

      if (pref) {
        const parsed = JSON.parse(pref);
        monthLabel = typeof parsed?.month === 'string' ? parsed.month : '';
        preselectedCode =
          typeof parsed?.preselectedDeviceCode === 'string'
            ? parsed.preselectedDeviceCode
            : 'all';
        preselectedName =
          typeof parsed?.preselectedDeviceName === 'string'
            ? parsed.preselectedDeviceName
            : null;
        preselectedId   = parsed?.preselectedDeviceId || null;
        snapshot = Array.isArray(parsed?.devices) ? parsed.devices : null;
      }

      setSelectedMonth(monthLabel);

      const buildOptsFrom = (list) => {
        const nameCount = {};
        (list || []).forEach(d => {
          const name = String(d?.name || '').trim();
          if (name) nameCount[name] = (nameCount[name] || 0) + 1;
        });

        const opts = [{ label: 'Tất cả', value: 'all' }].concat(
          (list || []).map(d => {
            const name = String(d?.name || '').trim();
            const code = String(
              d?.code ?? d?.device_code ?? d?.id ?? d?._id ?? ''
            ).trim();

            let label;
            if (name) {
              label = (nameCount[name] > 1)
                ? `${name} (#${code || '-'})`
                : name;
            } else {
              label = code || '(không tên)';
            }
            return { label, value: code || 'all' };
          })
        );
        return opts;
      };

      if (snapshot && snapshot.length) {
        const opts = buildOptsFrom(snapshot);
        setDeviceOptions(opts);

        if (preselectedCode === 'all' && (preselectedName || preselectedId)) {
          const found = snapshot.find(d => {
            const code = String(
              d?.code ?? d?.device_code ?? d?.id ?? d?._id ?? ''
            ).trim();
            const name = String(d?.name || '').trim();
            return (
              (preselectedId && String(d?.id || d?._id || d?.device_code) === String(preselectedId)) ||
              (preselectedName && name === preselectedName)
            );
          });
          preselectedCode = found
            ? String(
                found?.code ??
                found?.device_code ??
                found?.id ??
                found?._id ??
                ''
              ).trim() || 'all'
            : 'all';
        }
        setDeviceCode(preselectedCode || 'all');
      } else {
        const token = await getAccessTokenSafe();
        if (token) {
          const res = await getDevices(token);
          const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
          const opts = buildOptsFrom(list);
          setDeviceOptions(opts);

          if (preselectedCode === 'all' && (preselectedName || preselectedId)) {
            const found = list.find(d => {
              const code = String(
                d?.device_code ?? d?._id ?? d?.id ?? ''
              ).trim();
              const name = String(d?.name || '').trim();
              return (
                (preselectedId && String(d?._id || d?.id || d?.device_code) === String(preselectedId)) ||
                (preselectedName && name === preselectedName)
              );
            });
            preselectedCode = found
              ? String(
                  found?.device_code ?? found?._id ?? found?.id ?? ''
                ).trim() || 'all'
              : 'all';
          }
          setDeviceCode(preselectedCode || 'all');
        }
      }
    } catch (e) {
      setDeviceOptions([{ label: 'Tất cả', value: 'all' }]);
      setDeviceCode('all');
      setSelectedMonth('');
    }
  }, []);

  /* ================= Fetchers ================= */
  const fetchBackendPage = useCallback(
    async (page, { showSpinner = false } = {}) => {
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

        const lim = Number(res?.limit ?? res?.per_page ?? API_LIMIT) || API_LIMIT;
        const totalItems = Number(res?.total ?? 0);
        const tp =
          res?.totalPages ??
          res?.total_pages ??
          (totalItems ? Math.ceil(totalItems / lim) : 1);
        setApiTotalPages(tp || 1);
      } catch (e) {
        setItems([]);
        setApiTotalPages(1);
      } finally {
        if (showSpinner) setLoadingHard(false);
      }
    },
    []
  );

  const fetchAllNoParams = useCallback(
    async ({ showSpinner = true } = {}) => {
      if (showSpinner) setLoadingHard(true);
      try {
        const token = await getAccessTokenSafe();
        if (!token) throw new Error('No token');

        const first = await getOrders(token, { page: 1, limit: 1000 });
        let list = Array.isArray(first?.data) ? first.data : (Array.isArray(first) ? first : []);
        const lim = Number(first?.limit ?? first?.per_page ?? 1000) || 1000;
        const totalItems = Number(first?.total ?? 0);
        let totalPages =
          first?.totalPages ??
          first?.total_pages ??
          (totalItems ? Math.ceil(totalItems / lim) : 1);
        if (!totalPages || Number.isNaN(totalPages)) totalPages = 1;

        for (let p = 2; p <= totalPages; p += 1) {
          const chunk = await getOrders(token, { page: p, limit: 1000 });
          const arr = Array.isArray(chunk?.data) ? chunk.data : (Array.isArray(chunk) ? chunk : []);
          list = list.concat(arr);
        }

        setAllItems(list);
      } catch (e) {
        setAllItems([]);
      } finally {
        if (showSpinner) setLoadingHard(false);
      }
    },
    []
  );

  /* ================= INIT ================= */
  useEffect(() => {
    (async () => {
      await hydratePrefAndDevices();

      // quyết định mode đầu
      const shouldFrontend =
        !!selectedMonth ||
        (deviceCode && deviceCode !== 'all');

      if (shouldFrontend) {
        setMode('frontend');
        setFePage(1);
        await fetchAllNoParams({ showSpinner: true });
      } else {
        setMode('backend');
        setApiPage(1);
        await fetchBackendPage(1, { showSpinner: true });
      }
      setBooted(true);
    })();
  }, [hydratePrefAndDevices, fetchBackendPage, fetchAllNoParams, selectedMonth, deviceCode]);

  // auto switch mode when filters toggle
  useEffect(() => {
    if (!booted) return;
    if (q.trim()) setMode('backend');
    else if (filtersActive) setMode('frontend');
    else setMode('backend');
  }, [booted, q, filtersActive]);

  // refetch data when filters change AND no search
  useEffect(() => {
    (async () => {
      if (!booted) return;
      if (q.trim()) return;

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
  }, [booted, filtersActive, fetchBackendPage, fetchAllNoParams, q]);

  // pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await hydratePrefAndDevices();
      if (modeRef.current === 'backend') {
        await fetchBackendPage(apiPageRef.current, { showSpinner: false });
      } else {
        await fetchAllNoParams({ showSpinner: false });
      }
    } finally {
      setRefreshing(false);
    }
  }, [hydratePrefAndDevices, fetchBackendPage, fetchAllNoParams]);

  /* ================= FILTER APPLY / PAGINATION ================= */
  const filteredFE = useMemo(() => {
    if (mode !== 'frontend') return items;
    const list = allItems || [];
    return list.filter((it) => {
      const devCode = getOrderDevCode(it);
      const matchDevice = deviceCode === 'all' || (devCode && devCode === deviceCode);

      const st = String(it?.status || '').toLowerCase();
      const matchStatus = status === 'all' || st === status;

      let matchRangePreset = true;
      if (range === '7d')  matchRangePreset = diffDays(it?.createdAt) <= 7;
      if (range === '30d') matchRangePreset = diffDays(it?.createdAt) <= 30;

      let matchMonth = true;
      if (selectedMonth) {
        const p = parseMonthLabel(selectedMonth);
        if (p) {
          const d = new Date(it?.createdAt);
          matchMonth = (d.getMonth() + 1 === p.m && d.getFullYear() === p.y);
        }
      }

      const portNum = it?.portNumber ?? it?.port ?? it?.connector ?? null;
      const matchPort = (portFilter === 'all') ||
        (String(portNum || '') === String(portFilter));

      const matchCustom = inCustomRangeTs(it?.createdAt, customFromTs, customToTs);

      return (
        matchDevice &&
        matchStatus &&
        matchRangePreset &&
        matchMonth &&
        matchPort &&
        matchCustom
      );
    });
  }, [
    mode,
    items,
    allItems,
    deviceCode,
    status,
    range,
    selectedMonth,
    portFilter,
    customFromTs,
    customToTs,
  ]);

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

  /* ================== RENDER ITEM ================== */
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
              Mã đơn:{' '}
              <Text style={styles.bold}>{item?.orderId || '—'}</Text>
              {' · '}Cổng{' '}
              <Text style={styles.bold}>{item?.portNumber ?? '—'}</Text>
            </Text>
          </View>

          <View
            style={[
              styles.statusPill,
              { backgroundColor: `${color}1A`, borderColor: color },
            ]}
          >
            <Image
              source={icReceipt}
              style={{
                width: 14,
                height: 14,
                tintColor: color,
                marginRight: 4,
              }}
            />
            <Text style={[styles.statusText, { color }]}>{viStatus(st)}</Text>
          </View>
        </View>

        <View style={styles.row}>
          <Image
            source={icStore}
            style={{
              width: 18,
              height: 18,
              tintColor: '#64748b',
              marginRight: 6,
            }}
          />
          <Text style={styles.k}>Đại lý</Text>
          <Text style={styles.v}>{agent?.name || '—'}</Text>
        </View>

        <View style={styles.row}>
          <Image
            source={icCategory}
            style={{
              width: 18,
              height: 18,
              tintColor: '#64748b',
              marginRight: 6,
            }}
          />
          <Text style={styles.k}>Gói</Text>
          <Text style={styles.v}>{plan?.name || '—'}</Text>
        </View>

        <View style={styles.row}>
          <Image
            source={icSchedule}
            style={{
              width: 18,
              height: 18,
              tintColor: '#64748b',
              marginRight: 6,
            }}
          />
          <Text style={styles.k}>Thời lượng</Text>
          <Text style={styles.v}>
            {plan?.duration_minutes
              ? `${plan.duration_minutes} phút`
              : '—'}
          </Text>
        </View>

        <View style={styles.row}>
          <Image
            source={icWallet}
            style={{
              width: 18,
              height: 18,
              tintColor: '#64748b',
              marginRight: 6,
            }}
          />
          <Text style={styles.k}>Số tiền</Text>
          <Text style={styles.v}>{fmtMoney(item?.amount)}</Text>
        </View>

        <View style={styles.row}>
          <Image
            source={icWallet}
            style={{
              width: 18,
              height: 18,
              tintColor: '#64748b',
              marginRight: 6,
            }}
          />
          <Text style={styles.k}>Phương thức</Text>
          <Text style={styles.v}>
            {String(item?.payment_method || '').toUpperCase() || '—'}
          </Text>
        </View>

        <View className="row" style={styles.row}>
          <Image
            source={icEvent}
            style={{
              width: 18,
              height: 18,
              tintColor: '#64748b',
              marginRight: 6,
            }}
          />
          <Text style={styles.k}>Ngày tạo</Text>
          <Text style={styles.v}>{fmtDate(item?.createdAt)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  /* ====== HANDLERS CHO MODAL DATETIME ====== */
  // mở modal
  const openRangeEditor = () => {
    setTmpFromTs(customFromTs);
    setTmpToTs(customToTs);
    setShowRangeModal(true);
    setIosPickerTarget(null);
  };

  const applyTmpRange = () => {
    setCustomFromTs(tmpFromTs ?? null);
    setCustomToTs(tmpToTs ?? null);
    setShowRangeModal(false);
    setIosPickerTarget(null);
  };

  const clearRange = () => {
    setTmpFromTs(null);
    setTmpToTs(null);
    setCustomFromTs(null);
    setCustomToTs(null);
    setShowRangeModal(false);
    setIosPickerTarget(null);
  };

  // label ngắn gọn hiển thị ở filter bar
  const rangeLabelText = useMemo(() => {
    if (customFromTs != null || customToTs != null) {
      const a = (customFromTs != null)
        ? fmtDate(new Date(customFromTs).toISOString())
        : '...';
      const b = (customToTs != null)
        ? fmtDate(new Date(customToTs).toISOString())
        : '...';
      return `${a} → ${b}`;
    }
    return 'Tất cả';
  }, [customFromTs, customToTs]);

  // options cho dropdown port (gộp items + allItems)
  const portOptions = useMemo(() => {
    const setPorts = new Set();
    const sourceAll = (allItems.length > 0 ? allItems : items);
    (sourceAll || []).forEach(o => {
      const p = o?.portNumber ?? o?.port ?? o?.connector;
      if (p !== undefined && p !== null && p !== '') {
        setPorts.add(String(p));
      }
    });
    const arr = Array.from(setPorts).sort((a,b)=>Number(a)-Number(b));
    return [{ label: 'Tất cả cổng', value: 'all' }].concat(
      arr.map(p => ({ label: `Cổng ${p}`, value: String(p) }))
    );
  }, [allItems, items]);

  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={{ padding: 6 }}>
          <Image
            source={icBack}
            style={{ width: 24, height: 24, tintColor: '#fff' }}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Lịch sử đơn hàng</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* FILTER BAR */}
      <HistoryFilterBar
        // search
        q={q}
        setQ={setQ}
        onSubmitSearch={async () => {
          setMode('backend');
          setApiPage(1);
          await fetchBackendPage(1, { showSpinner: true });
        }}

        // dropdown data
        deviceCode={deviceCode}
        setDeviceCode={(v) => {
          setDeviceCode(v);
          (async () => {
            try {
              const s = await AsyncStorage.getItem(K_HISTORY_PREF);
              const prev = s ? JSON.parse(s) : {};
              await AsyncStorage.setItem(
                K_HISTORY_PREF,
                JSON.stringify({
                  ...prev,
                  preselectedDeviceCode: v || 'all',
                })
              );
            } catch (e) {}
          })();
        }}
        deviceOptions={deviceOptions}

        status={status}
        setStatus={setStatus}

        range={range}
        setRange={setRange}

        selectedMonth={selectedMonth}
        mode={mode}
        fetchAllNoParams={fetchAllNoParams}

        portFilter={portFilter}
        setPortFilter={setPortFilter}
        portOptions={portOptions}

        // custom time range mini label
        rangeLabelText={rangeLabelText}
        openRangeEditor={openRangeEditor}
      />

      {/* LIST */}
      {loadingHard ? (
        <View style={styles.center}>
          <EVChargingLoader message="Đang tải dữ liệu đơn hàng…" />
        </View>
      ) : (
        <>
          <FlatList
            data={mode === 'backend' ? items : pagedData}
            keyExtractor={(it) =>
              String(it?._id || it?.orderId || Math.random())
            }
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            contentContainerStyle={{ padding: 16, paddingBottom: 8 }}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Image
                  source={icHourglass}
                  style={{
                    width: 28,
                    height: 28,
                    tintColor: '#94a3b8',
                  }}
                />
                <Text style={styles.emptyText}>
                  Không có đơn hàng phù hợp
                </Text>
              </View>
            }
          />

          <PaginationControls
            page={currentPage}
            totalPages={totalPagesRender}
            onPrev={handlePrev}
            onNext={handleNext}
            showGoto
            onJump={async (n) => {
              if (modeRef.current === 'backend') {
                setApiPage(n);
                apiPageRef.current = n;
                await fetchBackendPage(n, { showSpinner: true });
              } else {
                setFePage(n);
              }
            }}
          />
        </>
      )}

      {/* MODAL PICKER RANGE */}
      <DateTimeRangePickerModal
        visible={showRangeModal}
        onClose={() => {
          setShowRangeModal(false);
          setIosPickerTarget(null);
        }}
        tmpFromTs={tmpFromTs}
        tmpToTs={tmpToTs}
        setTmpFromTs={setTmpFromTs}
        setTmpToTs={setTmpToTs}
        iosPickerTarget={iosPickerTarget}
        setIosPickerTarget={setIosPickerTarget}
        iosPickerValue={iosPickerValue}
        setIosPickerValue={setIosPickerValue}
        applyTmpRange={applyTmpRange}
        clearRange={clearRange}
        openRangeEditor={openRangeEditor} // not really needed inside, but fine
        setShowRangeModal={setShowRangeModal}
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
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },

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
