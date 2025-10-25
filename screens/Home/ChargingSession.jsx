// screens/Home/ChargingSession.jsx
// WEB ONLY – FE paginate khi bật filter theo month/port/date
// Version pro: summary kWh, export Excel chuẩn doanh nghiệp, sheet theo tháng, info đại lý

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView, View, Text, StyleSheet, TouchableOpacity,
  FlatList, RefreshControl, BackHandler, PanResponder, Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSessions } from '../../apis/devices';
import SearchBar from '../../components/SearchBar';
import PaginationControls from '../../components/PaginationControls';
import WebFilters from '../../components/WebFilters';

// lấy info đại lý
import useLanguage from '../../Hooks/useLanguage';
import useAgentInfo from '../../Hooks/useAgentInfo';
import { STRINGS } from '../../i18n/strings';

// Excel export libs
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

/* =============== helpers chung =============== */
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

function onlyDateStr(dt) {
  if (!dt) return '—';
  try {
    const d = new Date(dt);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch { return '—'; }
}

function monthKey(dt) {
  if (!dt) return null;
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`; // "2025-10"
}

function monthLabelDash(key) {
  if (!key || key === 'all') return 'all';
  const [y, m] = key.split('-');
  return `${m}-${y}`; // ví dụ "10-2025"
}

function monthLabelPretty(key) {
  if (!key || key === 'all') return 'Toàn bộ';
  const [y, m] = key.split('-');
  return `Tháng ${m}/${y}`;
}

function isInRange(dt, from, to) {
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return false;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

// ngày nhanh
function startOfDayLocal(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0,0);
}
function endOfDayLocal(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59,999);
}

// năng lượng kWh an toàn
function getEnergyKwh(it) {
  const raw = it?.energy_used_kwh ?? it?.energy_kwh ?? it?.energy ?? 0;
  const num = Number(raw);
  return Number.isFinite(num) ? num : 0;
}

/* =============== Excel helpers chuyên nghiệp =============== */

// gom theo thiết bị để làm sheet summary thiết bị
function groupByDevice(sessions) {
  const map = new Map(); // key: device name -> {kwhTotal, count}
  for (const s of sessions) {
    const devName = s?.device_id?.name || 'Không rõ thiết bị';
    const prev = map.get(devName) || { kwhTotal: 0, count: 0 };
    prev.kwhTotal += getEnergyKwh(s);
    prev.count += 1;
    map.set(devName, prev);
  }

  let grandTotal = 0;
  for (const [, val] of map) grandTotal += val.kwhTotal;

  const rows = [];
  for (const [name, val] of map) {
    const pct = grandTotal > 0 ? (val.kwhTotal / grandTotal) * 100 : 0;
    rows.push({
      'Thiết bị': name,
      'Số phiên': val.count,
      'Tổng kWh': Number(val.kwhTotal.toFixed(3)),
      'Tỉ lệ (%)': Number(pct.toFixed(2)),
    });
  }

  rows.sort((a, b) => b['Tổng kWh'] - a['Tổng kWh']);

  return { rows, grandTotal: Number(grandTotal.toFixed(3)) };
}

// group theo tháng -> { '2025-10': { rows: [...], totalKwh: number } }
function groupByMonth(sessions) {
  const bucket = new Map();

  for (const it of sessions) {
    const key = monthKey(it?.startTime || it?.endTime);
    if (!key) continue; // 🔥 bỏ qua record không có start/endTime hợp lệ

    const arr = bucket.get(key) || [];
    arr.push(it);
    bucket.set(key, arr);
  }

  const result = [];
  for (const [key, arr] of bucket.entries()) {
    let kwhSum = 0;
    const detailRows = arr.map((it, idx) => {
      kwhSum += getEnergyKwh(it);
      return {
        'STT': idx + 1,
        'Mã đơn': String(it?.order_id ?? ''),
        'Thiết bị': String(it?.device_id?.name ?? ''),
        'Cổng': String(it?.portNumber ?? ''),
        'Bắt đầu': fmt(it?.startTime),
        'Kết thúc': fmt(it?.endTime),
        'Năng lượng (kWh)': Number(getEnergyKwh(it).toFixed(3)),
        'Trạng thái': viStatus(it?.status),
      };
    });

    result.push({
      monthKey: key,
      monthLabel: monthLabelPretty(key),
      totalKwh: Number(kwhSum.toFixed(3)),
      detailRows,
    });
  }

  result.sort((a, b) => (a.monthKey > b.monthKey ? -1 : 1));
  return result;
}

// build workbook => trả về XLSX workbook
function buildWorkbookPro({
  sessions,
  summaryLabel,        // ví dụ "Tháng 10/2025" hoặc "Toàn bộ dữ liệu"
  totalKwhFiltered,    // tổng kWh filter hiện tại
  reportDate = new Date(),
  companyName = 'IKY Smart Utility',
  authorName = 'Hệ thống',
  agentInfo,           // thông tin đại lý
  selectedMonthForExport, // string 'YYYY-MM' hoặc 'all'
}) {
  // ===== Sheet "Tong_quan" =====
  const dateStr = `${String(reportDate.getDate()).padStart(2,'0')}/${String(reportDate.getMonth()+1).padStart(2,'0')}/${reportDate.getFullYear()}`;

  const overviewAOA = [
    ['BÁO CÁO NĂNG LƯỢNG SẠC'],
    [companyName],
    [''],
    ['Thời gian báo cáo', summaryLabel],
    ['Ngày lập báo cáo', dateStr],
    ['Người lập báo cáo', authorName],
    ['Đại lý', agentInfo?.name || '—'],
    ['SĐT đại lý', agentInfo?.phone || '—'],
    ['Email đại lý', agentInfo?.email || '—'],
    ['Khu vực', agentInfo?.address || agentInfo?.province || '—'],
    [''],
    ['Tổng số phiên sạc', sessions.length],
    ['Tổng năng lượng (kWh)', Number(totalKwhFiltered.toFixed(3))],
    ['Chú ý', 'Dữ liệu được tổng hợp tự động từ hệ thống sạc EV. Các giá trị kWh dùng cho vận hành & đối soát.'],
  ];

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewAOA);

  // merge tiêu đề cho đẹp
  wsOverview['!merges'] = [
    { s: { r:0, c:0 }, e: { r:0, c:1 } },
    { s: { r:1, c:0 }, e: { r:1, c:1 } },
  ];

  wsOverview['!cols'] = [
    { wch: 28 },
    { wch: 50 },
  ];

  // ===== Sheet "Chi_tiet" (full list theo filter) =====
  const detailRows = sessions.map((it, idx) => ({
    'STT': idx + 1,
    'Mã đơn': String(it?.order_id ?? ''),
    'Thiết bị': String(it?.device_id?.name ?? ''),
    'Cổng': String(it?.portNumber ?? ''),
    'Ngày': onlyDateStr(it?.startTime),
    'Bắt đầu': fmt(it?.startTime),
    'Kết thúc': fmt(it?.endTime),
    'Năng lượng (kWh)': Number(getEnergyKwh(it).toFixed(3)),
    'Trạng thái': viStatus(it?.status),
  }));

  const wsDetail = XLSX.utils.json_to_sheet(detailRows, {
    header: [
      'STT',
      'Mã đơn',
      'Thiết bị',
      'Cổng',
      'Ngày',
      'Bắt đầu',
      'Kết thúc',
      'Năng lượng (kWh)',
      'Trạng thái',
    ]
  });

  wsDetail['!cols'] = [
    { wch: 6  },
    { wch: 14 },
    { wch: 22 },
    { wch: 8  },
    { wch: 12 },
    { wch: 20 },
    { wch: 20 },
    { wch: 18 },
    { wch: 14 },
  ];

  // thêm dòng tổng cuối sheet Chi_tiet
  const detRange = XLSX.utils.decode_range(wsDetail['!ref']);
  const totalRowIdx = detRange.e.r + 2;
  XLSX.utils.sheet_add_aoa(wsDetail, [
    ['TỔNG KWH (lọc hiện tại)', null, null, null, null, null, null, Number(totalKwhFiltered.toFixed(3)), null]
  ], { origin: `A${totalRowIdx}` });

  // ===== Sheet "Thiet_bi" =====
  const { rows: deviceRows, grandTotal } = groupByDevice(sessions);
  const wsDevice = XLSX.utils.json_to_sheet(deviceRows, {
    header: ['Thiết bị','Số phiên','Tổng kWh','Tỉ lệ (%)']
  });

  wsDevice['!cols'] = [
    { wch: 32 },
    { wch: 10 },
    { wch: 14 },
    { wch: 10 },
  ];

  const devRange = XLSX.utils.decode_range(wsDevice['!ref']);
  const devTotalRow = devRange.e.r + 2;
  XLSX.utils.sheet_add_aoa(wsDevice, [
    ['TỔNG', sessions.length, Number(grandTotal.toFixed(3)), '100.00']
  ], { origin: `A${devTotalRow}` });

  // ===== Sheet theo tháng =====
  // - Nếu đang chọn 1 tháng cụ thể => chỉ xuất đúng tháng đó
  // - Nếu đang ở all => xuất tất cả tháng có data (mỗi tháng 1 sheet riêng)

  const monthBuckets = groupByMonth(sessions);
  // monthBuckets = [{monthKey, monthLabel, totalKwh, detailRows:[...]}, ...]

  // Chuẩn bị workbook
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, wsOverview, 'Tong_quan');
  XLSX.utils.book_append_sheet(wb, wsDetail, 'Chi_tiet');
  XLSX.utils.book_append_sheet(wb, wsDevice, 'Thiet_bi');

  // tạo sheet cho từng tháng
  for (const bucket of monthBuckets) {
    // nếu user chọn 1 tháng cụ thể thì bỏ qua tháng khác
    if (selectedMonthForExport !== 'all' && bucket.monthKey !== selectedMonthForExport) continue;

    // header tháng
    const monthHeaderAOA = [
      [`BÁO CÁO THÁNG ${bucket.monthLabel}`],
      [`Tổng năng lượng tháng`, bucket.totalKwh],
      [''],
    ];

    // convert detailRows -> sheet tạm
    const wsTmp = XLSX.utils.json_to_sheet(bucket.detailRows, {
      header: [
        'STT',
        'Mã đơn',
        'Thiết bị',
        'Cổng',
        'Bắt đầu',
        'Kết thúc',
        'Năng lượng (kWh)',
        'Trạng thái',
      ]
    });

    // shift nội dung wsTmp xuống dưới phần header
    //  - ta build final sheet aoa_to_sheet rồi paste
    const wsMonth = XLSX.utils.aoa_to_sheet(monthHeaderAOA);

    // lấy AOA từ wsTmp
    const tmpAOA = XLSX.utils.sheet_to_json(wsTmp, { header: 1 });
    XLSX.utils.sheet_add_aoa(wsMonth, tmpAOA, { origin: `A4` });

    // autofit
    wsMonth['!cols'] = [
      { wch: 6  }, // STT
      { wch: 14 }, // Mã đơn
      { wch: 22 }, // Thiết bị
      { wch: 8  }, // Cổng
      { wch: 20 }, // Bắt đầu
      { wch: 20 }, // Kết thúc
      { wch: 18 }, // Năng lượng
      { wch: 14 }, // Trạng thái
    ];

    // merge cell cho dòng title
    wsMonth['!merges'] = [
      { s: { r:0, c:0 }, e: { r:0, c:7 } }, // "BÁO CÁO THÁNG ..."
    ];

    // tên sheet = "10-2025" kiểu ngắn gọn
    const sheetName = monthLabelDash(bucket.monthKey); // "10-2025"
    XLSX.utils.book_append_sheet(wb, wsMonth, sheetName.slice(0,31)); // excel limit 31 char
  }

  return wb;
}

/* =============== Component Screen =============== */
export default function ChargingSession({ navigateToScreen }) {
  // ===== lấy ngôn ngữ + agent info (đại lý) =====
  const { language } = useLanguage('vi');
  const t = useCallback(
    (k) =>
      (STRINGS[language] && STRINGS[language][k]) ??
      STRINGS.vi?.[k] ??
      STRINGS.en?.[k] ??
      k,
    [language]
  );

  const { agentInfo } = useAgentInfo([language]);

  // ===== back/nav =====
  const goBack = useCallback(() => { navigateToScreen?.('Device'); return true; }, [navigateToScreen]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
  }, [goBack]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: (e) => e.nativeEvent.pageX <= 24,
    onMoveShouldSetPanResponder: (e, g) => e.nativeEvent.pageX <= 24 && Math.abs(g.dx) > 8,
    onPanResponderRelease: (e, g) => { if (g.dx > 60 && Math.abs(g.dy) < 40) goBack(); },
  }), [goBack]);

  // ===== state chính =====
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all'); // 'YYYY-MM' | 'all'
  const [selectedPort, setSelectedPort] = useState('all');
  const [monthOptions, setMonthOptions] = useState([]);
  const [portOptions, setPortOptions] = useState([]);

  const [dateFromStr, setDateFromStr] = useState('');
  const [dateToStr, setDateToStr] = useState('');
  const dateFrom = useMemo(() => (dateFromStr ? new Date(dateFromStr) : null), [dateFromStr]);
  const dateTo   = useMemo(() => (dateToStr   ? new Date(dateToStr)   : null), [dateToStr]);

  // cache ALL để FE filter
  const [allSessions, setAllSessions] = useState([]);
  const [allReady, setAllReady] = useState(false);

  const isFEFilter = useMemo(
    () => selectedMonth !== 'all' || selectedPort !== 'all' || !!dateFrom || !!dateTo || search.trim().length > 0,
    [selectedMonth, selectedPort, dateFrom, dateTo, search]
  );

  // load ALL 1 lần
  const fetchAllOnce = useCallback(async () => {
    try {
      const token = await getAccessTokenSafe();
      const res = await getSessions(token, { page: 1, limit: 20000 });
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setAllSessions(list);

      const mset = new Set();
      const pset = new Set();
      list.forEach(it => {
        const mk = monthKey(it?.startTime || it?.endTime); if (mk) mset.add(mk);
        if (it?.portNumber != null) pset.add(String(it.portNumber));
      });

      setMonthOptions(
        [...mset]
          .filter(k => !!k && k !== 'all')
          .map(k => ({ key: k, label: monthLabelDash(k) }))
          .sort((a, b) => (a.key > b.key ? -1 : 1))
      );

      setPortOptions([...pset].map(Number).sort((a, b) => a - b));
      setAllReady(true);
    } catch {
      setAllSessions([]);
      setAllReady(true);
    }
  }, []);

  // gọi BE paginate mặc định
  const fetchBackendPage = useCallback(async (p = 1, q = '') => {
    setLoading(true);
    try {
      const token = await getAccessTokenSafe();
      const params = { page: p, limit };
      if (q.trim()) params.search = q.trim();
      const res = await getSessions(token, params);
      const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
      setItems(list);

      const lim = Number(res?.limit ?? res?.per_page ?? limit) || limit;
      const totalItems = Number(res?.total ?? 0);
      const tp = res?.totalPages ?? res?.total_pages
        ?? (totalItems ? Math.ceil(totalItems / lim) : (list.length < lim ? p : p + 1));
      setTotalPages(Math.max(1, Number(tp)));
      setPage(res?.page || p);
    } catch {
      setItems([]);
      setTotalPages(1);
      setPage(1);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // FE filter paginate
  const applyFEFilterPaginate = useCallback((targetMonth, q, p = 1) => {
    let base = allSessions.slice();

    if (targetMonth !== 'all')
      base = base.filter(it => monthKey(it?.startTime || it?.endTime) === targetMonth);

    if (selectedPort !== 'all')
      base = base.filter(it => String(it?.portNumber ?? '') === String(selectedPort));

    if (dateFrom || dateTo)
      base = base.filter(it =>
        isInRange(it?.startTime, dateFrom, dateTo) ||
        isInRange(it?.endTime, dateFrom, dateTo)
      );

    if (q?.trim()) {
      const needle = q.trim().toLowerCase();
      base = base.filter(it => String(it?.order_id || '').toLowerCase().includes(needle));
    }

    const tp = Math.max(1, Math.ceil(base.length / limit));
    const safe = Math.min(Math.max(1, p), tp);

    setItems(base.slice((safe - 1) * limit, safe * limit));
    setTotalPages(tp);
    setPage(safe);
    setLoading(false);
  }, [allSessions, limit, selectedPort, dateFrom, dateTo]);

  // dispatcher fetch/filter
  const runFilterOrFetch = useCallback((targetPage = 1) => {
    if (isFEFilter) {
      applyFEFilterPaginate(selectedMonth, search, targetPage);
    } else {
      fetchBackendPage(targetPage, search);
    }
  }, [isFEFilter, applyFEFilterPaginate, selectedMonth, search, fetchBackendPage]);

  // init load all
  useEffect(() => { fetchAllOnce(); }, [fetchAllOnce]);

  // rerun khi filter đổi
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => { runFilterOrFetch(1); }, 250);
    return () => clearTimeout(t);
  }, [selectedMonth, selectedPort, dateFromStr, dateToStr, search, runFilterOrFetch]);

  // refresh
  const [refreshingState, setRefreshingState] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshingState(true);
    try {
      await fetchAllOnce();
      runFilterOrFetch(page);
    } finally { setRefreshingState(false); }
  }, [fetchAllOnce, runFilterOrFetch, page]);

  // pager
  const handlePrev = useCallback(() => {
    const next = Math.max(1, page - 1);
    if (next !== page) { setLoading(true); runFilterOrFetch(next); }
  }, [page, runFilterOrFetch]);

  const handleNext = useCallback(() => {
    const next = Math.min(totalPages, page + 1);
    if (next !== page) { setLoading(true); runFilterOrFetch(next); }
  }, [page, totalPages, runFilterOrFetch]);

  const handleGoTo = useCallback((targetPage) => {
    const safe = Math.max(1, Math.min(Number(totalPages) || 1, Number(targetPage) || 1));
    if (safe !== page) { setLoading(true); runFilterOrFetch(safe); }
  }, [totalPages, page, runFilterOrFetch]);

  /* ====== DỮ LIỆU THỐNG KÊ KWH (FULL FILTER, KO PHÂN TRANG) ====== */
  const filteredAllForStats = useMemo(() => {
    let base = allSessions.slice();

    if (selectedMonth !== 'all') {
      base = base.filter(
        it => monthKey(it?.startTime || it?.endTime) === selectedMonth
      );
    }

    if (selectedPort !== 'all') {
      base = base.filter(
        it => String(it?.portNumber ?? '') === String(selectedPort)
      );
    }

    if (dateFrom || dateTo) {
      base = base.filter(it =>
        isInRange(it?.startTime, dateFrom, dateTo) ||
        isInRange(it?.endTime, dateFrom, dateTo)
      );
    }

    if (search?.trim()) {
      const needle = search.trim().toLowerCase();
      base = base.filter(
        it => String(it?.order_id || '').toLowerCase().includes(needle)
      );
    }

    return base;
  }, [allSessions, selectedMonth, selectedPort, dateFrom, dateTo, search]);

  const totalKwhFiltered = useMemo(() => {
    let sum = 0;
    for (const it of filteredAllForStats) sum += getEnergyKwh(it);
    return Number(sum.toFixed(2));
  }, [filteredAllForStats]);

  const summaryLabel = useMemo(() => {
    if (selectedMonth !== 'all') {
      return monthLabelPretty(selectedMonth); // "Tháng 10/2025"
    }
    if (dateFrom && dateTo) {
      return `Từ ${fmt(dateFrom)} đến ${fmt(dateTo)}`;
    }
    if (dateFrom && !dateTo) {
      return `Từ ${fmt(dateFrom)} đến nay`;
    }
    if (!dateFrom && dateTo) {
      return `Đến ${fmt(dateTo)}`;
    }
    return 'Toàn bộ dữ liệu';
  }, [selectedMonth, dateFrom, dateTo]);

  /* ===== xuất Excel chuyên nghiệp ===== */
  const exportExcel = useCallback(async () => {
    try {
      const dataForReport = allReady ? allSessions : items;

      const wb = buildWorkbookPro({
        sessions: dataForReport,
        summaryLabel,
        totalKwhFiltered,
        reportDate: new Date(),
        companyName: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ TIỆN ÍCH THÔNG MINH',
        authorName: agentInfo?.name || 'Hệ thống',         // ai lập báo cáo -> đại lý
        agentInfo,
        selectedMonthForExport: selectedMonth,            // để quyết định sheet theo tháng
      });

      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const blob = new Blob([wbout], { type: 'application/octet-stream' });
      const now = new Date();
      const fname = `Bao_cao_nang_luong_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.xlsx`;
      saveAs(blob, fname);
    } catch (e) {
      console.warn('Export error:', e);
      alert('Xuất Excel thất bại: ' + (e?.message || e));
    }
  }, [allReady, allSessions, items, summaryLabel, totalKwhFiltered, agentInfo, selectedMonth]);

  /* ===== highlight search text trong card ===== */
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

  /* ===== Quick chips + nút export ===== */
  const Chips = (
    <View style={styles.quickRow}>
      <TouchableOpacity
        onPress={() => {
          setDateFromStr(startOfDayLocal().toISOString());
          setDateToStr(endOfDayLocal().toISOString());
          setSelectedMonth('all');
          setPage(1);
        }}
        style={styles.chip} activeOpacity={0.9}
      >
        <Text style={styles.chipText}>Hôm nay</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          const t = new Date();
          const s = startOfDayLocal(new Date(t.getTime() - 6*24*3600*1000));
          setDateFromStr(s.toISOString());
          setDateToStr(endOfDayLocal(t).toISOString());
          setSelectedMonth('all');
          setPage(1);
        }}
        style={styles.chip} activeOpacity={0.9}
      >
        <Text style={styles.chipText}>7 ngày</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          const t = new Date();
          const s = startOfDayLocal(new Date(t.getTime() - 29*24*3600*1000));
          setDateFromStr(s.toISOString());
          setDateToStr(endOfDayLocal(t).toISOString());
          setSelectedMonth('all');
          setPage(1);
        }}
        style={styles.chip} activeOpacity={0.9}
      >
        <Text style={styles.chipText}>30 ngày</Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={exportExcel} style={[styles.exportBtn, { marginLeft: 8 }]} activeOpacity={0.9}>
        <Icon name="download" size={16} color="#fff" />
        <Text style={styles.exportText}>Xuất Excel</Text>
      </TouchableOpacity>
    </View>
  );

  /* ===== Thanh summary kWh trên UI ===== */
  const SummaryBar = () => (
    <View style={styles.summaryWrap}>
      <Icon name="bolt" size={18} color="#2563EB" style={{ marginRight: 6 }} />
      <Text style={styles.summaryText}>
        {summaryLabel}: <Text style={styles.summaryNumber}>{totalKwhFiltered} kWh</Text>
      </Text>
    </View>
  );

  /* ===== Skeleton card ===== */
  const SkeletonCard = () => (
    <View style={styles.card}>
      <View style={[styles.skel, { width: '48%', height: 16, marginBottom: 8 }]} />
      <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:8 }}>
        <View style={[styles.skel, { width: 110, height: 12 }]} />
        <View style={[styles.skel, { width: 60, height: 12 }]} />
      </View>
      <View style={[styles.skel, { width: '80%', height: 12, marginTop: 6 }]} />
      <View style={[styles.skel, { width: '70%', height: 12, marginTop: 6 }]} />
      <View style={[styles.skel, { width: '60%', height: 12, marginTop: 6 }]} />
    </View>
  );

  /* ===== Render 1 item session ===== */
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
              Mã đơn: {highlightText(item?.order_id || '—', search)} · Cổng <Text style={styles.bold}>{item?.portNumber ?? '—'}</Text>
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
          <Text style={styles.v}>
            {(item?.energy_used_kwh ?? item?.energy_kwh ?? item?.energy ?? 0) + ' kWh'}
          </Text>
        </View>
      </View>
    );
  };

  /* ===== RENDER ROOT ===== */
  return (
    <SafeAreaView style={styles.container} {...panResponder.panHandlers}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={{ padding: 6, marginRight: 6 }}>
          <Text style={{ fontSize: 30, color: '#fff' }}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Phiên sạc</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
        <SearchBar
          placeholder="Nhập mã đơn để tìm kiếm"
          value={search}
          onChange={setSearch}
          onClear={() => setSearch('')}
          onSubmit={() => {}}
        />
      </View>

      {/* Filters + Chips/Export */}
      <WebFilters
        monthOptions={monthOptions}
        monthValue={selectedMonth}
        onMonthChange={(k) => { setSelectedMonth(k); setPage(1); }}

        portOptions={portOptions}
        portValue={selectedPort}
        onPortChange={(k) => { setSelectedPort(k); setPage(1); }}

        fromStr={dateFromStr}
        toStr={dateToStr}
        onFromChange={(v) => { setDateFromStr(v); setSelectedMonth('all'); setPage(1); }}
        onToChange={(v) => { setDateToStr(v); setSelectedMonth('all'); setPage(1); }}
        onClearDates={() => { setDateFromStr(''); setDateToStr(''); setSelectedMonth('all'); }}

        rightSlot={Chips}
      />

      {/* Summary kWh */}
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 0 }}>
        <SummaryBar />
      </View>

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
          keyExtractor={(it, idx) => String(it?._id || it?.order_id || idx)}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ padding: 16, paddingBottom: BOTTOM_PAD, overflow: 'visible' }}
          refreshControl={<RefreshControl refreshing={refreshingState} onRefresh={onRefresh} />}
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

/* =============== styles =============== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },

  header: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 16 : 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },

  summaryWrap: {
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2563EB55',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 13,
    color: '#1e293b',
    fontWeight: '600',
    flexShrink: 1,
    flexWrap: 'wrap'
  },
  summaryNumber: {
    color: '#111827',
    fontWeight: '800'
  },

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

  hlMatch: { backgroundColor: '#FEF3C7', color: '#111827', borderRadius: 4, paddingHorizontal: 2 },

  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
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

  exportBtn: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    alignSelf: 'flex-start'
  },
  exportText: { color: '#fff', fontWeight: '800' },

  // chips
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chip: {
    backgroundColor: '#e5e7eb', borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', height: 40
  },
  chipText: { fontSize: 12, fontWeight: '700', color: '#111827' },

  // skeleton
  skel: { backgroundColor: '#E5E7EB', borderRadius: 8 }
});
