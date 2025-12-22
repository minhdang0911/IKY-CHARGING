// screens/Reports/SessionReportScreen.jsx
import React, { useMemo, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import * as XLSX from 'xlsx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import templateFile from '../../assets/template/session_report_template.xlsx';

// ==== APIs ====
import { getSessionsByRange } from '../../apis/devices';
import { getOrders } from '../../apis/devices'; // <-- đã import

// ==== Assets ====
import icImport from '../../assets/img/ic_upload-removebg-preview.png';
import icExport from '../../assets/img/ic_download.png';
import icExportRaw from '../../assets/img/ic_download_cloud.png';
import icReload from '../../assets/img/ic_refresh.png';
import icCalendar from '../../assets/img/ic_calendar_monthh-removebg-preview.png';

// ==== Components ====
import PaginationControls from '../../components/PaginationControls';

// ==== Keys ====
const K_REPORT_TEMPLATE = 'report_template_b64';
const K_ACCESS_TOKEN = 'access_token';

// ==== Flags ====
const isWeb = Platform.OS === 'web';

// ==== SafeArea fallback ====
let _useSafeAreaInsets;
try {
  _useSafeAreaInsets =
    require('react-native-safe-area-context').useSafeAreaInsets;
} catch {
  _useSafeAreaInsets = null;
}
function useSafeInsets() {
  try {
    if (typeof _useSafeAreaInsets === 'function') {
      const v = _useSafeAreaInsets();
      if (v && typeof v.bottom === 'number') return v;
    }
  } catch {}
  return { top: 0, right: 0, bottom: 0, left: 0 };
}

// ==== Native-only dynamic requires ====
let DateTimePicker, DocumentPicker, RNFS, Share;
if (!isWeb) {
  DateTimePicker = require('@react-native-community/datetimepicker').default;
  DocumentPicker = require('react-native-document-picker');
  RNFS = require('react-native-fs');
  Share = require('react-native-share').default;
}

/* ================== Alert toast queue ================== */
function useAlertQueue() {
  const [queue, setQueue] = useState([]);
  const [current, setCurrent] = useState(null);
  const timerRef = useRef(null);

  const show = useCallback((type, msg, ms = 2500) => {
    setQueue(q => [...q, { id: Date.now() + Math.random(), type, msg, ms }]);
  }, []);

  React.useEffect(() => {
    if (!current && queue.length) {
      const item = queue[0];
      setCurrent(item);
      setQueue(q => q.slice(1));
      timerRef.current && clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCurrent(null), item.ms);
    }
  }, [queue, current]);

  const dismissNow = () => {
    timerRef.current && clearTimeout(timerRef.current);
    setCurrent(null);
  };

  const node = current ? (
    <View
      style={[
        aStyles.wrap,
        current.type === 'success' && aStyles.success,
        current.type === 'error' && aStyles.error,
        current.type === 'info' && aStyles.info,
      ]}
    >
      <Text style={aStyles.text} numberOfLines={3}>
        {current.msg}
      </Text>
      <TouchableOpacity onPress={dismissNow} style={aStyles.closeBtn}>
        <Text style={aStyles.closeTxt}>✕</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  return { show, node };
}

/* ================== WEB helpers ================== */
function b64ToBlob(b64, type) {
  const bin =
    typeof atob !== 'undefined'
      ? atob(b64)
      : Buffer.from(b64, 'base64').toString('binary');
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}
async function saveBase64Web({ base64, filename }) {
  const blob = b64ToBlob(
    base64,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || 'report.xlsx';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
async function pickTemplateWeb() {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('Không chọn file'));
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = String(reader.result).split(',')[1];
        resolve({ name: file.name, base64 });
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    };
    input.click();
  });
}
function WebInlineDateInput({ value, onChange, style }) {
  const pad = n => String(n).padStart(2, '0');

  const toVal = d => {
    if (!(d instanceof Date)) return '';
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const handle = e => {
    const v = e.target.value;
    if (!v) {
      // clear date nếu user xóa
      onChange?.(null);
      return;
    }
    const dt = new Date(v + 'T00:00:00');
    if (!Number.isNaN(dt.getTime())) {
      onChange?.(dt);
    }
  };

  const inputVal = value instanceof Date ? toVal(value) : '';

  return (
    <input
      type="date"
      value={inputVal}
      onChange={handle}
      placeholder="dd/mm/yyyy"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 36,
        padding: '0 10px',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        outline: 'none',
        fontSize: 14,
        width: '100%',
        background: '#fff',
        marginLeft: 10,
        ...style,
      }}
    />
  );
}


/* ================== Utils ================== */
const vnNorm = (s = '') =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\u0110/g, 'D')
    .replace(/\u00A0/g, ' ')
    .toLowerCase()
    .trim();

const getLastRow = (sheet, col = 1, hardLimit = 5000) => {
  let last = 1,
    emptyStreak = 0;
  for (let r = 1; r <= hardLimit; r++) {
    const v = sheet.cell(r, col).value();
    const s = (v == null ? '' : String(v)).trim();
    if (s !== '') {
      last = r;
      emptyStreak = 0;
    } else {
      emptyStreak++;
      if (emptyStreak >= 50 && r > last) break;
    }
  }
  return last;
};

const humanDate = d => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

const toUtcDayRange = (dFrom, dTo) => {
  const pad = n => String(n).padStart(2, '0');
  const ymd = d =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
      d.getUTCDate(),
    )}`;
  const f = new Date(
    Date.UTC(dFrom.getFullYear(), dFrom.getMonth(), dFrom.getDate()),
  );
  const t = new Date(
    Date.UTC(dTo.getFullYear(), dTo.getMonth(), dTo.getDate()),
  );
  return {
    fromIso: `${ymd(f)}T00:00:00.000Z`,
    toIso: `${ymd(t)}T23:59:59.999Z`,
  };
};

function isoDate(d) {
  const y = d.getFullYear(),
    m = String(d.getMonth() + 1).padStart(2, '0'),
    dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function humanDT(s) {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear(),
    m = String(d.getMonth() + 1).padStart(2, '0'),
    dd = String(d.getDate()).padStart(2, '0'),
    hh = String(d.getHours()).padStart(2, '0'),
    mm = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${m}/${y} ${hh}:${mm}`;
}
function safeStr(v) {
  return (v ?? '') + '';
}
function safeNum(v) {
  return typeof v === 'number' ? v.toFixed(3) : v ? Number(v).toFixed(3) : '';
}
function dateSlug(d) {
  return d ? isoDate(d) : 'unknown';
}

const writeDateHeader = (sheet, fromDate, toDate) => {
  const text = `Từ ${humanDate(fromDate)} đến ${humanDate(toDate)}`;
  const MAX_R = 10,
    MAX_C = 12;
  let placed = false;
  for (let r = 1; r <= MAX_R && !placed; r++) {
    for (let c = 1; c <= MAX_C && !placed; c++) {
      const raw = sheet.cell(r, c).value();
      if (!raw) continue;
      const s = String(raw);
      if (/^Từ\s*dd\/mm/.test(s) || /\{\{from_to\}\}/i.test(s)) {
        sheet
          .cell(r, c)
          .value(text)
          .style({
            horizontalAlignment: 'center',
            verticalAlignment: 'center',
            bold: true,
          });
        placed = true;
      }
    }
  }
  if (!placed) {
    sheet
      .cell(2, 2)
      .value(text)
      .style({
        horizontalAlignment: 'center',
        verticalAlignment: 'center',
        bold: true,
      });
  }
};

const makeOutputPath = name => {
  const file = name || `BaoCaoTramSac_${Date.now()}.xlsx`;
  if (isWeb) return file;
  return Platform.OS === 'android'
    ? `${RNFS.DownloadDirectoryPath}/${file}`
    : `${RNFS.DocumentDirectoryPath}/${file}`;
};
async function saveAndShareBase64({ base64, filename }) {
  if (isWeb) {
    await saveBase64Web({ base64, filename });
    return filename;
  }
  const outPath = makeOutputPath(filename);
  await RNFS.writeFile(outPath, base64, 'base64');
  try {
    await Share.open({
      url: 'file://' + outPath,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      failOnCancel: false,
    });
  } catch {}
  return outPath;
}
function autoFitCols(ws, aoa) {
  const colCount = Math.max(...aoa.map(r => r.length));
  const colWidths = new Array(colCount).fill(10);
  aoa.forEach(row =>
    row.forEach((cell, idx) => {
      const len =
        cell === undefined || cell === null ? 0 : String(cell).length;
      if (len + 2 > colWidths[idx]) colWidths[idx] = len + 2;
    }),
  );
  ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w, 40) }));
}

// helper set numFmt cho từng cột (XLSX, 0-based col/row)
function setColNumberFormat(ws, colIndex, numFmt, startRow = 0) {
  if (!ws['!ref']) return;
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let r = startRow; r <= range.e.r; r++) {
    const addr = XLSX.utils.encode_cell({ c: colIndex, r });
    const cell = ws[addr];
    if (cell && typeof cell.v === 'number') {
      cell.s = cell.s || {};
      cell.s.numFmt = numFmt;
    }
  }
}

// ==== helper: fetch all orders & filter theo range ====
async function fetchOrdersInRange(accessToken, fromIso, toIso) {
  let page = 1;
  const limit = 100;
  let totalPages = 1;
  const all = [];

  do {
    const res = await getOrders(accessToken, { page, limit });
    const data = Array.isArray(res?.data) ? res.data : [];
    all.push(...data);
    totalPages = res?.totalPages || 1;
    page += 1;
  } while (page <= totalPages);

  const fromMs = new Date(fromIso).getTime();
  const toMs = new Date(toIso).getTime();

  return all.filter(o => {
    const tStr = o.paidAt || o.createdAt;
    if (!tStr) return false;
    const t = new Date(tStr).getTime();
    if (Number.isNaN(t)) return false;
    return t >= fromMs && t <= toMs;
  });
}

// ==== helper: gom sessions + orders => summaries theo thiết bị + cổng ====
function buildDeviceSummaries(sessions, ordersInRange) {
  const orderMap = new Map();
  for (const od of ordersInRange) {
    if (od.orderId) orderMap.set(od.orderId, od);
  }

  const deviceMap = new Map();

  for (const s of sessions) {
    const order = s.order_id ? orderMap.get(s.order_id) : null;
    const deviceObj = order?.device_id || {};

    const rawId = deviceObj._id; // _id gốc, tí nữa mình tránh dùng

    const deviceNameFromOrder =
      deviceObj.name ||
      deviceObj.device_name ||
      deviceObj.deviceName ||
      '';

    // Ưu tiên các field "đàng hoàng", KHÔNG lấy _id làm serial
    let deviceSerialFromOrder =
      deviceObj.device_code ||
      deviceObj.deviceSerial ||
      deviceObj.device_serial ||
      '';

    // fallback name/serial từ session
    const fallbackName = s.device_name || s.deviceName || '';
    let fallbackSerial =
      s.device_serial ||
      s.deviceSerial ||
      s.device_code ||
      s.deviceCode ||
      s.device_id ||
      s.deviceId ||
      '';

    // Nếu serial trùng đúng _id thì bỏ, không dùng để hiển thị
    if (rawId && deviceSerialFromOrder === rawId) {
      deviceSerialFromOrder = '';
    }
    if (rawId && fallbackSerial === rawId) {
      fallbackSerial = '';
    }

    const deviceName = deviceNameFromOrder || fallbackName;
    const deviceSerial = deviceSerialFromOrder || fallbackSerial;

    // 👉 deviceKey ưu tiên chỉ là tên thiết bị,
    // chỉ dùng serial khi không có name
    const deviceKey = deviceName || deviceSerial || 'unknown';

    const port =
      Number(s.portNumber || s.port || order?.portNumber || 0) || 0;

    if (!deviceMap.has(deviceKey)) {
      deviceMap.set(deviceKey, { deviceKey, ports: new Map() });
    }
    const d = deviceMap.get(deviceKey);
    if (!d.ports.has(port)) {
      d.ports.set(port, { totalKwh: 0, totalRevenue: 0, avgPrice: 0 });
    }
    const p = d.ports.get(port);

    const kwhVal = Number(s.energy_used_kwh || s.kwh || 0);
    p.totalKwh += kwhVal;

    const amountVnd = Number(
      (order &&
        (order.amount ??
          order.amount_vnd ??
          order.total_price_vnd ??
          order.price_vnd)) ?? 0,
    );
    p.totalRevenue += amountVnd;
  }

  const summaries = Array.from(deviceMap.values());

  // tính giá bán điện bình quân VNĐ/kWh cho từng cổng
  for (const d of summaries) {
    for (const p of d.ports.values()) {
      p.avgPrice =
        p.totalKwh > 0
          ? Math.round((p.totalRevenue / p.totalKwh) * 100) / 100
          : 0;
    }
  }

  return summaries;
}


/* ================== MAIN ================== */
export default function SessionReportScreen() {
  const insets = useSafeInsets();
  const { width } = useWindowDimensions();
  const isWideWeb = isWeb && width >= 640;

  const TAB_BAR_H = 64;
  const bottomPad = (insets?.bottom || 0) + TAB_BAR_H + 8;

  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [pickField, setPickField] = useState(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const VIEW_LIMIT = 10;
  const EXPORT_LIMIT = 100000;

  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState([]);
  const [rawSessions, setRawSessions] = useState([]);

  const alert = useAlertQueue();

  const loadData = useCallback(
    async (_page = page) => {
      try {
        if (!from || !to) {
          alert.show('info', 'Chọn ngày bắt đầu và ngày kết thúc.', 2200);
          return;
        }
        const accessToken = await AsyncStorage.getItem(K_ACCESS_TOKEN);
        if (!accessToken) {
          alert.show(
            'error',
            'Không tìm thấy token. Vui lòng đăng nhập lại.',
            2500,
          );
          return;
        }
        setLoading(true);

        const { fromIso, toIso } = toUtcDayRange(from, to);
        const res = await getSessionsByRange(accessToken, {
          page: _page,
          limit: VIEW_LIMIT,
          from: fromIso,
          to: toIso,
        });

        setPage(res?.page || _page);
        setTotalPages(res?.totalPages || 1);

        const data = Array.isArray(res?.data) ? res.data : [];
        setRawSessions(data);

        const mapped = data.map(it => ({
          port: it.portNumber ?? it.port,
          order: it.order_id,
          start: it.startTime,
          end: it.endTime,
          status: it.status,
          kwh: it.energy_used_kwh ?? it.kwh,
        }));

        setRows(mapped);
      } catch (e) {
        console.log('[loadData] err:', e);
        alert.show(
          'error',
          `Tải dữ liệu thất bại: ${e.message || 'Lỗi không xác định'}`,
          2800,
        );
      } finally {
        setLoading(false);
      }
    },
    [page, from, to],
  );

  const onImportTemplate = useCallback(async () => {
    try {
      let b64 = '',
        name = 'template.xlsx';
      if (isWeb) {
        const f = await pickTemplateWeb();
        b64 = f.base64;
        name = f.name || name;
      } else {
        const f = await DocumentPicker.pickSingle({
          type: [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
            DocumentPicker.types.allFiles,
          ],
          copyTo: 'cachesDirectory',
        });
        const path = (f.fileCopyUri || f.uri || '').replace('file://', '');
        b64 = await RNFS.readFile(path, 'base64');
        name = f.name || name;
      }
      try {
        const XPP = await loadXlsxPopulateIfAvailable();
        if (XPP) {
          const testWb = await XPP.fromDataAsync(b64, { base64: true });
          if (!testWb.sheet('Sheet1'))
            throw new Error('Template phải có sheet "Sheet1".');
        }
      } catch {}
      await AsyncStorage.setItem(K_REPORT_TEMPLATE, b64);
      alert.show('success', `Đã import template (${name}).`, 2500);
    } catch (e) {
      if (!isWeb && DocumentPicker?.isCancel?.(e)) return;
      console.log('[import template] err', e);
      alert.show(
        'error',
        e?.message ? String(e.message) : 'Import template lỗi.',
        2500,
      );
    }
  }, []);


 

const onDownloadTemplate = useCallback(() => {
  if (!isWeb) return;

  const link = document.createElement('a');
  link.href = templateFile;
  link.download = 'Báo cáo chi tiết hoạt động.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}, []);



  const buildSheetAOA = useMemo(() => {
    const header = [
      'Cổng',
      'Mã đơn',
      'Bắt đầu',
      'Kết thúc',
      'Trạng thái',
      'kWh',
    ];
    const body = rows.map(r => [
      r.port ?? '',
      r.order ?? '',
      humanDT(r.start),
      humanDT(r.end),
      r.status ?? '',
      typeof r.kwh === 'number' ? r.kwh : Number(r.kwh) || 0,
    ]);
    return [header, ...body];
  }, [rows]);

  // ====== EXPORT KHÔNG TEMPLATE (NEW: nhiều sheet + giá bình quân) ======
  const onExportNoTemplate = useCallback(async () => {
    try {
      if (!from || !to) {
        alert.show('info', 'Chọn khoảng ngày trước khi xuất báo cáo.', 2200);
        return;
      }
      const accessToken = await AsyncStorage.getItem(K_ACCESS_TOKEN);
      if (!accessToken) {
        alert.show(
          'error',
          'Không tìm thấy token. Vui lòng đăng nhập lại.',
          2500,
        );
        return;
      }
      const { fromIso, toIso } = toUtcDayRange(from, to);

      // sessions
      const res = await getSessionsByRange(accessToken, {
        page: 1,
        limit: EXPORT_LIMIT,
        from: fromIso,
        to: toIso,
      });
      const data = Array.isArray(res?.data) ? res.data : [];
      if (!data.length) {
        alert.show('info', 'Không có dữ liệu để xuất.', 2200);
        return;
      }

      // orders + summaries (thiết bị / cổng / kWh / doanh thu / giá TB)
      const ordersInRange = await fetchOrdersInRange(
        accessToken,
        fromIso,
        toIso,
      );
      const summaries = buildDeviceSummaries(data, ordersInRange);

      const wb = XLSX.utils.book_new();

      // ===== sheet 1: DATA (raw sessions) =====
      const aoaData = [
        ['Cổng', 'Mã đơn', 'Bắt đầu', 'Kết thúc', 'Trạng thái', 'kWh'],
        ...data.map(it => [
          it.portNumber ?? it.port ?? '',
          it.order_id ?? '',
          humanDT(it.startTime),
          humanDT(it.endTime),
          it.status ?? '',
          Number(it.energy_used_kwh ?? it.kwh ?? 0),
        ]),
      ];
      const wsData = XLSX.utils.aoa_to_sheet(aoaData);
      autoFitCols(wsData, aoaData);
      XLSX.utils.book_append_sheet(wb, wsData, 'DATA');

      // ===== sheet 2: TONG_HOP (giống template) =====
      const title = 'Báo cáo chi tiết hoạt động trạm sạc';
      const dateText = `Từ ${humanDate(from || new Date())} đến ${humanDate(
        to || new Date(),
      )}`;

      const headerRow = [
        'Thiết bị / Cổng',
        'Tổng điện năng tiêu thụ (kWh)',
        'Doanh thu tiền điện tạm tính (VND)',
        'Giá bán điện bình quân (VNĐ/kWh)',
      ];

      const summaryAoa = [];
      summaryAoa.push([title]);
      summaryAoa.push([dateText]);
      summaryAoa.push([]);
      summaryAoa.push(headerRow);

      summaries.forEach((d, idx) => {
        const deviceTitle = d.deviceKey || `Thiết bị ${idx + 1}`;
        summaryAoa.push([deviceTitle, null, null, null]);

        const portsArr = Array.from(d.ports.entries()).sort(
          (a, b) => a[0] - b[0],
        );
        portsArr.forEach(([port, p]) => {
          summaryAoa.push([
            `Cổng ${port}`,
            Number((p.totalKwh || 0).toFixed(3)),
            Number(p.totalRevenue || 0),
            Number((p.avgPrice || 0).toFixed(2)),
          ]);
        });

        summaryAoa.push([]);
      });

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
      autoFitCols(wsSummary, summaryAoa);

      // style header (row index 3 = hàng 4)
      const headerRowIndex = 3;
      for (let c = 0; c < headerRow.length; c++) {
        const addr = XLSX.utils.encode_cell({ r: headerRowIndex, c });
        const cell = wsSummary[addr];
        if (cell) {
          cell.s = cell.s || {};
          cell.s.font = { ...(cell.s.font || {}), bold: true };
        }
      }
      // format số: B (1): kWh, C (2): doanh thu, D (3): giá bình quân
      setColNumberFormat(wsSummary, 1, '0.000', headerRowIndex + 1);
      setColNumberFormat(wsSummary, 2, '#,##0', headerRowIndex + 1);
      setColNumberFormat(wsSummary, 3, '#,##0.00', headerRowIndex + 1);

      XLSX.utils.book_append_sheet(wb, wsSummary, 'TONG_HOP');

      // ===== các sheet Thiet bi 1,2,3,... =====
      summaries.forEach((d, idx) => {
        const deviceTitle = d.deviceKey || `Thiết bị ${idx + 1}`;
        const devAoa = [];
        devAoa.push([title]);
        devAoa.push([deviceTitle]);
        devAoa.push([dateText]);
        devAoa.push([]);
        devAoa.push(headerRow);

        const portsArr = Array.from(d.ports.entries()).sort(
          (a, b) => a[0] - b[0],
        );
        portsArr.forEach(([port, p]) => {
          devAoa.push([
            `Cổng ${port}`,
            Number((p.totalKwh || 0).toFixed(3)),
            Number(p.totalRevenue || 0),
            Number((p.avgPrice || 0).toFixed(2)),
          ]);
        });

        const wsDev = XLSX.utils.aoa_to_sheet(devAoa);
        autoFitCols(wsDev, devAoa);

        const devHeaderRowIndex = 4;
        for (let c = 0; c < headerRow.length; c++) {
          const addr = XLSX.utils.encode_cell({
            r: devHeaderRowIndex,
            c,
          });
          const cell = wsDev[addr];
          if (cell) {
            cell.s = cell.s || {};
            cell.s.font = { ...(cell.s.font || {}), bold: true };
          }
        }
        setColNumberFormat(wsDev, 1, '0.000', devHeaderRowIndex + 1);
        setColNumberFormat(wsDev, 2, '#,##0', devHeaderRowIndex + 1);
        setColNumberFormat(wsDev, 3, '#,##0.00', devHeaderRowIndex + 1);

        const sheetName = `Thiet bi ${idx + 1}`.slice(0, 31);
        XLSX.utils.book_append_sheet(wb, wsDev, sheetName);
      });

      // write file
      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const filename = `Báo cáo chi tiết hoạt động_${dateSlug(
        from || new Date(),
      )}_${dateSlug(to || new Date())}.xlsx`;

      const outPath = await saveAndShareBase64({ base64, filename });
      alert.show('success', `Đã xuất: ${outPath}`, 2200);
    } catch (e) {
      console.log('[export no tpl] err', e);
      Alert.alert?.('Lỗi xuất', String(e?.message || e));
      alert.show('error', 'Xuất báo cáo thất bại.', 2500);
    }
  }, [from, to]);

  // ====== EXPORT CÓ TEMPLATE (dùng summaries + giá bình quân, format đẹp) ======
  const onExportWithTemplate = useCallback(async () => {
    try {
      if (!from || !to) {
        alert.show('info', 'Chọn khoảng ngày trước khi xuất.', 2200);
        return;
      }
      const tpl = await AsyncStorage.getItem(K_REPORT_TEMPLATE);
      if (!tpl) {
        alert.show(
          'info',
          'Chưa có template. Bấm "Import template" trước.',
          2600,
        );
        return;
      }
      const accessToken = await AsyncStorage.getItem(K_ACCESS_TOKEN);
      if (!accessToken) {
        alert.show(
          'error',
          'Không tìm thấy token. Vui lòng đăng nhập lại.',
          2500,
        );
        return;
      }
      const { fromIso, toIso } = toUtcDayRange(from, to);

      // 1) Lấy sessions để có kWh
      const res = await getSessionsByRange(accessToken, {
        page: 1,
        limit: EXPORT_LIMIT,
        from: fromIso,
        to: toIso,
      });
      const exportData = Array.isArray(res?.data) ? res.data : [];
      if (!exportData.length) {
        alert.show('info', 'Không có dữ liệu để xuất.', 2200);
        return;
      }

      // 2) Lấy orders trong cùng khoảng ngày để có amount
      const ordersInRange = await fetchOrdersInRange(
        accessToken,
        fromIso,
        toIso,
      );

      // 3) Gom + tính giá bình quân
      const summaries = buildDeviceSummaries(exportData, ordersInRange);

      // 4) Đổ vào template
      const XPP = await loadXlsxPopulateIfAvailable();
      if (!XPP) {
        alert.show(
          'info',
          'Thiếu "xlsx-populate". Cài: npm i xlsx-populate. Tạm dùng xuất không template.',
          3200,
        );
        return;
      }

      const workbook = await XPP.fromDataAsync(tpl, { base64: true });
      const sheet = workbook.sheet('Sheet1');
      if (!sheet) throw new Error('Không thấy sheet "Sheet1" trong template.');

      writeDateHeader(sheet, from || new Date(), to || new Date());

      const lastRow = getLastRow(sheet, 1, 5000);
      const blocks = [];
      for (let r = 1; r <= lastRow; r++) {
        const aRaw = (sheet.cell(r, 1).value() ?? '').toString().trim();
        const a = vnNorm(aRaw);
        if (/^thiet\s*bi(\s*\d+)?$/.test(a)) {
          const deviceHeaderRow = r;
          const ports = [];
          let rr = r + 1;
          while (rr <= lastRow) {
            const cRaw = (sheet.cell(rr, 1).value() ?? '').toString().trim();
            const c = vnNorm(cRaw);
            const m = c.match(/^cong\s*(\d+)/);
            if (m) {
              ports.push({ row: rr, portNumber: parseInt(m[1], 10) });
              rr++;
            } else if (c === '') rr++;
            else break;
          }
          if (ports.length) blocks.push({ deviceHeaderRow, ports });
        }
      }
      if (!blocks.length)
        throw new Error('Template không có block “Thiết bị / Cổng” hợp lệ.');

      const COL_KWH = 2;
      const COL_REV = 3;
      const COL_AVG = 4;

      blocks.forEach((b, i) => {
        const sum = summaries[i] || null;

        if (sum?.deviceKey && sum.deviceKey !== 'unknown') {
          sheet.cell(b.deviceHeaderRow, 1).value(sum.deviceKey);
        }

        for (const p of b.ports) {
          const found = sum?.ports?.get(p.portNumber) || {
            totalKwh: 0,
            totalRevenue: 0,
            avgPrice: 0,
          };

          sheet
            .cell(p.row, COL_KWH)
            .value(Number(found.totalKwh || 0))
            .style('numberFormat', '0.000');

          sheet
            .cell(p.row, COL_REV)
            .value(Number(found.totalRevenue || 0))
            .style('numberFormat', '#,##0');

          sheet
            .cell(p.row, COL_AVG)
            .value(Number(found.avgPrice || 0))
            .style('numberFormat', '#,##0.00');
        }
      });

      // font toàn sheet
      sheet.usedRange().style({
        fontFamily: 'Times New Roman',
        fontSize: 11,
      });

      const outB64 = await workbook.outputAsync('base64');
      const filename = `Báo cáo phiên sạc_${dateSlug(
        from || new Date(),
      )}_${dateSlug(to || new Date())}.xlsx`;
      const outPath = await saveAndShareBase64({ base64: outB64, filename });
      alert.show('success', `Đã xuất: ${outPath}`, 2200);
    } catch (e) {
      console.log('[export with tpl] err', e);
      Alert.alert?.('Lỗi xuất', String(e?.message || e));
      alert.show(
        'error',
        e?.message ? String(e.message) : 'Xuất báo cáo bằng template thất bại.',
        2500,
      );
    }
  }, [from, to]);

  async function loadXlsxPopulateIfAvailable() {
    if (!isWeb) {
      try {
        return require('xlsx-populate/browser/xlsx-populate');
      } catch {
        return null;
      }
    }
    try {
      const mod = await import('xlsx-populate/browser/xlsx-populate');
      return mod;
    } catch {
      return null;
    }
  }

  const onPrev = () => {
    if (page > 1) loadData(page - 1);
  };
  const onNext = () => {
    if (page < totalPages) loadData(page + 1);
  };
  const onJump = p => {
    loadData(p);
  };

  return (
    <View style={[st.container, { paddingBottom: bottomPad }]}>
      {alert.node}

      <View style={st.header}>
        <Text style={st.hTitle}>Báo cáo phiên sạc</Text>
      </View>

      <View style={st.hActions}>
          <HeaderBtn
    icon={icExportRaw}
    label="Tải mẫu template"
    onPress={onDownloadTemplate}
  />
  <HeaderBtn
    icon={icImport}
    label="Import template"
    onPress={onImportTemplate}
  />

  <HeaderBtn
    icon={icExport}
    label="Xuất dùng template"
    onPress={onExportWithTemplate}
  />
  <HeaderBtn
    icon={icExportRaw}
    label="Xuất không template"
    onPress={onExportNoTemplate}
  />
  <HeaderBtn
    icon={icReload}
    label="Tải dữ liệu"
    onPress={() => loadData(1)}
  />
</View>


      {/* ================= Filter Row ================= */}
      <View style={[st.rangeRow, isWideWeb && st.rangeRowWebWide]}>
        {isWeb ? (
          isWideWeb ? (
            <View style={st.webRowWide}>
              <View style={st.webFieldFixed}>
                <Text style={st.rangeTitle}>From</Text>
               <WebInlineDateInput
  value={from}
  onChange={setFrom}
  style={st.dateInputWide}
/>
              </View>
              <View style={[st.webFieldFixed, { marginLeft: 20 }]}>
                <Text style={st.rangeTitle}>To</Text>
                <WebInlineDateInput
                  value={to}
                  onChange={setTo}
                  style={st.dateInputWide}
                />
              </View>
              <TouchableOpacity
                style={[st.applyBtn, st.applyBtnFixed, { marginLeft: 20 }]}
                onPress={() => loadData(1)}
              >
                <Text style={st.applyTxt}>Áp dụng</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={st.webRow}>
                <View style={st.webField}>
                  <Text style={st.rangeTitle}>From</Text>
                  <WebInlineDateInput
                    value={from}
                    onChange={setFrom}
                  />
                </View>
                <View style={st.webField}>
                  <Text style={st.rangeTitle}>To</Text>
                  <WebInlineDateInput
                    value={to}
                    onChange={setTo}
                  />
                </View>
              </View>
              <TouchableOpacity
                style={[st.applyBtn, st.applyBtnBlock]}
                onPress={() => loadData(1)}
              >
                <Text style={st.applyTxt}>Áp dụng</Text>
              </TouchableOpacity>
            </>
          )
        ) : (
          <>
            <RangeButton
              title="From"
              value={from ? humanDate(from) : 'Chọn ngày'}
              onPress={() => setPickField('from')}
            />
            <RangeButton
              title="To"
              value={to ? humanDate(to) : 'Chọn ngày'}
              onPress={() => setPickField('to')}
            />
            <TouchableOpacity style={st.applyBtn} onPress={() => loadData(1)}>
              <Text style={st.applyTxt}>Áp dụng</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ================ TABLE ================== */}
      <DataTable rows={rows} loading={loading} bottomPad={bottomPad} />

     <View style={[st.pagiWrap, { marginBottom: bottomPad - 8 }]}>
  <PaginationControls
    page={page}
    totalPages={totalPages}
    onPrev={onPrev}
    onNext={onNext}
    onGoTo={onJump}
  />
</View>
      {!isWeb && pickField && (
        <DateTimePicker
          value={pickField === 'from' ? from || new Date() : to || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setPickField(null);
            if (event.type === 'set' && selectedDate) {
              if (pickField === 'from') setFrom(selectedDate);
              else setTo(selectedDate);
            }
          }}
        />
      )}
    </View>
  );
}

/* ================== UI bits ================== */
function HeaderBtn({ icon, label, onPress, disabled }) {
  return (
    <TouchableOpacity
      style={[st.hBtn, disabled && { opacity: 0.5 }]}
      onPress={disabled ? undefined : onPress}
      disabled={!!disabled}
    >
      {!!icon && <Image source={icon} style={st.hIcon} />}
      <Text style={st.hBtnTxt}>{label}</Text>
    </TouchableOpacity>
  );
}
function RangeButton({ title, value, onPress }) {
  return (
    <TouchableOpacity style={st.rangeBtn} onPress={onPress}>
      <Image source={icCalendar} style={st.calIcon} />
      <Text style={st.rangeTitle} numberOfLines={1} allowFontScaling={false}>
        {title}
      </Text>
      <Text style={st.rangeValue} numberOfLines={1} allowFontScaling={false}>
        {value}
      </Text>
    </TouchableOpacity>
  );
}

/* ---------- DataTable ---------- */
const COLS = [
  { key: 'port', label: 'Cổng', min: 72, flex: 0.7, align: 'left' },
  { key: 'order', label: 'Mã đơn', min: 160, flex: 1.6, align: 'left' },
  { key: 'start', label: 'Bắt đầu', min: 160, flex: 1.4, align: 'left' },
  { key: 'end', label: 'Kết thúc', min: 160, flex: 1.4, align: 'left' },
  { key: 'status', label: 'Trạng thái', min: 120, flex: 1.0, align: 'left' },
  { key: 'kwh', label: 'kWh', min: 90, flex: 0.8, align: 'right' },
];

function StatusChip({ value }) {
  const v = String(value || '').toLowerCase();
  let bg = '#e2e8f0',
    fg = '#0f172a';
  if (v.includes('run')) {
    bg = '#dbeafe';
    fg = '#1d4ed8';
  } else if (v.includes('compl')) {
    bg = '#dcfce7';
    fg = '#166534';
  } else if (v.includes('fail') || v.includes('error') || v.includes('cancel')) {
    bg = '#fee2e2';
    fg = '#991b1b';
  }
  return (
    <View style={[dtStyles.chip, { backgroundColor: bg }]}>
      <Text style={[dtStyles.chipTxt, { color: fg }]} numberOfLines={1}>
        {value || ''}
      </Text>
    </View>
  );
}

function DataTable({ rows, loading, bottomPad = 0 }) {
  const [wrapW, setWrapW] = useState(0);
  const tableMinWidth = useMemo(
    () => COLS.reduce((s, c) => s + (c.min || 0), 0),
    [],
  );
  const wide = wrapW >= tableMinWidth + 24;

  const HeaderRow = () => (
    <View style={dtStyles.headRow}>
      {COLS.map(c => (
        <View
          key={c.key}
          style={[
            dtStyles.cell,
            wide
              ? { flex: c.flex, minWidth: c.min }
              : { minWidth: c.min, maxWidth: c.min },
          ]}
        >
          <Text
            style={[
              dtStyles.headTxt,
              c.align === 'right' && { textAlign: 'right' },
            ]}
            numberOfLines={1}
          >
            {c.label}
          </Text>
        </View>
      ))}
    </View>
  );

  const Body = () => {
    if (loading)
      return (
        <View style={st.loading}>
          <ActivityIndicator />
        </View>
      );
    if (!rows.length)
      return (
        <View style={st.empty}>
          <Text style={st.emptyTxt}>Không có dữ liệu</Text>
        </View>
      );
    return (
      <ScrollView
        style={{ maxHeight: '100%' }}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator
      >
        {rows.map((r, idx) => {
          const zebra = idx % 2 === 1;
          return (
            <View key={idx} style={[dtStyles.row, zebra && dtStyles.rowAlt]}>
              {COLS.map(c => {
                let val = r[c.key];
                if (c.key === 'start' || c.key === 'end') val = humanDT(val);
                if (c.key === 'kwh') val = safeNum(val);
                return (
                  <View
                    key={c.key}
                    style={[
                      dtStyles.cell,
                      wide
                        ? { flex: c.flex, minWidth: c.min }
                        : { minWidth: c.min, maxWidth: c.min },
                    ]}
                  >
                    {c.key === 'status' ? (
                      <StatusChip value={safeStr(r.status)} />
                    ) : (
                      <Text
                        style={[
                          dtStyles.cellTxt,
                          c.align === 'right' && { textAlign: 'right' },
                        ]}
                        numberOfLines={1}
                        allowFontScaling={false}
                      >
                        {safeStr(val)}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <View
      style={st.tableWrap}
      onLayout={e => setWrapW(e.nativeEvent.layout.width)}
    >
      {wide ? (
        <View style={{ flex: 1 }}>
          <HeaderRow />
          <Body />
        </View>
      ) : (
        <ScrollView
          horizontal
          bounces
          showsHorizontalScrollIndicator
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={{ flex: 1, minWidth: tableMinWidth }}>
            <HeaderRow />
            <Body />
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/* ================== Styles ================== */
const PRIMARY = '#2563EB';
const BG = '#F1F5F9';
const CARD = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT = '#0F172A';
const MUTED = '#475569';

const st = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },

  header: {
    width: '100%',
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  hTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: TEXT,
  },

  hActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  hBtn: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#E0E7FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  hIcon: { width: 16, height: 16, tintColor: PRIMARY, resizeMode: 'contain' },
  hBtnTxt: { color: PRIMARY, fontWeight: '700', fontSize: 13 },

  rangeRow: {
    flexDirection: 'column',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  rangeRowWebWide: { paddingBottom: 12 },

  webRowWide: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 20,
    width: '100%',
    marginTop: 6,
  },

  webRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    width: '100%',
    marginTop: 6,
  },
  webField: { gap: 4, flexDirection: 'column', flex: 1, minWidth: 120 },

  webFieldFixed: {
    gap: 6,
    flexDirection: 'column',
    width: 260,
    flexShrink: 0,
  },
  dateInputWide: { width: '100%' },
  applyBtnFixed: {
    width: 128,
    alignSelf: 'auto',
    marginLeft: 8,
  },

  rangeBtn: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calIcon: { width: 18, height: 18, tintColor: MUTED },
  rangeTitle: { fontSize: 12, fontWeight: '700', color: MUTED },
  rangeValue: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT,
    textAlign: 'right',
  },

  applyBtn: {
    height: 44,
    paddingHorizontal: 16,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 96,
    flexShrink: 0,
    shadowColor: '#2563EB',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  applyBtnBlock: { alignSelf: 'stretch' },
  applyTxt: { color: '#fff', fontWeight: '800', fontSize: 13, lineHeight: 18 },

  tableWrap: {
    flex: 1,
    marginTop: 10,
    marginHorizontal: 16,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  loading: { padding: 16, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { color: MUTED, fontWeight: '700' },

  pagiWrap: { marginTop: 8, paddingHorizontal: 16 },
});

const dtStyles = StyleSheet.create({
  headRow: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    backgroundColor: '#fff',
  },
  rowAlt: { backgroundColor: '#F8FAFC' },
  cell: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  headTxt: { fontSize: 12, fontWeight: '800', color: '#334155' },
  cellTxt: { fontSize: 12, color: '#0f172a' },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  chipTxt: { fontSize: 11, fontWeight: '700' },
});
;

const aStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    zIndex: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  text: { flex: 1, color: '#0f172a', fontWeight: '700' },
  closeBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  closeTxt: { fontWeight: '900', color: '#111827' },
  info: { backgroundColor: '#e0f2fe', borderWidth: 1, borderColor: '#bae6fd' },
  success: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  error: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca' },
});
