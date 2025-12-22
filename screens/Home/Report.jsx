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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import DocumentPicker from 'react-native-document-picker';
import RNFS from 'react-native-fs';
import * as XLSX from 'xlsx';
import AsyncStorage from '@react-native-async-storage/async-storage';
import XlsxPopulate from 'xlsx-populate/browser/xlsx-populate';
import Share from 'react-native-share';

// ==== APIs ====
import { getSessionsByRange } from '../../apis/devices';

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

// ==== Android assets template ====
const DEFAULT_TEMPLATE_ASSET = 'session_report_template.xlsx';
const DEFAULT_TEMPLATE_FILENAME = 'Báo cáo chi tiết hoạt động.xlsx';

// ===================== Custom Alert (queued) =====================
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
    return () => {};
  }, [queue, current]);

  const dismissNow = () => {
    timerRef.current && clearTimeout(timerRef.current);
    setCurrent(null);
  };

  const node = current ? (
    <View style={[
      aStyles.wrap,
      current.type === 'success' && aStyles.success,
      current.type === 'error' && aStyles.error,
      current.type === 'info' && aStyles.info
    ]}>
      <Text style={aStyles.text} numberOfLines={3}>{current.msg}</Text>
      <TouchableOpacity onPress={dismissNow} style={aStyles.closeBtn}>
        <Text style={aStyles.closeTxt}>✕</Text>
      </TouchableOpacity>
    </View>
  ) : null;

  return { show, node };
}

// ===================== Helpers =====================
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
  let last = 1;
  let emptyStreak = 0;
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

const humanDate = (d) => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
};

const writeDateHeader = (sheet, fromDate, toDate) => {
  const text = `Từ ${humanDate(fromDate)} đến ${humanDate(toDate)}`;
  const MAX_R = 10, MAX_C = 12;
  let placed = false;
  for (let r = 1; r <= MAX_R && !placed; r++) {
    for (let c = 1; c <= MAX_C && !placed; c++) {
      const raw = sheet.cell(r, c).value();
      if (!raw) continue;
      const s = String(raw);
      if (/^Từ\s*dd\/mm/.test(s) || /\{\{from_to\}\}/i.test(s)) {
        sheet.cell(r, c).value(text)
          .style({ horizontalAlignment: 'center', verticalAlignment: 'center', bold: true });
        placed = true;
      }
    }
  }
  if (!placed) {
    sheet.cell(2, 2).value(text)
      .style({ horizontalAlignment: 'center', verticalAlignment: 'center', bold: true });
  }
};

// range UTC nguyên ngày
const toUtcDayRange = (dFrom, dTo) => {
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const f = new Date(Date.UTC(dFrom.getFullYear(), dFrom.getMonth(), dFrom.getDate()));
  const t = new Date(Date.UTC(dTo.getFullYear(), dTo.getMonth(), dTo.getDate()));
  return {
    fromIso: `${ymd(f)}T00:00:00.000Z`,
    toIso: `${ymd(t)}T23:59:59.999Z`,
  };
};

function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function humanDT(s) {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${m}/${y} ${hh}:${mm}`;
}
function safeStr(v) { return (v ?? '') + ''; }
function safeNum(v) {
  if (typeof v === 'number') return v.toFixed(3);
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(3) : '';
}
function dateSlug(d) { return d ? isoDate(d) : 'unknown'; }

// === make output path & share ===
const makeOutputPath = (name) => {
  const file = name || `BaoCaoTramSac_${Date.now()}.xlsx`;
  return Platform.OS === 'android'
    ? `${RNFS.DownloadDirectoryPath}/${file}`
    : `${RNFS.DocumentDirectoryPath}/${file}`;
};

async function saveAndShareBase64({ base64, filename }) {
  const outPath = makeOutputPath(filename);
  await RNFS.writeFile(outPath, base64, 'base64');
  await Share.open({
    url: 'file://' + outPath,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    failOnCancel: false,
  });
  return outPath;
}

function autoFitCols(ws, aoa) {
  const colCount = Math.max(...aoa.map(r => r.length));
  const colWidths = new Array(colCount).fill(10);
  aoa.forEach(row => row.forEach((cell, idx) => {
    const len = (cell === undefined || cell === null) ? 0 : String(cell).length;
    if (len + 2 > colWidths[idx]) colWidths[idx] = len + 2;
  }));
  ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w, 40) }));
}

// ===================== Android: copy template from assets -> Download + Share =====================
async function exportAndroidAssetToDownloads({ assetName, filename }) {
  if (Platform.OS !== 'android') {
    throw new Error('Chỉ hỗ trợ Android cho tính năng này.');
  }

  console.log('[tpl] assetName =', assetName);
  console.log('[tpl] DownloadDirectoryPath =', RNFS.DownloadDirectoryPath);

  // 1) list assets (Android) -> xem có thấy file không
  try {
    const assets = await RNFS.readDirAssets('');
    console.log('[tpl] assets root:', assets.map(x => x.name));
  } catch (e) {
    console.log('[tpl] readDirAssets err:', e);
  }

  // 2) thử read asset
  let base64;
  try {
    base64 = await RNFS.readFileAssets(assetName, 'base64');
    console.log('[tpl] readFileAssets OK, b64 len =', base64?.length);
  } catch (e) {
    console.log('[tpl] readFileAssets FAIL:', e);
    throw e;
  }

  const outPath = `${RNFS.DownloadDirectoryPath}/${filename}`;
  console.log('[tpl] outPath =', outPath);

  // 3) ghi file
  try {
    await RNFS.writeFile(outPath, base64, 'base64');
    console.log('[tpl] writeFile OK');
  } catch (e) {
    console.log('[tpl] writeFile FAIL:', e);
    throw e;
  }

  // 4) confirm tồn tại
  try {
    const ex = await RNFS.exists(outPath);
    console.log('[tpl] exists after write =', ex);
  } catch (e) {
    console.log('[tpl] exists check err:', e);
  }

  // 5) share
  try {
    await Share.open({
      url: 'file://' + outPath,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      failOnCancel: false,
    });
  } catch (e) {
    console.log('[tpl] share err:', e);
  }

  return outPath;
}


async function getDefaultTemplateB64FromAndroidAssets() {
  if (Platform.OS !== 'android') return null;
  try {
    const b64 = await RNFS.readFileAssets(DEFAULT_TEMPLATE_ASSET, 'base64');
    return b64;
  } catch (e) {
    return null;
  }
}

// ===================== Main Screen =====================
export default function SessionReportScreen() {
  const [from, setFrom] = useState(null);
  const [to, setTo] = useState(null);
  const [pickField, setPickField] = useState(null);

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  // limit
  const VIEW_LIMIT = 10;       // bảng hiển thị (phân trang)
  const EXPORT_LIMIT = 1000;   // xuất Excel

  const [totalPages, setTotalPages] = useState(1);
  const [rows, setRows] = useState([]);
  const [rawSessions, setRawSessions] = useState([]);

  const alert = useAlertQueue();

  // === fetch data cho UI (VIEW_LIMIT) ===
  const loadData = useCallback(async (_page = page) => {
    try {
      if (!from || !to) {
        alert.show('info', 'Chọn ngày bắt đầu và ngày kết thúc.', 2200);
        return;
      }

      const accessToken = await AsyncStorage.getItem(K_ACCESS_TOKEN);
      if (!accessToken) {
        alert.show('error', 'Không tìm thấy token. Vui lòng đăng nhập lại.', 2500);
        return;
      }

      setLoading(true);

      const { fromIso, toIso } = toUtcDayRange(from, to);

      const res = await getSessionsByRange(accessToken, {
        page: _page,
        limit: VIEW_LIMIT,
        from: fromIso,
        to: toIso
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
        kwh: it.energy_used_kwh ?? it.kwh
      }));

      setRows(mapped);
      alert.show('success', `Đã tải ${mapped.length} dòng (Trang ${res?.page || _page}/${res?.totalPages || 1})`, 1800);
    } catch (e) {
      console.log('[loadData] err:', e);
      alert.show('error', `Tải dữ liệu thất bại: ${e.message || 'Lỗi không xác định'}`, 2800);
    } finally {
      setLoading(false);
    }
  }, [page, from, to]);

  // === header actions ===

  // 1) Tải mẫu template (Android assets -> Download)
  const onDownloadTemplateMobile = useCallback(async () => {
    try {
      const outPath = await exportAndroidAssetToDownloads({
        assetName: DEFAULT_TEMPLATE_ASSET,
        filename: DEFAULT_TEMPLATE_FILENAME,
      });
      alert.show('success', `Đã tải template: ${outPath}`, 2200);
    } catch (e) {
      console.log('[download template] err', e);
      Alert.alert('Lỗi', e?.message ? String(e.message) : 'Không tải được template');
      alert.show('error', 'Không tải được template.', 2500);
    }
  }, [alert]);

  // 2) Import template (user chọn file -> lưu base64 vào AsyncStorage)
  const onImportTemplate = useCallback(async () => {
    try {
      const f = await DocumentPicker.pickSingle({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          DocumentPicker.types.allFiles
        ],
        copyTo: 'cachesDirectory'
      });
      const path = (f.fileCopyUri || f.uri || '').replace('file://', '');
      const b64 = await RNFS.readFile(path, 'base64');

      const testWb = await XlsxPopulate.fromDataAsync(b64, { base64: true });
      if (!testWb.sheet('Sheet1')) throw new Error('Template phải có sheet "Sheet1".');

      await AsyncStorage.setItem(K_REPORT_TEMPLATE, b64);
      alert.show('success', `Đã import template (${f.name || 'template.xlsx'}).`, 2500);
    } catch (e) {
      if (!DocumentPicker.isCancel(e)) {
        console.log('[import template] err', e);
        alert.show('error', e?.message ? String(e.message) : 'Import template lỗi.', 2500);
      }
    }
  }, []);

  // === Export: KHÔNG TEMPLATE (fetch 1000, save+share RNFS)
  const onExportNoTemplate = useCallback(async () => {
    try {
      if (!from || !to) {
        alert.show('info', 'Chọn khoảng ngày trước khi xuất.', 2200);
        return;
      }
      const accessToken = await AsyncStorage.getItem(K_ACCESS_TOKEN);
      if (!accessToken) {
        alert.show('error', 'Không tìm thấy token. Vui lòng đăng nhập lại.', 2500);
        return;
      }

      const { fromIso, toIso } = toUtcDayRange(from, to);
      const res = await getSessionsByRange(accessToken, {
        page: 1,
        limit: EXPORT_LIMIT,
        from: fromIso,
        to: toIso
      });
      const data = Array.isArray(res?.data) ? res.data : [];
      if (!data.length) {
        alert.show('info', 'Không có dữ liệu để xuất.', 2200);
        return;
      }

      const aoa = [
        ['Cổng', 'Mã đơn', 'Bắt đầu', 'Kết thúc', 'Trạng thái', 'kWh'],
        ...data.map(it => ([
          it.portNumber ?? it.port ?? '',
          it.order_id ?? '',
          humanDT(it.startTime),
          humanDT(it.endTime),
          it.status ?? '',
          Number(it.energy_used_kwh ?? it.kwh ?? 0)
        ]))
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      autoFitCols(ws, aoa);
      XLSX.utils.book_append_sheet(wb, ws, 'DATA');

      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const filename = `session_report_${dateSlug(from || new Date())}_${dateSlug(to || new Date())}.xlsx`;

      const outPath = await saveAndShareBase64({ base64, filename });
      alert.show('success', `Đã xuất & chia sẻ: ${outPath}`, 2200);
    } catch (e) {
      console.log('[export no tpl] err', e);
      Alert.alert('Lỗi xuất', String(e?.message || e));
      alert.show('error', 'Xuất báo cáo thất bại.', 2500);
    }
  }, [from, to]);

  // === Export: DÙNG TEMPLATE
  // - ưu tiên template đã Import trong AsyncStorage
  // - nếu chưa import => tự dùng template mặc định trong Android assets
  const onExportWithTemplate = useCallback(async () => {
    try {
      if (!from || !to) {
        alert.show('info', 'Chọn khoảng ngày trước khi xuất.', 2200);
        return;
      }

      let tpl = await AsyncStorage.getItem(K_REPORT_TEMPLATE);

      // fallback: lấy template mặc định trong android assets
      if (!tpl) {
        const fallback = await getDefaultTemplateB64FromAndroidAssets();
        if (!fallback) {
          alert.show('error', 'Không tìm thấy template mặc định trong Android assets.', 3000);
          Alert.alert('Thiếu template', 'Hãy đặt file template vào android/app/src/main/assets/session_report_template.xlsx');
          return;
        }
        tpl = fallback;
        alert.show('info', 'Chưa import template — đang dùng template mặc định.', 2500);
      }

      const accessToken = await AsyncStorage.getItem(K_ACCESS_TOKEN);
      if (!accessToken) {
        alert.show('error', 'Không tìm thấy token. Vui lòng đăng nhập lại.', 2500);
        return;
      }

      const { fromIso, toIso } = toUtcDayRange(from, to);
      const res = await getSessionsByRange(accessToken, {
        page: 1,
        limit: EXPORT_LIMIT,
        from: fromIso,
        to: toIso
      });
      const exportData = Array.isArray(res?.data) ? res.data : [];
      if (!exportData.length) {
        alert.show('info', 'Không có dữ liệu để xuất.', 2200);
        return;
      }

      // Gom theo device + port
      const deviceMap = new Map();
      for (const s of exportData) {
        const deviceKey =
          s.device_serial || s.deviceSerial ||
          s.device_name || s.deviceName ||
          s.device_id || s.deviceId || 'unknown';
        const port = Number(s.portNumber || s.port || 0) || 0;
        if (!deviceMap.has(deviceKey)) deviceMap.set(deviceKey, { deviceKey, ports: new Map() });
        const d = deviceMap.get(deviceKey);
        if (!d.ports.has(port)) d.ports.set(port, { totalKwh: 0, totalRevenue: 0 });

        const p = d.ports.get(port);
        p.totalKwh += Number(s.energy_used_kwh || s.kwh || 0);

        // nếu API sessions không có amount thì cột doanh thu sẽ 0 (giữ nguyên logic của mobile bạn)
        p.totalRevenue += Number(s.amount_vnd ?? s.total_price_vnd ?? s.price_vnd ?? 0);
      }
      for (const d of deviceMap.values()) {
        for (const p of d.ports.values()) {
          p.avgPrice = p.totalKwh > 0 ? Math.round((p.totalRevenue / p.totalKwh) * 100) / 100 : 0;
        }
      }
      const summaries = Array.from(deviceMap.values());

      // mở template
      const workbook = await XlsxPopulate.fromDataAsync(tpl, { base64: true });
      const sheet = workbook.sheet('Sheet1');
      if (!sheet) throw new Error('Không thấy sheet "Sheet1" trong template.');

      // header ngày
      writeDateHeader(sheet, from || new Date(), to || new Date());

      // detect blocks
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
            } else if (c === '') {
              rr++;
            } else break;
          }
          if (ports.length) blocks.push({ deviceHeaderRow, ports });
        }
      }
      if (!blocks.length) throw new Error('Template không có block “Thiết bị / Cổng” hợp lệ.');

      // Fill data
      const COL_KWH = 2; // B
      const COL_REV = 3; // C
      const COL_AVG = 4; // D

      blocks.forEach((b, i) => {
        const sum = summaries[i] || null;

        if (sum?.deviceKey && sum.deviceKey !== 'unknown') {
          const cur = String(sheet.cell(b.deviceHeaderRow, 1).value() || '').replace(/\s*-\s*.*/, '');
          const label = `${cur} - ${sum.deviceKey}`;
          sheet.cell(b.deviceHeaderRow, 1).value(label);
        }

        for (const p of b.ports) {
          const found = sum?.ports?.get(p.portNumber) || { totalKwh: 0, totalRevenue: 0, avgPrice: 0 };
          const kwh = Number(found.totalKwh || 0);
          const rev = Number(found.totalRevenue || 0);
          const avg = Number(found.avgPrice || 0);

          sheet.cell(p.row, COL_KWH).value(kwh).style('numberFormat', '0.###');
          sheet.cell(p.row, COL_REV).value(rev).style('numberFormat', '#,##0');
          sheet.cell(p.row, COL_AVG).value(avg).style('numberFormat', '#,##0.00');
        }
      });

      const outB64 = await workbook.outputAsync('base64');
      const filename = `session_report_tpl_${dateSlug(from || new Date())}_${dateSlug(to || new Date())}.xlsx`;

      const outPath = await saveAndShareBase64({ base64: outB64, filename });
      alert.show('success', `Đã xuất & chia sẻ: ${outPath}`, 2200);
    } catch (e) {
      console.log('[export with tpl] err', e);
      Alert.alert('Lỗi xuất', String(e?.message || e));
      alert.show('error', e?.message ? String(e.message) : 'Xuất báo cáo bằng template thất bại.', 2500);
    }
  }, [from, to]);

  // === pagination handlers ===
  const onPrev = () => { if (page > 1) { const p = page - 1; loadData(p); } };
  const onNext = () => { if (page < totalPages) { const p = page + 1; loadData(p); } };
  const onJump = (p) => { loadData(p); };

  return (
    <View style={st.container}>
      {alert.node}

      <View style={st.header}>
        <Text style={st.hTitle}>Báo cáo phiên sạc</Text>
      </View>

      <View style={st.hActions}>
        {/* ✅ Nút tải template từ Android assets ra Download */}
        <HeaderBtn icon={icExportRaw} label="Tải mẫu template" onPress={onDownloadTemplateMobile} />

        <HeaderBtn icon={icImport} label="Import template" onPress={onImportTemplate} />
        <HeaderBtn icon={icExport} label="Xuất dùng template" onPress={onExportWithTemplate} />
        <HeaderBtn icon={icExportRaw} label="Xuất không template" onPress={onExportNoTemplate} />
        <HeaderBtn icon={icReload} label="Tải dữ liệu" onPress={() => loadData(1)} />
      </View>

      <View style={st.rangeRow}>
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
      </View>

      {/* ====== TABLE: cuộn ngang + compact ====== */}
      <DataTable rows={rows} loading={loading} />

      <View style={{ marginTop: 8, paddingHorizontal: 12, paddingBottom: 12 }}>
        <PaginationControls
          page={page}
          totalPages={totalPages}
          onPrev={onPrev}
          onNext={onNext}
          onJump={onJump}
          showGoto
        />
      </View>

      {pickField && (
        <DateTimePicker
          value={pickField === 'from' ? (from || new Date()) : (to || new Date())}
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

// ===================== UI bits =====================
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
      <Text style={st.rangeTitle} numberOfLines={1} allowFontScaling={false}>{title}</Text>
      <Text style={st.rangeValue} numberOfLines={1} allowFontScaling={false}>{value}</Text>
    </TouchableOpacity>
  );
}

/* ---------- DataTable (compact + horizontal scroll) ---------- */
const COLS = [
  { key: 'port', label: 'Cổng', width: 72, align: 'left' },
  { key: 'order', label: 'Mã đơn', width: 160, align: 'left' },
  { key: 'start', label: 'Bắt đầu', width: 160, align: 'left' },
  { key: 'end', label: 'Kết thúc', width: 160, align: 'left' },
  { key: 'status', label: 'Trạng thái', width: 120, align: 'left' },
  { key: 'kwh', label: 'kWh', width: 90, align: 'right' },
];

function StatusChip({ value }) {
  const v = String(value || '').toLowerCase();
  let bg = '#e2e8f0', fg = '#0f172a';
  if (v.includes('run')) { bg = '#dbeafe'; fg = '#1d4ed8'; }
  else if (v.includes('compl')) { bg = '#dcfce7'; fg = '#166534'; }
  else if (v.includes('fail') || v.includes('error') || v.includes('cancel')) { bg = '#fee2e2'; fg = '#991b1b'; }
  return (
    <View style={[dtStyles.chip, { backgroundColor: bg }]}>
      <Text style={[dtStyles.chipTxt, { color: fg }]} numberOfLines={1}>{value || ''}</Text>
    </View>
  );
}

function DataTable({ rows, loading }) {
  const tableWidth = COLS.reduce((s, c) => s + c.width, 0);

  return (
    <View style={st.tableWrap}>
      <ScrollView
        horizontal
        bounces
        showsHorizontalScrollIndicator
        contentContainerStyle={{ flexGrow: 1 }}
      >
        <View style={{ flex: 1, minWidth: tableWidth }}>
          {/* Header */}
          <View style={dtStyles.headRow}>
            {COLS.map((c) => (
              <View key={c.key} style={[dtStyles.cell, { minWidth: c.width, maxWidth: c.width }]}>
                <Text
                  style={[
                    dtStyles.headTxt,
                    c.align === 'right' && { textAlign: 'right' }
                  ]}
                  numberOfLines={1}
                >
                  {c.label}
                </Text>
              </View>
            ))}
          </View>

          {/* Body */}
          {loading ? (
            <View style={st.loading}><ActivityIndicator /></View>
          ) : rows.length === 0 ? (
            <View style={st.empty}><Text style={st.emptyTxt}>Không có dữ liệu</Text></View>
          ) : (
            <ScrollView style={{ maxHeight: '100%' }}>
              {rows.map((r, idx) => {
                const zebra = idx % 2 === 1;
                return (
                  <View key={idx} style={[dtStyles.row, zebra && dtStyles.rowAlt]}>
                    {COLS.map((c) => {
                      let val = r[c.key];
                      if (c.key === 'start' || c.key === 'end') val = humanDT(val);
                      if (c.key === 'kwh') val = safeNum(val);
                      return (
                        <View key={c.key} style={[dtStyles.cell, { minWidth: c.width, maxWidth: c.width }]}>
                          {c.key === 'status' ? (
                            <StatusChip value={safeStr(r.status)} />
                          ) : (
                            <Text
                              style={[
                                dtStyles.cellTxt,
                                c.align === 'right' && { textAlign: 'right' }
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
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// ===================== Styles =====================
const PRIMARY = '#2563EB';
const BG = '#F8FAFC';
const CARD = '#FFFFFF';
const BORDER = '#E5E7EB';
const TEXT = '#0F172A';
const MUTED = '#475569';

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG, paddingTop: Platform.OS === 'android' ? 0 : 10 },

  header: {
    width: '100%',
    backgroundColor: '#1e88e5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10
  },
  hTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },

  hActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: CARD,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER
  },
  hBtn: {
    height: 38, paddingHorizontal: 12, borderRadius: 10,
    backgroundColor: '#EEF2FF', flexDirection: 'row', alignItems: 'center', gap: 6
  },
  hIcon: { width: 16, height: 16, tintColor: PRIMARY },
  hBtnTxt: { color: PRIMARY, fontWeight: '800', fontSize: 13 },

  rangeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER,
    backgroundColor: CARD
  },
  rangeBtn: {
    flex: 1, height: 42, borderWidth: 1, borderColor: BORDER, borderRadius: 10,
    backgroundColor: '#fff', paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  },
  calIcon: { width: 18, height: 18, tintColor: MUTED },
  rangeTitle: { fontSize: 12, fontWeight: '700', color: MUTED },
  rangeValue: { fontSize: 13, fontWeight: '800', color: TEXT, textAlign: 'right' },

  applyBtn: { height: 42, paddingHorizontal: 14, backgroundColor: PRIMARY, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  applyTxt: { color: '#fff', fontWeight: '800' },

  tableWrap: {
    flex: 1, marginTop: 10, marginHorizontal: 12, backgroundColor: CARD,
    borderRadius: 12, borderWidth: 1, borderColor: BORDER, overflow: 'hidden'
  },

  loading: { padding: 16, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 24, alignItems: 'center', justifyContent: 'center' },
  emptyTxt: { color: MUTED, fontWeight: '700' },
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
  cell: { paddingVertical: 10, paddingHorizontal: 12, justifyContent: 'center' },
  headTxt: { fontSize: 12, fontWeight: '800', color: '#334155' },
  cellTxt: { fontSize: 12, color: '#0f172a' },

  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  chipTxt: { fontSize: 11, fontWeight: '800' },
});

const aStyles = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 12, left: 12, right: 12, zIndex: 999,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, elevation: 4
  },
  text: { flex: 1, color: '#0f172a', fontWeight: '700' },
  closeBtn: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.06)' },
  closeTxt: { fontWeight: '900', color: '#111827' },
  info: { backgroundColor: '#e0f2fe', borderWidth: 1, borderColor: '#bae6fd' },
  success: { backgroundColor: '#dcfce7', borderWidth: 1, borderColor: '#bbf7d0' },
  error: { backgroundColor: '#fee2e2', borderWidth: 1, borderColor: '#fecaca' },
});
