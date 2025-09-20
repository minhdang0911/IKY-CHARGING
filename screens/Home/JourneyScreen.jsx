// screens/Home/JourneyScreen.jsx
import React, { useEffect, useMemo, useRef, useState, useContext, useCallback } from 'react';
import {
  ActivityIndicator, Alert, Easing, Platform, Animated,
  StyleSheet, Text, TouchableOpacity, View, Dimensions, Image, FlatList, PanResponder,
  RefreshControl, TextInput,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Callout, MarkerAnimated } from 'react-native-maps';
import { AnimatedRegion } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDevices } from '../../apis/devices';
import { getCruise, getHistories } from '../../apis/cruise';
import iconStart from '../../assets/img/iconStart.png';
import iconEnd from '../../assets/img/iconEnd.png';
import bannerExpires from '../../assets/img/ic_expired.png';
import logoCar from '../../assets/img/ic_bike.png';
import { NotificationContext } from '../../App';
import { GOONG_MAPS_API_KEY } from '@env';

/* ================= i18n ================= */
const LANG_KEY = 'app_language';
const STRINGS = {
  vi: {
    headerList: (n) => `Danh sách xe (${n})`,
    headerJourney: (plate) => `Hành trình xe: ${plate || '—'}`,
    notifFrom: 'Journey',
    loadingVehicles: 'Đang tải danh sách xe...',
    retry: 'Thử lại',
    loadVehiclesFailTitle: 'Không tải được danh sách xe',
    loadVehiclesFailMsg: 'Lỗi không rõ',
    needToken: 'Thiếu accessToken — vui lòng đăng nhâp lại',
    needTokenShort: 'Thiếu accessToken.',
    needVehicle: 'Chưa chọn xe.',
    loadNowFailTitle: 'Lỗi tải vị trí hiện tại',
    loadHistFailTitle: 'Lỗi tải lịch sử',
    invalidRangeTitle: 'Khoảng thời gian không hợp lệ',
    invalidRangeMsg: 'Bắt đầu phải ≤ Kết thúc.',
    limit24hTitle: 'Giới hạn 24h',
    limit24hMsg: 'Khoảng Tùy chọn không được vượt quá 24 giờ.',
    noDatePicker: 'Thiếu DateTimePicker',
    useQuickRange: 'Dùng nhanh 1h/8h/24h.',
    pleaseWait: 'Vui lòng chờ…',
    now: 'Hiện tại',
    h1: '1 Giờ',
    h8: '8 Giờ',
    h24: '24 Giờ',
    custom: 'Tùy chọn',
    from: 'Từ',
    to: 'Đến',
    route: 'Lộ trình',
    duration: 'Thời gian',
    detail: 'Chi tiết hành trình',
    chooseRangeTitle: 'Chọn khoảng thời gian (≤ 24h)',
    fromDate: 'Từ ngày',
    toDate: 'Đến ngày',
    close: 'Đóng',
    ok: 'Đồng ý',
    cancel: 'Hủy',
    done: 'Xong',
    emptyInRange: 'Không có dữ liệu trong khoảng đã chọn.',
    expiredTitleA: 'Thiết bị',
    expiredTitleB: 'đã hết hạn sử dụng',
    expiredDesc: 'Quý khách vui lòng gia hạn để tránh gián đoạn.',
    renewNow: 'Gia hạn ngay',
    contactSupport: 'Hoặc liên hệ CSKH',
    supportPhone: '0902 806 999',
    vehiclePlate: (p) => `Biển số xe: ${p}`,
    driver: (d) => `Lái xe: ${d || '—'}`,
    expired: 'Hết hạn sử dụng',
    expDate: (d) => `Ngày hết hạn: ${d || '—'}`,
    atTime: 'Tại thời điểm',
    coord: 'Tọa độ',
    state: 'Trạng thái',
    address: 'Địa chỉ',
    version: 'Phiên bản',
    speed: 'Xe chạy',
    searchVehicle: 'Tìm xe theo biển số/IMEI…',
    selectVehicle: 'Chọn xe',
  },
  en: {
    headerList: (n) => `Vehicles (${n})`,
    headerJourney: (plate) => `Journey: ${plate || '—'}`,
    notifFrom: 'Journey',
    loadingVehicles: 'Loading vehicles…',
    retry: 'Retry',
    loadVehiclesFailTitle: 'Failed to load vehicles',
    loadVehiclesFailMsg: 'Unknown error',
    needToken: 'Missing accessToken.',
    needTokenShort: 'Missing accessToken.',
    needVehicle: 'No vehicle selected.',
    loadNowFailTitle: 'Failed to load current location',
    loadHistFailTitle: 'Failed to load history',
    invalidRangeTitle: 'Invalid time range',
    invalidRangeMsg: 'Start must be ≤ End.',
    limit24hTitle: '24h limit',
    limit24hMsg: 'Custom range must not exceed 24 hours.',
    noDatePicker: 'DateTimePicker not installed',
    useQuickRange: 'Use quick 1h/8h/24h.',
    pleaseWait: 'Please wait…',
    now: 'Now',
    h1: '1 Hour',
    h8: '8 Hours',
    h24: '24 Hours',
    custom: 'Custom',
    from: 'From',
    to: 'To',
    route: 'Distance',
    duration: 'Duration',
    detail: 'Journey details',
    chooseRangeTitle: 'Choose time range (≤ 24h)',
    fromDate: 'From date',
    toDate: 'To date',
    close: 'Close',
    ok: 'OK',
    cancel: 'Cancel',
    done: 'Done',
    emptyInRange: 'No data in the selected range.',
    expiredTitleA: 'Device',
    expiredTitleB: 'has expired',
    expiredDesc: 'Please renew to avoid interruption.',
    renewNow: 'Renew now',
    contactSupport: 'Or contact support',
    supportPhone: '0902 806 999',
    vehiclePlate: (p) => `Plate: ${p}`,
    driver: (d) => `Driver: ${d || '—'}`,
    expired: 'Expired',
    expDate: (d) => `Expires: ${d || '—'}`,
    atTime: 'At',
    coord: 'Coordinate',
    state: 'Status',
    address: 'Address',
    version: 'Version',
    speed: 'Speed',
    searchVehicle: 'Search plate/IMEI…',
    selectVehicle: 'Select vehicle',
  },
};
const tWithLang = (lang, key, ...args) => {
  const v = STRINGS[lang]?.[key];
  return typeof v === 'function' ? v(...args) : (v ?? key);
};

/* ================= consts & helpers ================= */
const { width: screenWidth } = Dimensions.get('window');
const DEFAULT_REGION = { latitude: 15.9, longitude: 106, latitudeDelta: 10, longitudeDelta: 10 };

// ARROW OPTIMIZATION: sampling + cap
const ARROW_STEP_M = 120;
const ARROW_CAP    = 120;

const to2 = (n) => String(n).padStart(2, '0');
const parseTim = (tim) => {
  try {
    if (!tim || tim.length < 12) return null;
    const yy = Number(tim.slice(0, 2));
    const MM = Number(tim.slice(2, 4)) - 1;
    const dd = Number(tim.slice(4, 6));
    const hh = Number(tim.slice(6, 8));
    const mm = Number(tim.slice(8, 10));
    const ss = Number(tim.slice(10, 12));
    return new Date(2000 + yy, MM, dd, hh, mm, ss);
  } catch { return null; }
};
const timeTextFromRec = (rec) => {
  const d = parseTim(rec?.tim); if (!d) return '—';
  return `${to2(d.getHours())}:${to2(d.getMinutes())}:${to2(d.getSeconds())} ${to2(d.getDate())}/${to2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
};
const formatTime = (d, lang='vi') =>
  d.toLocaleTimeString(lang === 'en' ? 'en-GB' : 'vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
const formatDate = (d, lang='vi') =>
  d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
const formatExpireDate = (iso, lang='vi') => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(lang === 'en' ? 'en-GB' : 'vi-VN', { day:'2-digit', month:'2-digit', year:'numeric' });
  } catch { return iso; }
};

/* geo helpers */
const distKm = (a, b) => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180, lat2 = (b.lat * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2), s2 = Math.sin(dLon / 2);
  const c = s1*s1 + Math.cos(lat1)*Math.cos(lat2)*s2*s2;
  return 2 * R * Math.asin(Math.sqrt(c));
};
const bearingDeg = (a, b) => {
  const toRad = (x) => (x * Math.PI) / 180;
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
  const Δλ = toRad(b.lon - a.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  let θ = Math.atan2(y, x) * 180 / Math.PI;
  return (θ + 360) % 360;
};
const midPoint = (a, b) => ({ latitude: (a.lat + b.lat) / 2, longitude: (a.lon + b.lon) / 2 });
const isFiniteCoord = (c) => Number.isFinite(c?.lat) && Number.isFinite(c?.lon);
const sortByTim = (arr) => [...arr].sort((x, y) => String(x?.tim || '').localeCompare(String(y?.tim || '')));

const getTimMs = (rec) => {
  if (rec?.tim) { const d = parseTim(rec.tim); if (d) return +d; }
  const cand = rec?.time || rec?.createdAt || rec?.updatedAt || rec?.timestamp;
  const t = cand ? new Date(cand).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
};

/* ===== Goong reverse geocode (NEW) + queue + cache ===== */
const addrCache = new Map();
const _now = () => Date.now();
class RGQueue {
  constructor(concurrency = 2, gapMs = 160) { this.q = []; this.running = 0; this.concurrency = concurrency; this.gapMs = gapMs; }
  enqueue(fn) { return new Promise((res, rej) => { this.q.push({ fn, res, rej }); this._run(); }); }
  _run() {
    if (this.running >= this.concurrency || this.q.length === 0) return;
    const { fn, res, rej } = this.q.shift();
    this.running++;
    (async () => {
      try { res(await fn()); } catch (e) { rej(e); }
      finally { this.running--; setTimeout(() => this._run(), this.gapMs); }
    })();
  }
}
const rgq = new RGQueue(2, 160);
const _getAddrCache = (k) => { const v = addrCache.get(k); if (!v) return null; if (v.exp <= _now()) { addrCache.delete(k); return null; } return v.val; };
const _setAddrCache = (k, val, ttl) => addrCache.set(k, { val, exp: _now() + ttl });

const goongReverse = async (lat, lon, timeoutMs = 2500) => {
  if (!GOONG_MAPS_API_KEY) return null;
  const url = `https://rsapi.goong.io/Geocode?latlng=${lat},${lon}&api_key=${GOONG_MAPS_API_KEY}`;
  const c = new AbortController(); const id = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: c.signal });
    if (!r.ok) return null;
    const j = await r.json();
    const first = j?.results?.[0];
    if (!first) return null;
    if (first.formatted_address) return first.formatted_address;

    const cmp = first.address_components || [];
    const pick = (k) => cmp.find(x => x.long_name && (x.types?.includes(k) || x.long_name.includes(k)))?.long_name;
    const road = pick('route') || cmp?.[0]?.long_name;
    const ward = pick('sublocality') || pick('administrative_area_level_3');
    const district = pick('administrative_area_level_2');
    const city = pick('administrative_area_level_1') || first?.compound?.province;
    const line = [road, ward, district, city].filter(Boolean).join(', ');
    return line || first?.name || first?.address || null;
  } catch {
    return null;
  } finally { clearTimeout(id); }
};

// Nominatim fallback
const nomReverse = async (lat, lon, timeoutMs = 2500) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&accept-language=vi&addressdetails=1`;
  const c = new AbortController(); const id = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'rn-tracker/1.0' }, signal: c.signal });
    const j = await r.json();
    const a = j?.address || {};
    const line1 = [a.house_number && a.road ? `${a.house_number} ${a.road}` : (a.road || ''), a.suburb || a.neighbourhood || a.village || a.town]
      .filter(Boolean).join(', ');
    const tail = [a.city || a.county, a.state, a.country].filter(Boolean).join(', ');
    return (line1 && tail) ? `${line1}, ${tail}` : (j?.display_name || null);
  } catch { return null; } finally { clearTimeout(id); }
};

const reverseGeocode = async (lat, lon) => {
  const key = `${lat.toFixed(6)},${lon.toFixed(6)}`;
  const hit = _getAddrCache(key); if (hit) return hit;

  const addr = await rgq.enqueue(async () => {
    return (await goongReverse(lat, lon, 2500))
        || (await nomReverse(lat, lon, 2500))
        || (await goongReverse(lat, lon, 4000))
        || '—';
  });

  _setAddrCache(key, addr, addr && addr !== '—' ? 24*3600*1000 : 45*1000);
  return addr;
};

/* ===== Helpers: address key + get-from-cache + ensure-before-show ===== */
const addrKey = (lat, lon) => `${Number(lat).toFixed(6)},${Number(lon).toFixed(6)}`;
const getCachedAddr = (lat, lon) => _getAddrCache(addrKey(lat, lon));
const setAddressFor = (lat, lon, setState) => {
  const cached = getCachedAddr(lat, lon);
  if (cached) { setState(cached); return true; }
  return false;
};
const ensureAddrThenShow = async ({ lat, lon, setState, showFn }) => {
  if (setAddressFor(lat, lon, setState)) {
    setTimeout(() => showFn?.(), 0);
    return;
  }
  setState('Đang lấy địa chỉ…');
  const addr = await reverseGeocode(lat, lon);
  setState(addr || '—');
  setTimeout(() => showFn?.(), 0);
};

/* ======== Perf: memo rows + fixed heights ======== */
const VEHICLE_ROW_H = 64;
const DETAIL_ROW_H  = 44;

const VehicleRow = React.memo(function VehicleRow({ item, selected, language, onPress }) {
  const expired = !!item?.date_exp && new Date(item.date_exp).getTime() < Date.now();
  const t = (k, ...a) => tWithLang(language, k, ...a);
  return (
    <TouchableOpacity
      style={[styles.vehicleMenuItem, { height: VEHICLE_ROW_H }]}
      onPress={() => onPress(item)}
      activeOpacity={0.85}
    >
      <View style={styles.vehicleMenuIcon}>
        <Image source={logoCar} style={styles.vehicleMenuImage} />
      </View>
      <View style={styles.vehicleMenuDetails}>
        <Text numberOfLines={1} style={styles.vehicleMenuPlate}>
          {item?.license_plate || item?.imei || '—'}{selected ? '  •  ✓' : ''}
        </Text>
        <Text numberOfLines={1} style={styles.vehicleMenuDriver}>
          {t('driver', item?.driver_name || item?.driver)}
        </Text>
        <Text
          numberOfLines={1}
          style={expired ? styles.vehicleMenuExpired : styles.vehicleMenuExpiry}
        >
          {expired ? t('expired') : t('expDate', formatExpireDate(item?.date_exp, language))}
        </Text>
      </View>
      <Icon name="chevron-right" size={20} color="#4A90E2" />
    </TouchableOpacity>
  );
});

const DetailRow = React.memo(function DetailRow({ item, onPress, statusCellText }) {
  return (
    <TouchableOpacity style={[styles.detailItem, { height: DETAIL_ROW_H }]} onPress={() => onPress(item)}>
      <Text style={styles.detailTime}>{timeTextFromRec(item)}</Text>
      <Text style={styles.detailStatus}>{statusCellText(item)}</Text>
    </TouchableOpacity>
  );
});

/* ================= Component ================= */
const JourneyScreen = ({ navigateToScreen }) => {
  const [language, setLanguage] = useState('vi');
  const t = useCallback((k, ...a) => tWithLang(language, k, ...a), [language]);
  useEffect(() => { (async () => { try { const saved = await AsyncStorage.getItem(LANG_KEY); if (saved) setLanguage(saved); } catch {} })(); }, []);

  /* ===== Map type ===== */
  const MAPTYPE_KEY = 'journey_map_type';
  const MAP_TYPES = Platform.select({
    ios: ['standard', 'satellite', 'hybrid'],
    android: ['standard', 'satellite', 'hybrid', 'terrain'],
    default: ['standard', 'satellite', 'hybrid']
  });
  const mapTypeLabelVi = (mt) => ({
    standard: 'Chuẩn',
    satellite: 'Vệ tinh',
    hybrid: 'Kết hợp',
    terrain: 'Địa hình',
  }[mt] || mt);
  const [mapType, setMapType] = useState('standard');

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(MAPTYPE_KEY);
        if (saved && MAP_TYPES.includes(saved)) setMapType(saved);
      } catch {}
    })();
  }, []);
  const cycleMapType = useCallback(async () => {
    const idx = MAP_TYPES.indexOf(mapType);
    const next = MAP_TYPES[(idx + 1) % MAP_TYPES.length];
    setMapType(next);
    try { await AsyncStorage.setItem(MAPTYPE_KEY, next); } catch {}
  }, [mapType]);

  /* time/UI */
  const [fromDateTime, setFromDateTime] = useState(new Date());
  const [toDateTime, setToDateTime] = useState(new Date());
  const [headerH, setHeaderH] = useState(0);
  const [selectedTimeRange, setSelectedTimeRange] = useState('now');
  const [mode, setMode] = useState('now'); // 'now' | 'range'
  const [showVehicleList, setShowVehicleList] = useState(false);
  const [showTimeModal, setShowTimeModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [pickerTarget, setPickerTarget] = useState({ side: 'from', mode: 'date' });
  const [showDetail, setShowDetail] = useState(false);
  const [busy, setBusy] = useState(false);

  /* data */
  const [devices, setDevices] = useState([]);
  thead = null;
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [devicesError, setDevicesError] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState(null);

  // search list
  const [vehicleSearch, setVehicleSearch] = useState('');
  const filteredDevices = useMemo(() => {
    const q = vehicleSearch.trim().toLowerCase();
    if (!q) return devices;
    return devices.filter((d) => {
      const plate = String(d?.license_plate || '').toLowerCase();
      const imei  = String(d?.imei || '').toLowerCase();
      const driver= String(d?.driver_name || d?.driver || '').toLowerCase();
      return plate.includes(q) || imei.includes(q) || driver.includes(q);
    });
  }, [devices, vehicleSearch]);

  const [nowPoint, setNowPoint] = useState(null);
  const [points, setPoints] = useState([]);
  const [selectedRec, setSelectedRec] = useState(null);
  const [currentAddress, setCurrentAddress] = useState('—');

  /* map & markers */
  const mapRef = useRef(null);
  const nowMarkerRef = useRef(null);

  const arrowRefMap = useRef({});
  const endMarkerRef = useRef(null);
  const movingMarkerRef = useRef(null);

  const [selectedArrowIdx, setSelectedArrowIdx] = useState(-1);
  const [selectedWhich, setSelectedWhich] = useState(null); // 'arrow' | 'end' | 'moving' | null

  /* playback */
  const movingCoord = useRef(new AnimatedRegion({
    latitude: DEFAULT_REGION.latitude,
    longitude: DEFAULT_REGION.longitude,
    latitudeDelta: 0,
    longitudeDelta: 0,
  })).current;
  const [isPlaying, setIsPlaying] = useState(false);
  const playingRef = useRef(false);
  const followCamRef = useRef(true);
  const playIdxRef = useRef(0);
  const fittedRef = useRef(false);
  const lastPosRef = useRef(null);

  // status helpers
  const getVgp = useCallback((rec) => {
    const v = Number(rec?.vgp);
    return Number.isFinite(v) && v >= 0 ? v : null;
  }, []);
  const statusFromData = useCallback((rec) => {
    if (rec?.acc != null) {
      const accOn = Number(rec.acc) === 1;
      const vgp = getVgp(rec);
      if (accOn) return vgp != null && vgp > 0.1 ? 'Xe chạy' : 'Đỗ xe';
      return 'Dừng xe';
    }
    const vgp = getVgp(rec);
    if (vgp != null && vgp > 0.1) return 'Xe chạy';
    if (vgp != null && vgp <= 0.1) return 'Đỗ xe';
    return 'Dừng xe';
  }, [getVgp]);
  const spdText = useCallback((rec) => {
    const v = getVgp(rec);
    return v != null ? `${v.toFixed(2)} km/h` : '0.00 km/h';
  }, [getVgp]);
  const statusCellText = useCallback((rec) => {
    const st = statusFromData(rec);
    if (st === 'Xe chạy') {
      const v = getVgp(rec);
      return v != null ? `${st} · ${v.toFixed(2)} km/h` : st;
    }
    return st;
  }, [statusFromData, getVgp]);

  // collapse noisy stop
  const collapseNoisyStops = useCallback((arr, { thresholdSec = 120, thresholdMeters = 40 } = {}) => {
    if (!Array.isArray(arr) || arr.length <= 1) return arr || [];
    const out = [];
    let lastKept = null;

    for (const p of arr) {
      if (!lastKept) { out.push(p); lastKept = p; continue; }

      const stP = statusFromData(p);
      const stL = statusFromData(lastKept);
      const bothStop = (stP === 'Đỗ xe' || stP === 'Dừng xe') && (stL === 'Đỗ xe' || stL === 'Dừng xe');

      if (bothStop && stP === stL) {
        const dt = Math.abs(getTimMs(p) - getTimMs(lastKept)) / 1000;
        const distM = distKm(p, lastKept) * 1000;
        if (dt <= thresholdSec && distM <= thresholdMeters) {
          continue;
        }
      }
      out.push(p);
      lastKept = p;
    }
    return out;
  }, [statusFromData]);

  // window sampler
  const filterHistoryData = useCallback((arr, { windowMinutes = 60, stopSample = 0.3 } = {}) => {
    if (!Array.isArray(arr) || arr.length <= 1) return arr || [];

    const windowMs = windowMinutes * 60 * 1000;
    let windowStart = getTimMs(arr[0]);
    let buf = [];
    const out = [];

    const flush = () => {
      if (!buf.length) return;

      const moving = buf.filter(p => statusFromData(p) === 'Xe chạy');
      out.push(...moving);

      const stops = buf.filter(p => {
        const s = statusFromData(p);
        return s === 'Đỗ xe' || s === 'Dừng xe';
      });

      if (stops.length > 0) {
        const keepCount = Math.max(1, Math.floor(stops.length * stopSample));
        const step = Math.max(1, Math.floor(stops.length / keepCount));
        for (let i = 0; i < stops.length; i += step) {
          out.push(stops[i]);
        }
      }

      const first = buf[0];
      const last = buf[buf.length - 1];
      if (first && !out.includes(first)) out.push(first);
      if (last && !out.includes(last)) out.push(last);

      buf = [];
    };

    for (const p of arr) {
      const t = getTimMs(p);
      if (t - windowStart <= windowMs) {
        buf.push(p);
      } else {
        flush();
        windowStart = t;
        buf.push(p);
      }
    }
    flush();

    return collapseNoisyStops(sortByTim(out));
  }, [collapseNoisyStops, statusFromData]);

  const pathPoints = useMemo(() => collapseNoisyStops(points), [points, collapseNoisyStops]);

  useEffect(() => {
    if (mode === 'range' && pathPoints.length >= 1) {
      movingCoord.setValue({
        latitude: pathPoints[0].lat,
        longitude: pathPoints[0].lon,
        latitudeDelta: 0,
        longitudeDelta: 0,
      });
      lastPosRef.current = { latitude: pathPoints[0].lat, longitude: pathPoints[0].lon };
      playIdxRef.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pathPoints.length]);

  /* notif */
  const { notifications, setNotifications } = useContext(NotificationContext);
  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const handleNotificationPress = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    navigateToScreen('notification', { from: t('notifFrom') });
  }, [navigateToScreen, setNotifications, t]);

  /* address on selected/now */
  useEffect(() => {
    const rec = selectedRec || nowPoint;
    if (!rec?.lat || !rec?.lon) { setCurrentAddress('—'); return; }
    const lat = Number(rec.lat), lon = Number(rec.lon);
    // KHÔNG set toạ độ thô để tránh nháy — show callout sẽ tự ensureAddr
    setCurrentAddress('Đang lấy địa chỉ…');
    rgq.enqueue(() => reverseGeocode(lat, lon)).then(setCurrentAddress).catch(() => {});
  }, [selectedRec, nowPoint]);

  /* devices */
  useEffect(() => { loadDevices(); }, []);
  const getAccessToken = async () =>
    (await AsyncStorage.getItem('access_token')) ||
    (await AsyncStorage.getItem('accessToken')) ||
    (await AsyncStorage.getItem('token'));

  const loadDevices = useCallback(async () => {
    try {
      setDevicesLoading(true); setDevicesError('');
      const token = await getAccessToken();
      if (!token) throw new Error(t('needToken'));
      const list = await getDevices(token);
      const arr = Array.isArray(list) ? list : [];
      setDevices(arr);
      if (arr.length && !selectedVehicle) setSelectedVehicle(arr[0]);
    } catch (e) {
      setDevicesError(e?.message || t('loadVehiclesFailMsg'));
      Alert.alert(t('loadVehiclesFailTitle'), e?.message || t('loadVehiclesFailMsg'));
    } finally {
      setDevicesLoading(false);
    }
  }, [t, selectedVehicle]);

  /* now point */
  useEffect(() => { if (selectedVehicle) fetchCurrent(); }, [selectedVehicle]);
  const fetchCurrent = useCallback(async () => {
    closeAllInfoPanels(false);
    try {
      setMode('now'); setSelectedTimeRange('now');
      playingRef.current = false; setIsPlaying(false); playIdxRef.current = 0; fittedRef.current = false; lastPosRef.current = null;
      setSelectedArrowIdx(-1); setSelectedWhich(null);

      const token = await getAccessToken(); if (!token) throw new Error(t('needTokenShort'));
      if (!selectedVehicle?._id) throw new Error(t('needVehicle'));

      const rec = await getCruise(token, selectedVehicle._id);
      if (rec) {
        const p = { ...rec, lat: Number(rec.lat), lon: Number(rec.lon) };
        setNowPoint(p); setSelectedRec(null); setPoints([]);

        mapRef.current?.animateToRegion(
          { latitude: p.lat, longitude: p.lon, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 300
        );
      }
      const now = new Date();
      setFromDateTime(now); setToDateTime(now);
    } catch (e) {
      Alert.alert(t('loadNowFailTitle'), e?.message || t('loadVehiclesFailMsg'));
    }
  }, [selectedVehicle, t]);

  /* Auto callout in NOW mode: chỉ show sau khi có địa chỉ */
  useEffect(() => {
    if (mode === 'now' && nowPoint && nowMarkerRef.current?.showCallout) {
      (async () => {
        await ensureAddrThenShow({
          lat: nowPoint.lat,
          lon: nowPoint.lon,
          setState: setCurrentAddress,
          showFn: () => nowMarkerRef.current?.showCallout?.(),
        });
      })();
    }
  }, [mode, nowPoint]);

  /* fetch histories */
  const fitOnce = useCallback((coords) => {
    if (fittedRef.current || !coords?.length) return;
    try {
      fittedRef.current = true;
      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 40, right: 40, bottom: 40, left: 40 }, animated: true,
      });
    } catch {}
  }, []);

  const fetchHistories = useCallback(async (from, to) => {
    closeAllInfoPanels(false);
    try {
      setBusy(true);
      playingRef.current = false;
      setIsPlaying(false);
      playIdxRef.current = 0;
      fittedRef.current = false;
      lastPosRef.current = null;
      setSelectedArrowIdx(-1);
      setSelectedWhich(null);

      const token = await getAccessToken();
      if (!token) throw new Error(t('needTokenShort'));

      const id = selectedVehicle?._id;
      if (!id) throw new Error(t('needVehicle'));

      if (to - from > 24 * 3600 * 1000) throw new Error(t('limit24hMsg'));

      const res = await getHistories(token, {
        id,
        dateFrom: new Date(+from),
        dateTo: new Date(+to),
      });

      const raw = (Array.isArray(res) ? res : [])
        .map(r => ({ ...r, lat: Number(r.lat), lon: Number(r.lon) }))
        .filter(isFiniteCoord);

      const sorted = sortByTim(raw);

      const filtered = filterHistoryData(sorted, {
        windowMinutes: 60,
        stopSample: 0.3,
      });

      setMode('range');
      setPoints(filtered);
      setSelectedRec(null);
      setNowPoint(null);
      setFromDateTime(new Date(from));
      setToDateTime(new Date(to));

      fitOnce(filtered.map(p => ({ latitude: p.lat, longitude: p.lon })));
    } catch (e) {
      Alert.alert(t('loadHistFailTitle'), e?.message || t('loadVehiclesFailMsg'));
    } finally {
      setBusy(false);
    }
  }, [filterHistoryData, fitOnce, selectedVehicle, t]);

  const [customTimeRange, setCustomTimeRange] = useState(() => {
    const now = new Date();
    return {
      fromDate: now, toDate: now,
      fromTime: `${to2(now.getHours())}:${to2(now.getMinutes())}`,
      toTime: `${to2(now.getHours())}:${to2(now.getMinutes())}`,
    };
  });

  const applyQuickRange = useCallback((hours) => {
    const to = new Date(Math.floor(Date.now() / 60000) * 60000);
    const from = new Date(to.getTime() - hours * 3600 * 1000);
    fetchHistories(from, to);
  }, [fetchHistories]);

  const handleTimeRangeSelect = useCallback((val) => {
    closeAllInfoPanels(false);
    setSelectedTimeRange(val);
    if (val === 'now') return fetchCurrent();
    if (val === '1h') return applyQuickRange(1);
    if (val === '8h') return applyQuickRange(8);
    if (val === '24h') return applyQuickRange(24);
    if (val === 'custom') setShowTimeModal(true);
  }, [applyQuickRange, fetchCurrent]);

  /* custom picker (lazy require) */
  let _dtp = null;
  const getRNDateTimePicker = () => {
    if (_dtp !== null) return _dtp;
    try { _dtp = require('@react-native-community/datetimepicker'); } catch { _dtp = undefined; }
    return _dtp;
  };
  const updateRangeValue = useCallback((side, modePick, d) => {
    if (modePick === 'date') {
      setCustomTimeRange((p) => ({ ...p, [side === 'from' ? 'fromDate' : 'toDate']: new Date(d) }));
    } else {
      const hh = to2(d.getHours()), mm = to2(d.getMinutes());
      setCustomTimeRange((p) => ({ ...p, [side === 'from' ? 'fromTime' : 'toTime']: `${hh}:${mm}` }));
    }
  }, []);
  const handleDatePicker = useCallback((modePick, isStart) => {
    const side = isStart ? 'from' : 'to';
    const current = isStart ? customTimeRange.fromDate : customTimeRange.toDate;
    setPickerTarget({ side, mode: modePick });
    const DTP = getRNDateTimePicker();
    if (!DTP) return Alert.alert(t('noDatePicker'), t('useQuickRange'));
    if (Platform.OS === 'android' && DTP?.DateTimePickerAndroid?.open) {
      setShowTimeModal(false);
      DTP.DateTimePickerAndroid.open({
        mode: modePick, value: current, is24Hour: true, display: 'default',
        onChange: (event, selectedDate) => {
          if (event?.type === 'dismissed' || !selectedDate) return;
          updateRangeValue(side, modePick, selectedDate);
          setShowTimeModal(true);
        },
      });
    } else {
      setTempDate(current);
      setShowDatePicker(true);
    }
  }, [customTimeRange.fromDate, customTimeRange.toDate, t, updateRangeValue]);
  const handleCustomTimeSubmit = useCallback(() => {
    const makeDT = (d, hhmm) => {
      const [hh, mm] = hhmm.split(':').map((n) => parseInt(n, 10));
      const out = new Date(d);
      out.setHours(hh || 0); out.setMinutes(mm || 0); out.setSeconds(0); out.setMilliseconds(0);
      return out;
    };
    const f = makeDT(customTimeRange.fromDate, customTimeRange.fromTime);
    const t2 = makeDT(customTimeRange.toDate, customTimeRange.toTime);
    if (f > t2) return Alert.alert(t('invalidRangeTitle'), t('invalidRangeMsg'));
    if (t2 - f > 24 * 3600 * 1000) return Alert.alert(t('limit24hTitle'), t('limit24hMsg'));
    closeAllInfoPanels(false);
    setShowTimeModal(false);
    fetchHistories(new Date(Math.floor(+f / 60000) * 60000), new Date(Math.floor(+t2 / 60000) * 60000));
  }, [customTimeRange, fetchHistories, t]);

  const routeCoordinates = useMemo(
    () => pathPoints.length ? pathPoints.map((p) => ({ latitude: p.lat, longitude: p.lon })) : [],
    [pathPoints]
  );
  const totalKm = useMemo(() => {
    if (pathPoints.length < 2) return 0;
    let s = 0; for (let i = 1; i < pathPoints.length; i++) s += distKm(pathPoints[i - 1], pathPoints[i]);
    return s;
  }, [pathPoints]);

  /* playback */
  const legDurationMs = useCallback((A, B) => {
    const dKm = distKm(A, B);
    const v = Number(getVgp(B) ?? getVgp(A) ?? 25);
    const ms = (dKm / Math.max(v, 1)) * 3600 * 1000;
    return Math.min(3500, Math.max(250, ms));
  }, [getVgp]);
  const findNearestIdx = useCallback((pos) => {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < pathPoints.length; i++) {
      const d = distKm({ lat: pos.latitude, lon: pos.longitude }, pathPoints[i]);
      if (d < bestD) { bestD = d; best = i; }
    }
    return Math.min(pathPoints.length - 2, Math.max(0, best));
  }, [pathPoints]);

  const animateCenterKeepZoom = useCallback(async (center, duration = 0) => {
    try {
      const cam = await mapRef.current?.getCamera?.();
      const keepZoom = cam?.zoom;
      mapRef.current?.animateCamera(
        { center, ...(keepZoom != null ? { zoom: keepZoom } : {}) },
        { duration }
      );
    } catch {
      mapRef.current?.animateCamera({ center }, { duration });
    }
  }, []);

  const runPlayback = useCallback(async () => {
    if (pathPoints.length < 2) return;
    playingRef.current = true; setIsPlaying(true);

    const fallbackIdx = Math.max(0, Math.min(pathPoints.length - 2, playIdxRef.current || 0));
    const fromPos = lastPosRef.current
      ? { latitude: lastPosRef.current.latitude, longitude: lastPosRef.current.longitude }
      : { latitude: pathPoints[fallbackIdx].lat, longitude: pathPoints[fallbackIdx].lon };
    const startIdx = lastPosRef.current ? findNearestIdx(fromPos) : fallbackIdx;

    movingCoord.setValue({
      latitude: fromPos.latitude,
      longitude: fromPos.longitude,
      latitudeDelta: 0,
      longitudeDelta: 0,
    });

    let keepZoom = null;
    try { const cam = await mapRef.current?.getCamera?.(); keepZoom = cam?.zoom ?? null; } catch {}

    if (followCamRef.current) {
      mapRef.current?.animateCamera(
        { center: { latitude: fromPos.latitude, longitude: fromPos.longitude }, ...(keepZoom != null ? { zoom: keepZoom } : {}) },
        { duration: 0 }
      );
    }

    for (let i = startIdx; i < pathPoints.length - 1; i++) {
      if (!playingRef.current) break;
      const A = pathPoints[i], B = pathPoints[i + 1];
      const dur = legDurationMs(A, B);
      playIdxRef.current = i;

      await new Promise((resolve) => {
        movingCoord.timing({
          latitude: B.lat,
          longitude: B.lon,
          latitudeDelta: 0,
          longitudeDelta: 0,
          duration: dur,
          easing: Easing.linear,
          useNativeDriver: false,
        }).start(() => resolve());
      });

      lastPosRef.current = { latitude: B.lat, longitude: B.lon };

      if (followCamRef.current) {
        mapRef.current?.animateCamera(
          { center: { latitude: B.lat, longitude: B.lon }, ...(keepZoom != null ? { zoom: keepZoom } : {}) },
          { duration: Math.min(400, dur) }
        );
      }
      if (!playingRef.current) break;
    }
    playIdxRef.current = pathPoints.length - 2;
    playingRef.current = false; setIsPlaying(false);
  }, [findNearestIdx, legDurationMs, movingCoord, pathPoints]);

  const hideAllCallouts = useCallback(() => {
    try { nowMarkerRef.current?.hideCallout?.(); } catch {}
    try { endMarkerRef.current?.hideCallout?.(); } catch {}
    try { movingMarkerRef.current?.hideCallout?.(); } catch {}
    try {
      Object.values(arrowRefMap.current || {}).forEach(r => r?.hideCallout?.());
    } catch {}
  }, []);

  const closeAllInfoPanels = useCallback((alsoCloseVehicles = true) => {
    if (alsoCloseVehicles) closeVehicleList();
    setShowTimeModal(false);
    setShowDatePicker(false);
    setShowDetail(false);
    setSelectedRec(null);
    setSelectedArrowIdx(-1);
    setSelectedWhich(null);
    hideAllCallouts();
  }, [hideAllCallouts]);

  // drawer
  const panelW = screenWidth * 0.78;
  const panelTx = useRef(new Animated.Value(-panelW)).current;

  const openVehicleList = useCallback(() => {
    setShowVehicleList(true);
    Animated.timing(panelTx, {
      toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true
    }).start();
  }, [panelTx]);
  const closeVehicleList = useCallback(() => {
    Animated.timing(panelTx, {
      toValue: -panelW, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: true
    }).start(() => setShowVehicleList(false));
  }, [panelTx, panelW]);

  const vehicleListPan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 6,
      onPanResponderMove: (_, g) => {
        const x = Math.min(0, Math.max(-panelW, g.dx));
        panelTx.setValue(x);
      },
      onPanResponderRelease: (_, g) => {
        const shouldClose = g.dx < -60 || g.vx < -0.6;
        Animated.timing(panelTx, {
          toValue: shouldClose ? -panelW : 0,
          duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true
        }).start(() => { if (shouldClose) setShowVehicleList(false); });
      },
    })
  ).current;

  const headerTitleText = useMemo(
    () => showVehicleList ? t('headerList', devices.length) : t('headerJourney', selectedVehicle?.license_plate || '—'),
    [showVehicleList, devices.length, selectedVehicle, t]
  );

  const isExpired = useCallback((iso) => { if (!iso) return false; try { return new Date(iso).getTime() < Date.now(); } catch { return false; } }, []);

  const onSelectVehicle = useCallback((item) => {
    setSelectedVehicle(item);
    closeVehicleList();
  }, [closeVehicleList]);

  const focusPointFromDrawer = useCallback(async (item) => {
    if (!pathPoints?.length) return;
    let idx = pathPoints.findIndex((p) => (p._id && item._id ? p._id === item._id : p.tim === item.tim));
    if (idx < 0) {
      const target = { latitude: item.lat, longitude: item.lon };
      idx = findNearestIdx(target);
    }
    const segIdx = Math.max(0, Math.min(pathPoints.length - 2, idx - 1));
    const A = pathPoints[segIdx], B = pathPoints[segIdx + 1] || pathPoints[segIdx];
    const mid = midPoint(A, B);
    setSelectedRec(B);
    setSelectedArrowIdx(segIdx);
    setSelectedWhich('arrow');
    await animateCenterKeepZoom({ latitude: mid.latitude, longitude: mid.longitude }, 0);
    ensureAddrThenShow({
      lat: B.lat,
      lon: B.lon,
      setState: setCurrentAddress,
      showFn: () => arrowRefMap.current?.[segIdx]?.showCallout?.(),
    });
  }, [animateCenterKeepZoom, findNearestIdx, pathPoints]);

  // ARROW CULLING + SAMPLING
  const pointInRegion = (p, r) => {
    const { latitude, longitude, latitudeDelta, longitudeDelta } = r || {};
    if (latitude == null) return true;
    const latMin = latitude - latitudeDelta / 2;
    const latMax = latitude + latitudeDelta / 2;
    const lonMin = longitude - longitudeDelta / 2;
    const lonMax = longitude + longitudeDelta / 2;
    return p.lat >= latMin && p.lat <= latMax && p.lon >= lonMin && p.lon <= lonMax;
  };
  const havDistM = (A, B) => distKm(A, B) * 1000;

  const [mapRegion, setMapRegion] = useState(DEFAULT_REGION);
  const regionDebRef = useRef(null);

  const arrowSegIndices = useMemo(() => {
    if (mode !== 'range' || pathPoints.length < 2) return [];
    const out = [];
    let acc = 0;
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const A = pathPoints[i], B = pathPoints[i + 1];
      if (!isFiniteCoord(A) || !isFiniteCoord(B)) continue;

      const d = havDistM(A, B);
      acc += d;

      if (acc >= ARROW_STEP_M) {
        acc = 0;
        const mid = { lat: (A.lat + B.lat) / 2, lon: (A.lon + B.lon) / 2 };
        if (pointInRegion(mid, mapRegion)) {
          out.push(i);
          if (out.length >= ARROW_CAP) break;
        }
      }
    }
    return out;
  }, [mode, pathPoints, mapRegion]);

  useEffect(() => {
    const keep = {};
    arrowSegIndices.forEach(i => { if (arrowRefMap.current?.[i]) keep[i] = arrowRefMap.current[i]; });
    arrowRefMap.current = keep;
  }, [arrowSegIndices]);

  const togglePlay = useCallback(() => {
    if (mode !== 'range' || pathPoints.length < 2) return;
    closeAllInfoPanels(false);
    if (playingRef.current) {
      playingRef.current = false; setIsPlaying(false);
      movingCoord.stopAnimation((pos) => {
        if (pos?.latitude && pos?.longitude) {
          lastPosRef.current = { latitude: pos.latitude, longitude: pos.longitude };
          playIdxRef.current = findNearestIdx(pos);
        }
      });
    } else runPlayback();
  }, [closeAllInfoPanels, findNearestIdx, mode, movingCoord, pathPoints.length, runPlayback]);

  /* ============== render ============== */
  return (
    <View style={styles.container}>
      <View style={styles.header} onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={showVehicleList ? closeVehicleList : openVehicleList}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Icon name={showVehicleList ? 'arrow-back' : 'menu'} size={22} color="white" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>{headerTitleText}</Text>

        {showVehicleList ? (
          <TouchableOpacity style={styles.notificationButton} onPress={loadDevices}>
            <Icon name="refresh" size={22} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.notificationButton} onPress={handleNotificationPress}>
            <View style={{ position: 'relative' }}>
              <Icon name="notifications" size={24} color="white" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}
      </View>

      {/* ===== VEHICLE DRAWER ===== */}
      {showVehicleList && (
        <View style={styles.drawerLayer} pointerEvents="box-none">
          <TouchableOpacity style={styles.drawerBackdrop} activeOpacity={1} onPress={closeVehicleList} />
          <Animated.View
            style={[styles.vehicleDrawer, { width: panelW, transform: [{ translateX: panelTx }], top: headerH }]}
            {...vehicleListPan.panHandlers}
          >
            <View style={styles.vehicleSheetHeader}>
              <Text style={styles.vehicleSheetTitle}>{t('selectVehicle')}</Text>
              <TouchableOpacity onPress={closeVehicleList} hitSlop={{ top:8,bottom:8,left:8,right:8 }}>
                <Icon name="close" size={22} color="#333" />
              </TouchableOpacity>
            </View>

            <Text style={styles.vehicleCountText}>{t('headerList', filteredDevices.length)}</Text>

            <FlatList
              data={filteredDevices}
              keyExtractor={(it, idx) => it._id || it.imei || String(idx)}
              refreshControl={<RefreshControl refreshing={devicesLoading} onRefresh={loadDevices} />}
              contentContainerStyle={{ paddingBottom: 16 }}
              renderItem={({ item }) => (
                <VehicleRow
                  item={item}
                  selected={selectedVehicle?._id === item?._id}
                  language={language}
                  onPress={onSelectVehicle}
                />
              )}
              getItemLayout={(_, index) => ({ length: VEHICLE_ROW_H, offset: VEHICLE_ROW_H * index, index })}
              initialNumToRender={12}
              maxToRenderPerBatch={24}
              windowSize={9}
              removeClippedSubviews
              extraData={selectedVehicle?._id}
              ListEmptyComponent={
                <View style={{ padding: 18, alignItems: 'center' }}>
                  <Text style={{ color: '#666' }}>{devicesLoading ? t('loadingVehicles') : 'Không có xe nào'}</Text>
                  {!!devicesError && <Text style={{ color: '#C62828', marginTop: 6 }}>{devicesError}</Text>}
                  {!devicesLoading && (
                    <TouchableOpacity onPress={loadDevices} style={{ marginTop: 10, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#4A90E2', borderRadius: 8 }}>
                      <Text style={{ color: '#fff', fontWeight: '600' }}>{t('retry')}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />
          </Animated.View>
        </View>
      )}

      {isExpired(selectedVehicle?.date_exp) ? (
        <View style={styles.expiredWrap}>
          <Text style={styles.expiredTitle}>
            {t('expiredTitleA')}{' '}
            <Text style={{ fontWeight: 'bold' }}>{selectedVehicle?.license_plate || selectedVehicle?.imei || '—'}</Text>{' '}
            {t('expiredTitleB')}
          </Text>
          <Image source={bannerExpires} style={styles.expiredBanner} resizeMode="contain" />
          <Text style={styles.expiredDesc}>{t('expiredDesc')}</Text>
          <TouchableOpacity style={styles.renewBtn} onPress={() => navigateToScreen('extend', { device: selectedVehicle })}>
            <Text style={styles.renewBtnText}>{t('renewNow')}</Text>
          </TouchableOpacity>
          <Text style={styles.supportText}>{t('contactSupport')}{' '}<Text style={styles.supportPhone}>{t('supportPhone')}</Text></Text>
        </View>
      ) : (
        <>
          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              initialRegion={{
                latitude: (nowPoint?.lat ?? DEFAULT_REGION.latitude),
                longitude: (nowPoint?.lon ?? DEFAULT_REGION.longitude),
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
              mapType={mapType}
              showsCompass
              showsTraffic={false}
              showsBuildings
              onPress={() => {}}
              onPanDrag={() => { followCamRef.current = false; }}
              onRegionChangeComplete={(r) => {
                if (regionDebRef.current) clearTimeout(regionDebRef.current);
                regionDebRef.current = setTimeout(() => setMapRegion(r), 120);
              }}
            >
              {/* polyline */}
              {mode === 'range' && routeCoordinates.length >= 2 && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#1E88E5"
                  strokeWidth={3}
                  lineCap="round"
                  lineJoin="round"
                />
              )}

              {/* direction arrows - Callout ENSURED */}
              {mode === 'range' && arrowSegIndices.map((segIdx) => {
                const A = pathPoints[segIdx], B = pathPoints[segIdx + 1];
                if (!isFiniteCoord(A) || !isFiniteCoord(B)) return null;
                const head = bearingDeg(A, B);
                const mid = midPoint(A, B);
                const active = selectedWhich === 'arrow' && selectedArrowIdx === segIdx;

                return (
                  <Marker
                    key={`arr-${segIdx}`}
                    ref={(r) => { if (r) arrowRefMap.current[segIdx] = r; }}
                    coordinate={mid}
                    anchor={{ x: 0.5, y: 0.5 }}
                    calloutAnchor={{ x: 0.5, y: 0 }}
                    tracksViewChanges={false}
                    zIndex={10}
                    onPress={() => {
                      setSelectedRec(B);
                      setSelectedArrowIdx(segIdx);
                      setSelectedWhich('arrow');

                      ensureAddrThenShow({
                        lat: B.lat,
                        lon: B.lon,
                        setState: setCurrentAddress,
                        showFn: () => arrowRefMap.current?.[segIdx]?.showCallout?.(),
                      });
                    }}
                  >
                    <View style={[styles.arrowContainer, { transform: [{ rotate: `${head}deg` }] }]}>
                      <View style={styles.arrowHead} />
                    </View>

                    <Callout tooltip
                      onPress={() => {}}
                      style={{ opacity: active ? 1 : 0 }}
                      pointerEvents={active ? 'auto' : 'none'}
                    >
                      <View style={styles.calloutSquare}>
                        {[
                          `${t('atTime')}: ${timeTextFromRec(B)}`,
                          `${t('coord')}: ${Number(B.lat).toFixed(6)}, ${Number(B.lon).toFixed(6)}`,
                          statusFromData(B) === 'Xe chạy'
                            ? `${t('speed')}: ${spdText(B)}`
                            : `${t('state')}: ${statusFromData(B)}`,
                          `${t('address')}: ${currentAddress}`,
                          `${t('version')}: ${B.fwr || '—'}`,
                        ].map((ln, idx) => (
                          <Text
                            key={idx}
                            style={styles.calloutLine}
                            numberOfLines={idx === 3 ? 5 : 2}  // địa chỉ dài cho 5 dòng
                          >
                            {ln}
                          </Text>
                        ))}
                      </View>
                    </Callout>
                  </Marker>
                );
              })}

              {/* END marker (range) */}
              {mode === 'range' && routeCoordinates.length >= 1 && (
                (() => {
                  const lastIdx = Math.max(0, pathPoints.length - 2);
                  const A = pathPoints[lastIdx], B = pathPoints[lastIdx + 1] || pathPoints[lastIdx];
                  const active = selectedWhich === 'end' && selectedArrowIdx === lastIdx;
                  return (
                    <Marker
                      ref={endMarkerRef}
                      coordinate={routeCoordinates[routeCoordinates.length - 1]}
                      anchor={{ x: 0.5, y: 1 }}
                      tracksViewChanges={false}
                      zIndex={5000}
                      onPress={() => {
                        const mid = midPoint(A, B);
                        setSelectedRec(B);
                        setSelectedArrowIdx(lastIdx);
                        setSelectedWhich('end');
                        animateCenterKeepZoom({ latitude: mid.latitude, longitude: mid.longitude }, 0)
                          .finally(() => {
                            ensureAddrThenShow({
                              lat: B.lat,
                              lon: B.lon,
                              setState: setCurrentAddress,
                              showFn: () => endMarkerRef.current?.showCallout?.(),
                            });
                          });
                      }}
                    >
                      <Image source={iconEnd} style={styles.startEndImg} resizeMode="contain" />
                      <Callout tooltip
                        style={{ opacity: active ? 1 : 0 }}
                        pointerEvents={active ? 'auto' : 'none'}
                      >
                        <View style={styles.calloutSquare}>
                          {[
                            `${t('atTime')}: ${timeTextFromRec(B)}`,
                            `${t('coord')}: ${Number(B.lat).toFixed(6)}, ${Number(B.lon).toFixed(6)}`,
                            statusFromData(B) === 'Xe chạy'
                              ? `${t('speed')}: ${spdText(B)}`
                              : `${t('state')}: ${statusFromData(B)}`,
                            `${t('address')}: ${currentAddress}`,
                            `${t('version')}: ${B.fwr || '—'}`,
                          ].map((ln, idx) => (
                            <Text key={idx} style={styles.calloutLine} numberOfLines={idx === 3 ? 5 : 2}>{ln}</Text>
                          ))}
                        </View>
                      </Callout>
                    </Marker>
                  );
                })()
              )}

              {/* NOW marker */}
              {mode === 'now' && nowPoint && isFiniteCoord(nowPoint) && (
                <Marker
                  ref={nowMarkerRef}
                  coordinate={{ latitude: nowPoint.lat, longitude: nowPoint.lon }}
                  anchor={{ x: 0.5, y: 1 }}
                  tracksViewChanges={false}
                  onPress={() => {
                    ensureAddrThenShow({
                      lat: nowPoint.lat,
                      lon: nowPoint.lon,
                      setState: setCurrentAddress,
                      showFn: () => nowMarkerRef.current?.showCallout?.(),
                    });
                  }}
                >
                  <Image source={iconStart} style={styles.startEndImg} resizeMode="contain" />
                  <Callout tooltip>
                    <View style={styles.calloutSquare}>
                      {[
                        `${t('atTime')}: ${timeTextFromRec(nowPoint)}`,
                        `${t('coord')}: ${Number(nowPoint.lat).toFixed(6)}, ${Number(nowPoint.lon).toFixed(6)}`,
                        statusFromData(nowPoint) === 'Xe chạy'
                          ? `${t('speed')}: ${spdText(nowPoint)}`
                          : `${t('state')}: ${statusFromData(nowPoint)}`,
                        `${t('address')}: ${currentAddress}`,
                        `${t('version')}: ${nowPoint.fwr || '—'}`,
                      ].map((ln, i) => (
                        <Text key={i} style={styles.calloutLine} numberOfLines={i === 3 ? 5 : 2}>{ln}</Text>
                      ))}
                    </View>
                  </Callout>
                </Marker>
              )}

              {/* Animated moving marker (range) */}
              {mode === 'range' && pathPoints.length >= 1 && (
                (() => {
                  const idx = Math.max(0, Math.min(pathPoints.length - 2, selectedArrowIdx));
                  const A = pathPoints[idx] || pathPoints[0];
                  const B = pathPoints[idx + 1] || pathPoints[idx] || pathPoints[0];
                  const active = selectedWhich === 'moving';
                  return (
                    <MarkerAnimated
                      ref={movingMarkerRef}
                      coordinate={movingCoord}
                      anchor={{ x: 0.5, y: 1 }}
                      tracksViewChanges={false}
                      zIndex={3000}
                      onPress={() => {
                        movingCoord.stopAnimation(async (pos) => {
                          const p = pos?.latitude ? pos : lastPosRef.current;
                          if (!p) return;
                          const nearIdx = findNearestIdx({ latitude: p.latitude, longitude: p.longitude });
                          const AA = pathPoints[nearIdx], BB = pathPoints[nearIdx + 1] || pathPoints[nearIdx];
                          const mid = midPoint(AA, BB);
                          setSelectedRec(BB);
                          setSelectedArrowIdx(nearIdx);
                          setSelectedWhich('moving');
                          await animateCenterKeepZoom({ latitude: mid.latitude, longitude: mid.longitude }, 0);
                          ensureAddrThenShow({
                            lat: BB.lat,
                            lon: BB.lon,
                            setState: setCurrentAddress,
                            showFn: () => movingMarkerRef.current?.showCallout?.(),
                          });
                        });
                      }}
                    >
                      <Image source={iconStart} style={styles.startEndImg} resizeMode="contain" />
                      <Callout tooltip
                        style={{ opacity: active ? 1 : 0 }}
                        pointerEvents={active ? 'auto' : 'none'}
                      >
                        <View style={styles.calloutSquare}>
                          {[
                            `${t('atTime')}: ${timeTextFromRec(B)}`,
                            `${t('coord')}: ${Number(B.lat).toFixed(6)}, ${Number(B.lon).toFixed(6)}`,
                            statusFromData(B) === 'Xe chạy'
                              ? `${t('speed')}: ${spdText(B)}`
                              : `${t('state')}: ${statusFromData(B)}`,
                            `${t('address')}: ${currentAddress}`,
                            `${t('version')}: ${B.fwr || '—'}`,
                          ].map((ln, idx2) => (
                            <Text key={idx2} style={styles.calloutLine} numberOfLines={idx2 === 3 ? 5 : 2}>{ln}</Text>
                          ))}
                        </View>
                      </Callout>
                    </MarkerAnimated>
                  );
                })()
              )}
            </MapView>

            {/* map type switch */}
            <TouchableOpacity style={[styles.mapTypeBtn, { top: 10 }]} onPress={cycleMapType}>
              <Icon name="layers" size={18} color="#4A90E2" />
              <Text style={styles.mapTypeText}>{mapTypeLabelVi(mapType)}</Text>
            </TouchableOpacity>
          </View>

          {/* compact time range */}
          <View style={styles.timeControls}>
            <View style={styles.timeRangeSelector}>
              <Text style={styles.timeLabel}>{t('from')} {formatTime(fromDateTime, language)} {formatDate(fromDateTime, language)}</Text>
              <TouchableOpacity style={styles.calendarButton} onPress={() => handleTimeRangeSelect('custom')}>
                <Icon name="event" size={18} color="#4A90E2" />
              </TouchableOpacity>
            </View>
            <View style={styles.timeRangeSelector}>
              <Text style={styles.timeLabel}>{t('to')} {formatTime(toDateTime, language)} {formatDate(toDateTime, language)}</Text>
              <TouchableOpacity style={styles.calendarButton} onPress={() => handleTimeRangeSelect('custom')}>
                <Icon name="event" size={18} color="#4A90E2" />
              </TouchableOpacity>
            </View>
          </View>

          {/* bottom summary + play */}
          <View style={styles.journeySummary}>
            <View style={styles.summaryLeft}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{t('route')}</Text>
                <Text style={styles.summaryValue}>{mode === 'range' ? `${totalKm.toFixed(2)} km` : '—'}</Text>
              </View>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryLabel}>{t('duration')}</Text>
                <Text style={styles.summaryValueSmall}>
                  {Math.floor((toDateTime - fromDateTime) / 3600000)} {language === 'en' ? 'h' : 'giờ'}{' '}
                  {Math.floor(((toDateTime - fromDateTime) % 3600000) / 60000)} {language === 'en' ? 'min' : 'phút'}
                </Text>
              </View>
              <TouchableOpacity style={styles.detailRow} onPress={() => setShowDetail(true)}>
                <Text style={styles.detailText}>{t('detail')}</Text>
                <Icon name="chevron-right" size={18} color="#4A90E2" />
              </TouchableOpacity>
            </View>
            <View style={styles.summaryRight}>
              <TouchableOpacity
                style={[styles.startPauseButton, (mode !== 'range' || pathPoints.length < 2) ? { opacity: 0.4 } : null]}
                onPress={togglePlay}
                disabled={mode !== 'range' || pathPoints.length < 2}
              >
                <Icon name={isPlaying ? 'pause' : 'play-arrow'} size={26} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* quick buttons */}
          <View style={styles.timeRangeButtons}>
            {[
              { label: t('now'), val: 'now' },
              { label: t('h1'), val: '1h' },
              { label: t('h8'), val: '8h' },
              { label: t('h24'), val: '24h' },
              { label: t('custom'), val: 'custom' },
            ].map(({ label, val }) => {
              const active = selectedTimeRange === val;
              return (
                <TouchableOpacity key={val} style={[styles.timeRangeButton, active && styles.activeTimeRangeButton]} onPress={() => handleTimeRangeSelect(val)}>
                  <Text style={[styles.timeRangeButtonText, active && styles.activeTimeRangeButtonText]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom time modal */}
          {showTimeModal && (
            <View style={styles.modalBackdrop}>
              <View style={[styles.customTimeModalWrapper, { marginTop: headerH + 120 }]}>
                <View style={styles.customTimeModal}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{t('chooseRangeTitle')}</Text>
                    <TouchableOpacity onPress={() => setShowTimeModal(false)}><Icon name="close" size={24} color="#333" /></TouchableOpacity>
                  </View>

                  <View style={styles.timeInputSection}>
                    <Text style={styles.sectionTitle}>{t('fromDate')}</Text>
                    <View style={styles.timeInputRow}>
                      <TouchableOpacity style={styles.dateInput} onPress={() => handleDatePicker('date', true)}>
                        <Text style={styles.dateInputText}>{formatDate(customTimeRange.fromDate, language)}</Text>
                        <Icon name="calendar-today" size={18} color="#4A90E2" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.timeInput} onPress={() => handleDatePicker('time', true)}>
                        <Text style={styles.timeInputText}>{customTimeRange.fromTime}</Text>
                        <Icon name="access-time" size={18} color="#4A90E2" />
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.sectionTitle}>{t('toDate')}</Text>
                    <View style={styles.timeInputRow}>
                      <TouchableOpacity style={styles.dateInput} onPress={() => handleDatePicker('date', false)}>
                        <Text style={styles.dateInputText}>{formatDate(customTimeRange.toDate, language)}</Text>
                        <Icon name="calendar-today" size={18} color="#4A90E2" />
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.timeInput} onPress={() => handleDatePicker('time', false)}>
                        <Text style={styles.timeInputText}>{customTimeRange.toTime}</Text>
                        <Icon name="access-time" size={18} color="#4A90E2" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.cancelButton} onPress={() => setShowTimeModal(false)}>
                      <Text style={styles.cancelButtonText}>{STRINGS[language].close}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.confirmButton} onPress={handleCustomTimeSubmit}>
                      <Text style={styles.confirmButtonText}>{STRINGS[language].ok}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* iOS picker sheet */}
          {showDatePicker && (() => {
            const DTP = getRNDateTimePicker(); const Cmp = DTP?.default || DTP;
            return (
              <View style={styles.datePickerModalOverlay}>
                <View style={styles.datePickerModal}>
                  <View style={styles.datePickerHeader}>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}><Text style={styles.datePickerCancel}>{STRINGS[language].cancel}</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => { updateRangeValue(pickerTarget.side, pickerTarget.mode, tempDate); setShowDatePicker(false); setTimeout(() => setShowTimeModal(true), 0); }}>
                      <Text style={styles.datePickerDone}>{STRINGS[language].done}</Text>
                    </TouchableOpacity>
                  </View>
                  {Cmp ? <Cmp value={tempDate} mode={pickerTarget.mode} is24Hour display="spinner" onChange={(e, d) => d && setTempDate(d)} style={styles.iosDatePicker} /> : null}
                </View>
              </View>
            );
          })()}

          {/* Right drawer (chi tiết) */}
          {showDetail && (
            <View style={styles.modalBackdrop}>
              <View style={[styles.rightDrawer, { top: headerH }]}>
                <View style={styles.sheetHeader}>
                  <Text style={styles.modalTitle}>{t('headerJourney', selectedVehicle?.license_plate || '—')}</Text>
                  <TouchableOpacity onPress={() => setShowDetail(false)}><Icon name="close" size={22} color="#333" /></TouchableOpacity>
                </View>
                <View style={styles.detailTableHeader}>
                  <Text style={styles.tableHeaderText}>{t('from')}</Text>
                  <Text style={styles.tableHeaderText}>{t('state')}</Text>
                </View>
                <FlatList
                  data={pathPoints}
                  keyExtractor={(it, idx) => it._id || String(idx)}
                  renderItem={({ item }) => (
                    <DetailRow item={item} onPress={(it) => {
                      setShowDetail(false);
                      focusPointFromDrawer(it);
                    }} statusCellText={statusCellText} />
                  )}
                  getItemLayout={(_, index) => ({ length: DETAIL_ROW_H, offset: DETAIL_ROW_H * index, index })}
                  initialNumToRender={60}
                  maxToRenderPerBatch={120}
                  windowSize={11}
                  removeClippedSubviews
                  ListEmptyComponent={<View style={{ padding: 16 }}><Text style={{ color: '#666' }}>{t('emptyInRange')}</Text></View>}
                />
              </View>
            </View>
          )}

          {/* Busy overlay */}
          {busy && (
            <View style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.6)',
              zIndex: 99999,
              justifyContent: 'center',
              alignItems: 'center'
            }}>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={{ color: '#fff', marginTop: 12, fontSize: 16 }}>{t('pleaseWait')}</Text>
            </View>
          )}

        </>
      )}
    </View>
  );
};

/* ================= styles ================= */
const { width: W, height: H } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },

  header: { backgroundColor: '#4A90E2', paddingHorizontal: 12, paddingTop: 14, paddingBottom: 10, flexDirection: 'row', alignItems: 'center' },
  menuButton: { padding: 4, marginRight: 6 },
  headerTitle: { color: 'white', fontSize: 17, fontWeight: '600', flex: 1 },
  notificationButton: { padding: 4 },

  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },

  startEndImg: { width: 36, height: 36 },

  mapTypeBtn: {
    position: 'absolute', right: 10, width: 100, height: 40, borderRadius: 12, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center', elevation: 3, flexDirection: 'row', gap: 6,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  mapTypeText: { fontSize: 12, color: '#4A90E2', fontWeight: '700', textTransform: 'none' },

  /* CALL OUT: nới rộng + cao để địa chỉ dài không bị che */
  calloutSquare: {
    minWidth: Math.min(W * 0.56, 280),
    maxWidth: Math.min(W * 0.9, 360),
    maxHeight: Math.min(H * 0.5, 350),   
    backgroundColor: '#3b86e5',
    borderRadius: 12,                     
    paddingHorizontal: 10,
    elevation: 5,
  },
  calloutLine: { color: '#ffffff', fontSize: 12, lineHeight: 16, marginBottom: 3 },

  /* time controls */
  timeControls: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 5, gap: 8 },
  timeRangeSelector: {
    flex: 1, backgroundColor: 'white', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#eaeaea',
  },
  timeLabel: { fontSize: 12, color: '#333' },
  calendarButton: { padding: 2 },

  journeySummary: {
    backgroundColor: 'white', marginHorizontal: 10, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  summaryLeft: { flex: 1, gap: 2 },
  summaryRight: { marginLeft: 8, justifyContent: 'center', alignItems: 'center' },
  summaryItem: {},
  summaryLabel: { fontSize: 12, color: '#666' },
  summaryValue: { fontSize: 16, fontWeight: '700', color: '#4A90E2' },
  summaryValueSmall: { fontSize: 14, fontWeight: '700', color: '#4A90E2' },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  detailText: { fontSize: 13, color: '#4A90E2', fontWeight: '600' },
  startPauseButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#4A90E2', justifyContent: 'center', alignItems: 'center' },

  timeRangeButtons: { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 6, gap: 8, flexWrap: 'wrap' },
  timeRangeButton: { flexGrow: 1, minWidth: (W - 10 * 2 - 8 * 4) / 5, backgroundColor: 'white', borderRadius: 16, paddingVertical: 7, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  activeTimeRangeButton: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
  timeRangeButtonText: { fontSize: 13, color: '#666' },
  activeTimeRangeButtonText: { color: 'white', fontWeight: '600' },

  /* overlays & date pickers */
  modalBackdrop: { position:'absolute', top:0, left:0, right:0, bottom:0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 9999 },
  datePickerModalOverlay: { position:'absolute', left:0, right:0, bottom:0, top:0, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', zIndex: 10000 },
  datePickerModal: { backgroundColor: 'white', paddingBottom: 10, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  datePickerHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  datePickerCancel: { color: '#666', fontSize: 16 },
  datePickerDone: { color: '#4A90E2', fontSize: 16, fontWeight: '600' },
  iosDatePicker: { height: 220 },

  customTimeModalWrapper: { paddingHorizontal: 12 },
  customTimeModal: { backgroundColor: 'white', borderRadius: 12, padding: 12 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  timeInputSection: { marginTop: 6 },
  sectionTitle: { fontSize: 13, color: '#333', marginBottom: 6 },
  timeInputRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  dateInput: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f7f7f7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9 },
  dateInputText: { fontSize: 14, color: '#333' },
  timeInput: { width: 106, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f7f7f7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9 },
  timeInputText: { fontSize: 14, color: '#333' },
  modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  cancelButton: { paddingHorizontal: 14, paddingVertical: 9, backgroundColor: '#eee', borderRadius: 10 },
  cancelButtonText: { color: '#333' },
  confirmButton: { paddingHorizontal: 16, paddingVertical: 9, backgroundColor: '#4A90E2', borderRadius: 10 },
  confirmButtonText: { color: 'white', fontWeight: '600' },

 badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#E53935',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },

  /* arrow view */
  arrowContainer: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', opacity: 0.95 },
  arrowHead: {
    width: 0, height: 0,
    borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 9,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#2ecc71'
  },

  /* ===== Vehicle drawer styles ===== */
  drawerLayer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10000 },
  drawerBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)' },
  vehicleDrawer: {
    position: 'absolute',
    left: 0, bottom: 0,
    backgroundColor: '#fff',
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 12, paddingTop: 10,
    elevation: 12,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 2, height: 0 },
  },
  vehicleSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2, marginBottom: 6 },
  vehicleSheetTitle: { fontSize: 16, fontWeight: '700', color: '#333' },

  vehicleSearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f5f6f8', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, marginBottom: 6 },
  vehicleSearchInput: { flex: 1, fontSize: 14, color: '#333', paddingVertical: 0 },

  vehicleCountText: { fontSize: 12, color: '#666', paddingVertical: 4, paddingHorizontal: 2 },

  vehicleMenuItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f2f2f2', borderRadius: 8, marginVertical: 3, backgroundColor: '#fff',
  },
  vehicleMenuIcon: { backgroundColor: '#4A90E2', borderRadius: 6, padding: 6, marginRight: 12, width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  vehicleMenuImage: { width: 16, height: 16, resizeMode: 'contain' },
  vehicleMenuDetails: { flex: 1 },
  vehicleMenuPlate: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 2 },
  vehicleMenuDriver: { fontSize: 12, color: '#666', marginBottom: 2 },
  vehicleMenuExpiry: { fontSize: 12, color: '#666' },
  vehicleMenuExpired: { fontSize: 12, color: '#C62828', fontWeight: '600' },

  /* right drawer (details) */
  rightDrawer: {
    position: 'absolute', right: 0, bottom: 0, backgroundColor: 'white', borderTopLeftRadius: 18, borderBottomLeftRadius: 18,
    paddingHorizontal: 14, paddingTop: 12, paddingBottom: 10, elevation: 10,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: -2, height: 0 },
    width: screenWidth * 0.88,
    zIndex: 10000,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  detailTableHeader: { flexDirection: 'row', backgroundColor: '#f8f9fa', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, marginBottom: 8 },
  tableHeaderText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#333' },
  detailItem: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  detailTime: { flex: 1, fontSize: 12, color: '#666' },
  detailStatus: { flex: 1, fontSize: 12, color: '#333' },

  /* expired */
  expiredWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  expiredTitle: { fontSize: 18, fontWeight: '500', color: '#000', marginBottom: 15, textAlign: 'center' },
  expiredBanner: { width: '80%', height: 200, marginBottom: 20 },
  expiredDesc: { fontSize: 14, color: '#444', textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  renewBtn: { backgroundColor: '#4A90E2', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  renewBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  supportText: { fontSize: 13, color: '#555', textAlign: 'center', marginTop: 8 },
  supportPhone: { color: '#1e88e5', fontWeight: 'bold' },
});

export default JourneyScreen;
