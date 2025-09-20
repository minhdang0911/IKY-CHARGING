// screens/Home/MonitoringScreen.jsx
import React, { useState, useEffect, useRef, useMemo, useContext, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Alert,
  Dimensions, Animated, Easing, Linking, Image, Platform, PermissionsAndroid, TextInput,
  ActivityIndicator, KeyboardAvoidingView, ScrollView, TouchableWithoutFeedback, Keyboard,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from 'react-native-geolocation-service';
import { API_PAY, GOONG_MAPS_API_KEY } from '@env';

import logoCar from '../../assets/img/ic_bike.png';
import iconsDerection from '../../assets/img/ic_direction.png';
import logoSOS from '../../assets/img/ic_sos_off.png';
import logoMoto from '../../assets/img/ic_location_white_24dp.png';
import logoStar from '../../assets/img/iconStart.png';
import bannerExpires from '../../assets/img/ic_expired.png';
import logoActive from '../../assets/img/ic_not_activated.png';
import { NotificationContext } from '../../App';
import { showMessage } from '../../components/Toast/Toast';

import { getDevices } from '../../apis/devices';
import { getCruise } from '../../apis/cruise';

// MQTT (native TCP)
import MQTT from 'sp-react-native-mqtt';

// QR scanner
import QRCodeScanner from 'react-native-qrcode-scanner';
import { RNCamera } from 'react-native-camera';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

/* ================= i18n ================= */
const LANG_KEY = 'app_language';
const STRINGS = {
  vi: {
    headerList: (n) => `Danh sách xe (${n})`,
    headerTitle: (plate) => `Giám sát xe: ${plate || '—'}`,
    expiredTitle: (plate) => `Thiết bị ${plate || '—'} đã hết hạn sử dụng`,
    expiredDesc: 'Vui lòng gia hạn để tiếp tục sử dụng dịch vụ.',
    renewNow: 'Gia hạn ngay',
    notice: 'Thông báo',
    close: 'Đóng',
    agree: 'Đồng ý',
    loadingVehicles: 'Đang tải danh sách xe...',
    retry: 'Thử lại',
    vehiclePlate: (p) => `Biển số xe: ${p}`,
    driver: (d) => `Lái xe: ${d || '—'}`,
    expired: 'Hết hạn sử dụng',
    expiryDate: (d) => `Ngày hết hạn: ${d || '—'}`,
    calloutAtTime: (s) => `Tại thời điểm: ${s}`,
    calloutCoord: (lat, lon) => `Tọa độ: ${lat} , ${lon}`,
    calloutStatus: (s) => `Trạng thái: ${s}`,
    calloutAddr: (a) => `Địa chỉ: ${a}`,
    calloutFwr: (v) => `Phiên bản: ${v || '—'}`,
    sosTitle: 'Cảnh báo',
    sosMsg: 'Chế độ tắt máy khẩn cấp dùng khi bị cướp xe. Thiết bị sẽ hú còi, 30s sau tắt máy.',
    sosHowto: 'Thao tác bên dưới sẽ gửi lệnh qua MQTT.',
    sosOn: 'Kích hoạt SOS',
    sosOff: 'Thoát SOS',
    ok: 'Đóng',
    errNoToken: 'Không lấy được danh sách thiết bị.',
    errNoCruise: 'Không lấy được hành trình hiện tại.',
    smsFail: 'Không mở được ứng dụng SMS.',
    noPhone: 'Thiết bị chưa có số điện thoại.',
    navToHere: 'Chỉ đường',
    notifications: 'Thông báo',
    notActivated: (id) => `Thiết bị ${id} chưa được kích hoạt`,
    enterPhone: 'Số điện thoại chủ xe',
    activateNow: 'Kích hoạt ngay',
    or: 'Hoặc',
    scanQR: 'Quét mã',
  },
  en: {
    headerList: (n) => `Vehicles (${n})`,
    headerTitle: (plate) => `Monitoring: ${plate || '—'}`,
    expiredTitle: (plate) => `Device ${plate || '—'} has expired`,
    expiredDesc: 'Please renew to continue using the service.',
    renewNow: 'Renew now',
    notice: 'Notice',
    close: 'Close',
    agree: 'Confirm',
    loadingVehicles: 'Loading vehicles...',
    retry: 'Retry',
    vehiclePlate: (p) => `Plate: ${p}`,
    driver: (d) => `Driver: ${d || '—'}`,
    expired: 'Expired',
    expiryDate: (d) => `Expiry date: ${d || '—'}`,
    calloutAtTime: (s) => `At: ${s}`,
    calloutCoord: (lat, lon) => `Coordinates: ${lat} , ${lon}`,
    calloutStatus: (s) => `Status: ${s}`,
    calloutAddr: (a) => `Address: ${a}`,
    calloutFwr: (v) => `Firmware: ${v || '—'}`,
    sosTitle: 'Emergency',
    sosMsg: 'Emergency engine-off mode against theft. The device will siren and cut off after 30s.',
    sosHowto: 'Actions below send commands via MQTT.',
    sosOn: 'Activate SOS',
    sosOff: 'Exit SOS',
    ok: 'Close',
    errNoToken: 'Failed to fetch devices.',
    errNoCruise: 'Failed to fetch current cruise.',
    smsFail: 'Failed to open SMS app.',
    noPhone: 'Device phone number is missing.',
    navToHere: 'Navigate',
    notifications: 'Notifications',
    notActivated: (id) => `Device ${id} not activated`,
    enterPhone: 'Owner phone number',
    activateNow: 'Activate now',
    or: 'Or',
    scanQR: 'Scan code',
  },
};
const useI18n = () => {
  const [lang, setLang] = useState('vi');
  useEffect(() => { (async () => { try { const s = await AsyncStorage.getItem(LANG_KEY); if (s) setLang(s); } catch {} })(); }, []);
  const t = (k, ...args) => {
    const val = STRINGS[lang][k];
    return typeof val === 'function' ? val(...args) : val ?? k;
  };
  return { lang, t };
};
/* ===================================== */

const toSec = (t) => {
  if (!t && t !== 0) return undefined;
  const n = Number(t);
  if (Number.isNaN(n)) return undefined; 
  return n > 1e12 ? Math.floor(n / 1000) : Math.floor(n);
};

// "250822083850" -> Date
const parseIkyTime = (str) => {
  if (!/^\d{12}$/.test(String(str || ''))) return null;
  const dd = Number(str.slice(0, 2));
  const MM = Number(str.slice(2, 4)) - 1;
  const yy = 2000 + Number(str.slice(4, 6));
  const HH = Number(str.slice(6, 8));
  const mm = Number(str.slice(8, 10));
  const ss = Number(str.slice(10, 12));
  try { return new Date(yy, MM, dd, HH, mm, ss); } catch { return null; }
};

/* ========= Goong + fallback Nominatim ========= */
const goongReverse = async (lat, lon, timeoutMs = 2500) => {
  if (!GOONG_MAPS_API_KEY) return null;
  const url = `https://rsapi.goong.io/Geocode?latlng=${lat},${lon}&api_key=${GOONG_MAPS_API_KEY}`;
  const c = new AbortController(); const to = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json' }, signal: c.signal });
    if (!r.ok) return null;
    const j = await r.json();
    const first = j?.results?.[0];
    if (!first) return null;
    return first.formatted_address || first?.name || null;
  } catch { return null; } finally { clearTimeout(to); }
};
const nomReverse = async (lat, lon, timeoutMs = 2500) => {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&namedetails=0&polygon_geojson=0&accept-language=vi`;
  const c = new AbortController(); const to = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'rn-tracker/1.0' }, signal: c.signal });
    const j = await r.json();
    return j?.display_name || null;
  } catch { return null; } finally { clearTimeout(to); }
};
async function reverseGeocodeVi(lat, lon) {
  if (typeof lat !== 'number' || typeof lon !== 'number') return '—';
  return (await goongReverse(lat, lon, 2500))
      || (await nomReverse(lat, lon, 2500))
      || (await goongReverse(lat, lon, 4000))
      || '—';
}
/* ============================================= */

const getVgpLikeJourney = (rec) => {
  const v = Number(rec?.vgp ?? rec?.spd ?? rec?.speed);
  return Number.isFinite(v) && v >= 0 ? v : null;
};
const statusFromDataLikeJourney = (rec) => {
  if (rec?.acc != null) {
    const accOn = Number(rec.acc) === 1;
    const vgp = getVgpLikeJourney(rec);
    if (accOn) return vgp != null && vgp > 0.1 ? 'Xe chạy' : 'Đỗ xe';
    return 'Dừng xe';
  }
  const vgp = getVgpLikeJourney(rec);
  if (vgp != null && vgp > 0.1) return 'Xe chạy';
  if (vgp != null && vgp <= 0.1) return 'Đỗ xe';
  return 'Dừng xe';
};
const spdTextLikeJourney = (rec) => {
  const v = getVgpLikeJourney(rec);
  return v != null ? `chạy xe ${v.toFixed(2)} km/h` : '0.00 km/h';
};

/* ================= Activation APIs (inline) ================= */
const OTP_GEN = `${API_PAY}/api/sms/OTPgencode`;
const ACTIVATE_BY_OTP  = `${API_PAY}/api/devices/activeByOTP`;
const ACTIVATE_BY_CODE = `${API_PAY}/api/devices/activeByCode`;

const toForm = (data) =>
  Object.entries(data).filter(([, v]) => v != null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');

async function postForm(url, formObj, { timeoutMs = 15000, accessToken } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    const res = await fetch(url, { method: 'POST', headers, body: toForm(formObj), signal: controller.signal });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch { data = { kq: 0, msg: text }; }
    return { httpStatus: res.status, data, rawText: text };
  } finally { clearTimeout(timeout); }
}

const getAccessToken = async () =>
  (await AsyncStorage.getItem('access_token')) ||
  (await AsyncStorage.getItem('accessToken')) ||
  (await AsyncStorage.getItem('token'));

async function sendActiveOTP(phoneNum) {
  const { data } = await postForm(OTP_GEN, { action: 'register', phoneNum });
  const kq = Number(data?.kq ?? 0);
  const msg = data?.msg ?? null;
  return { kq, msg, raw: data };
}
async function activateDeviceByOTP({ id, phoneNum, OTP }) {
  const accessToken = await getAccessToken();
  const { data } = await postForm(ACTIVATE_BY_OTP, { id, phoneNum, OTP }, { accessToken });
  const kq = Number(data?.kq ?? 0);
  const msg = data?.msg ?? null;
  return { kq, msg, raw: data };
}
async function activateDeviceByCode({ id, code }) {
  const accessToken = await getAccessToken();
  const { data } = await postForm(ACTIVATE_BY_CODE, { id, code }, { accessToken });
  const kq = Number(data?.kq ?? 0);
  const msg = data?.msg ?? null;
  return { kq, msg, raw: data };
}
/* =========================================================== */

/* ===================== MQTT CONFIG ===================== */
const MQTT_URI  = 'mqtt://mqtt.iky.vn:1883';
const MQTT_USER = 'iky';
const MQTT_PASS = 'IKY123456';
const MQTT_QOS  = 1;

const SOS_WAIT_MS = 5 * 60 * 1000;

const makeClientId = (imei) =>
  ('app' + String(imei || '').replace(/\D/g, '')).slice(0, 20) + (Math.random()*1000|0);

const ts = () => {
  const d = new Date();
  return d.toLocaleTimeString() + '.' + String(d.getMilliseconds()).padStart(3, '0');
};
const mlog = (...args) => console.log('[MQTT]', ts(), ...args);
/* ======================================================= */

const MonitoringScreen = ({ logout, navigateToScreen }) => {
  const { t } = useI18n();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showSOSModal, setShowSOSModal] = useState(false);
  const [showFindVehicleModal, setShowFindVehicleModal] = useState(false);
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);

  const [mapType, setMapType] = useState('standard');
  useEffect(() => { (async () => {
    try { const s = await AsyncStorage.getItem('monitoring_map_type'); if (s) setMapType(s); } catch {}
  })(); }, []);
  useEffect(() => { (async () => { try { await AsyncStorage.setItem('monitoring_map_type', mapType); } catch {} })(); }, [mapType]);

  // DATA
  const [accessToken, setAccessToken] = useState(null);
  const [devices, setDevices] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [cruise, setCruise] = useState(null);
  const [address, setAddress] = useState('—');
  const [isLoading, setIsLoading] = useState(false);

  // MQTT state
  const clientRef = useRef(null);
  const connectedRef = useRef(false);
  const connectingRef = useRef(false);
  const shouldReconnectRef = useRef(true);
  const sessionRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  const sosPendingRef = useRef(false);
  const sosTimeoutRef = useRef(null);
  const sosTimerRef = useRef(null);
  const [sosBusy, setSosBusy] = useState(false);
  const [sosRemainingMs, setSosRemainingMs] = useState(0);

  // QR Scan
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // ANIMS
  const headerMenuAnim = useRef(new Animated.Value(-250)).current;
  const fabRotation = useRef(new Animated.Value(0)).current;
  const headerIconRotation = useRef(new Animated.Value(0)).current;
  const menu1Anim = useRef(new Animated.Value(0)).current;
  const menu2Anim = useRef(new Animated.Value(0)).current;
  const menu3Anim = useRef(new Animated.Value(0)).current;
  const sosModalAnim = useRef(new Animated.Value(screenHeight)).current;
  const { notifications, setNotifications } = useContext(NotificationContext);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const mapRef = useRef(null);
  const markerRef = useRef(null);

  const formatExpireDate = (iso) => {
    if (!iso) return '—';
    try { const d = new Date(iso); return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
    catch { return iso; }
  };
  const isExpired = (iso) => { if (!iso) return false; try { return new Date(iso).getTime() < Date.now(); } catch { return false; } };

  const handleNotificationPress = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    navigateToScreen('notification', { from: 'Monitoring' });
  };

  // INIT: token + devices (1 lần khi vào)
  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        setAccessToken(token || '');
        const list = await getDevices(token || '');
        const mapped = (list || []).map((d) => {
          const exp = d?.date_exp || d?.expiry || d?.expired_at || d?.expire;
          return {
            id: d?._id || d?.id,
            plateNumber: d?.license_plate || d?.imei || d?._id,
            driver: d?.driver || d?.owner || '—',
            expiryDate: formatExpireDate(exp),
            rawExpiry: exp,
            expired: isExpired(exp),
            phone: d?.phone_number || d?.phone || '',
            active: Number(d?.active ?? 0),
            raw: d,
          };
        }).filter((x) => x.id);
        setDevices(mapped);
        if (mapped.length > 0) setSelectedId(mapped[0].id);
      } catch (e) {
        Alert.alert('Lỗi', t('errNoToken'));
      }
    })();
  }, []);

  // LOAD current cruise (1 lần khi đổi xe) + reverse geocode (Goong -> Nominatim)
  useEffect(() => {
    if (!accessToken || !selectedId) return;
    (async () => {
      try {
        const c = await getCruise(accessToken, selectedId);
        setCruise(c);
        if (mapRef.current && c?.lat && c?.lon) {
          mapRef.current.animateToRegion({ latitude: c.lat, longitude: c.lon, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600);
        }
        const addr = await reverseGeocodeVi(c?.lat, c?.lon);
        setAddress(addr);
        // show callout 1 lần sau khi có đủ dữ liệu
        setTimeout(() => markerRef.current?.showCallout(), 0);
      } catch {
        Alert.alert('Lỗi', t('errNoCruise'));
      }
    })();
  }, [accessToken, selectedId]);

  const selectedDevice = devices.find(d => d.id === selectedId);
  const selectedImei = useMemo(() => {
    const raw = selectedDevice?.raw;
    const v = raw?.imei || selectedDevice?.imei || selectedDevice?.id || '';
    return String(v).replace(/\D/g, '');
  }, [selectedDevice]);
  const topicReq = useMemo(() => (selectedImei ? `dev${selectedImei}` : ''), [selectedImei]);
  const topicRes = useMemo(() => (selectedImei ? `app${selectedImei}` : ''), [selectedImei]);

  const timeObj = useMemo(() => {
    const tFromTim = parseIkyTime(cruise?.tim);
    if (tFromTim) return tFromTim;
    const secs = toSec(cruise?.created);
    if (secs) return new Date(secs * 1000);
    return null;
  }, [cruise]);
  const timeLabel = useMemo(() => (timeObj ? timeObj.toLocaleString('vi-VN') : '—'), [timeObj]);

  // ============== ACTIVATION VIEW ==============
  const [phoneNum, setPhoneNum] = useState('');
  const handleSendActiveOTP = async () => {
    try {
      if (!phoneNum) return showMessage('Nhập số điện thoại');
      if (!selectedDevice?.id) return showMessage('Thiếu ID thiết bị');
      setIsLoading(true);
      const res = await sendActiveOTP(phoneNum);
      if (res.kq === 1) {
        await AsyncStorage.multiSet([['active_phone', String(phoneNum)], ['active_device_id', String(selectedDevice.id)]]);
        showMessage('OTP đã gửi. Nhập OTP ở bước sau.');
        navigateToScreen('activeDevices');
      } else {
        showMessage(typeof res.msg === 'string' ? res.msg : 'Gửi OTP thất bại');
      }
    } catch (e) { showMessage(e?.message || 'Gửi OTP thất bại'); }
    finally { setIsLoading(false); }
  };
  const handleScanQR = () => setShowQRScanner(true);
  const onQRRead = async (event) => {
    if (isScanning) return;
    setIsScanning(true);
    try {
      const code = event?.data || event?.nativeEvent?.codeStringValue || event?.codeStringValue || '';
      if (!code) { setIsScanning(false); return; }
      setShowQRScanner(false);
      if (!selectedDevice?.id) { showMessage('Thiếu ID thiết bị'); return; }
      setIsLoading(true);
      const res = await activateDeviceByCode({ id: selectedDevice.id, code: String(code).trim() });
      if (res.kq === 1) { showMessage('Kích hoạt thành công'); navigateToScreen('Device'); }
      else { showMessage(typeof res.msg === 'string' ? res.msg : 'Kích hoạt thất bại'); }
    } catch (e) { showMessage(e?.message || 'Kích hoạt thất bại'); }
    finally { setIsLoading(false); setIsScanning(false); }
  };

  // UI anims
  const [isMenuOpenLocal, setIsMenuOpenLocal] = useState(false);
  const fabToggle = () => {
    const toValue = isMenuOpenLocal ? 0 : 1;
    setIsMenuOpenLocal(!isMenuOpenLocal);
    Animated.timing(fabRotation, { toValue, duration: 300, easing: Easing.ease, useNativeDriver: true }).start();
    const anims = [
      Animated.timing(menu1Anim, { toValue: isMenuOpenLocal ? 0 : -70, duration: 300, delay: isMenuOpenLocal ? 0 : 50, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(menu2Anim, { toValue: isMenuOpenLocal ? 0 : -120, duration: 300, delay: isMenuOpenLocal ? 50 : 100, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(menu3Anim, { toValue: isMenuOpenLocal ? 0 : -170, duration: 300, delay: isMenuOpenLocal ? 100 : 150, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ];
    Animated.parallel(isMenuOpenLocal ? anims.reverse() : anims).start();
  };
  const openSOSModal = () => {
    const show = () => {
      setShowSOSModal(true);
      Animated.timing(sosModalAnim, { toValue: 0, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    };
    if (isMenuOpenLocal) { fabToggle(); setTimeout(show, 350); } else show();
  };
  const closeSOSModal = () => {
    Animated.timing(sosModalAnim, { toValue: screenHeight, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setShowSOSModal(false));
  };
  const toggleHeaderMenu = () => {
    const opening = !showHeaderMenu;
    setShowHeaderMenu(opening);
    Animated.timing(headerMenuAnim, { toValue: opening ? 0 : -250, duration: 300, easing: opening ? Easing.out(Easing.quad) : Easing.in(Easing.quad), useNativeDriver: true }).start();
    Animated.timing(headerIconRotation, { toValue: opening ? 1 : 0, duration: 250, easing: Easing.ease, useNativeDriver: true }).start();
  };
  const openVehicleModalFromMenu = () => {
    if (isMenuOpenLocal) { fabToggle(); setTimeout(() => setShowFindVehicleModal(true), 350); }
    else setShowFindVehicleModal(true);
  };
  const closeFindVehicleModal = () => setShowFindVehicleModal(false);

  async function ensureLocationPermission() {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } else {
      const status = await Geolocation.requestAuthorization('whenInUse');
      return status === 'granted' || status === 'authorized';
    }
  }
  async function openGoogleMapsFromHereTo(lat, lon) {
    try {
      if (!lat || !lon) { Alert.alert('Lỗi', 'Không có tọa độ để chỉ đường'); return; }
      const androidIntent = `google.navigation:q=${lat},${lon}&mode=d`;
      const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
      let urlToOpen = webFallback;
      if (Platform.OS === 'android') {
        const canOpenIntent = await Linking.canOpenURL(androidIntent);
        urlToOpen = canOpenIntent ? androidIntent : webFallback;
      } else if (Platform.OS === 'ios') {
        const iosGoogleMaps = `comgooglemaps://?daddr=${lat},${lon}&directionsmode=driving`;
        const iosAppleMaps = `http://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
        if (await Linking.canOpenURL(iosGoogleMaps)) urlToOpen = iosGoogleMaps;
        else if (await Linking.canOpenURL(iosAppleMaps)) urlToOpen = iosAppleMaps;
      }
      await Linking.openURL(urlToOpen);
    } catch (err) {
      console.log('Navigation error:', err);
      Alert.alert('Lỗi', 'Không thể mở Google Maps');
    }
  }

  /* ====================== MQTT (giữ nguyên) ====================== */
  const clearSosTimers = useCallback(() => {
    if (sosTimeoutRef.current) { clearTimeout(sosTimeoutRef.current); sosTimeoutRef.current = null; }
    if (sosTimerRef.current) { clearInterval(sosTimerRef.current); sosTimerRef.current = null; }
  }, []);

  const normImei = (s) => String(s || '').replace(/\D/g, '');
  const isValidAck = (obj, expectImei) => {
    if (!obj || typeof obj !== 'object') return false;
    const hasDev = typeof obj.dev === 'string' || typeof obj.dev === 'number';
    if (!hasDev) return false;
    const sameImei = normImei(obj.dev) === normImei(expectImei);
    if (!sameImei) return false;
    const pidOk = typeof obj.pid === 'string' && obj.pid.length > 0;
    const resOk = obj.res === 0 || obj.res === 1 || obj.res === '0' || obj.res === '1';
    return pidOk && resOk;
  };

  const hardCloseClient = useCallback(async () => {
    try {
      shouldReconnectRef.current = false;
      const c = clientRef.current;
      if (c) {
        try { if (topicRes) c.unsubscribe(topicRes, MQTT_QOS); } catch {}
        try { c.disconnect(); } catch {}
      }
    } catch {}
    clientRef.current = null;
    connectedRef.current = false;
    connectingRef.current = false;
  }, [topicRes]);

  const disconnectMqtt = useCallback(() => {
    clearTimeout(reconnectTimerRef.current || undefined);
    reconnectTimerRef.current = null;
    hardCloseClient();
    sosPendingRef.current = false;
    clearSosTimers();
    setSosBusy(false);
    setSosRemainingMs(0);
  }, [hardCloseClient, clearSosTimers]);

  const connectMqtt = useCallback(() => {
    if (!selectedImei || !topicRes) return;

    sessionRef.current += 1;
    const mySession = sessionRef.current;

    hardCloseClient();

    clearTimeout(reconnectTimerRef.current || undefined);
    reconnectTimerRef.current = setTimeout(() => {
      if (mySession !== sessionRef.current) return;

      const clientId = makeClientId(selectedImei).slice(0, 23);
      shouldReconnectRef.current = true;
      connectingRef.current = true;

      mlog('dial (TCP native)...', { clientId, uri: MQTT_URI });

      MQTT.createClient({
        uri: MQTT_URI,
        clientId,
        auth: true,
        user: MQTT_USER,
        pass: MQTT_PASS,
        keepalive: 60,
        clean: true,
        tls: false,
      }).then(client => {
        if (mySession !== sessionRef.current) { try { client.disconnect(); } catch {} return; }

        clientRef.current = client;

        client.on('closed', () => {
          if (mySession !== sessionRef.current) return;
          mlog('closed');
          connectedRef.current = false;
          connectingRef.current = false;
          if (shouldReconnectRef.current) {
            clearTimeout(reconnectTimerRef.current || undefined);
            reconnectTimerRef.current = setTimeout(() => {
              if (mySession === sessionRef.current) connectMqtt();
            }, 1000);
          }
        });

        client.on('error', (e) => {
          if (mySession !== sessionRef.current) return;
          mlog('ERROR:', e);
          connectedRef.current = false;
          connectingRef.current = false;
          if (shouldReconnectRef.current) {
            clearTimeout(reconnectTimerRef.current || undefined);
            reconnectTimerRef.current = setTimeout(() => {
              if (mySession === sessionRef.current) connectMqtt();
            }, 1000);
          }
        });

        client.on('message', (msg) => {
          if (mySession !== sessionRef.current) return;
          const text = String(msg.data || '');
          mlog('RX', msg.topic, text);
          if (msg.topic !== topicRes) return;

          let data;
          try { data = JSON.parse(text); } catch { mlog('bad JSON'); return; }
          if (!isValidAck(data, selectedImei)) {
            mlog('IGNORED ACK (invalid payload)', data);
            return;
          }

          const ok = Number(data.res) === 1;
          if (sosPendingRef.current) {
            sosPendingRef.current = false;
            setSosBusy(false);
            clearSosTimers();
            setSosRemainingMs(0);
            Alert.alert(ok ? 'Thành công' : 'Thất bại', ok ? 'Lệnh SOS đã được xử lý.' : 'Thiết bị báo lỗi.');
            if (ok) closeSOSModal();
          }
        });

        client.on('connect', () => {
          if (mySession !== sessionRef.current) return;
          mlog('CONNECTED');
          connectedRef.current = true;
          connectingRef.current = false;
          try { client.subscribe(topicRes, MQTT_QOS); } catch {}
        });

        client.connect();
      }).catch(err => {
        if (mySession !== sessionRef.current) return;
        connectingRef.current = false;
        mlog('createClient err:', err?.message || String(err));
        Alert.alert('⚠️', 'Không kết nối được MQTT (1883).');
      });
    }, 150);
  }, [selectedImei, topicRes, hardCloseClient]);

  useEffect(() => {
    connectMqtt();
    return () => disconnectMqtt();
  }, [connectMqtt, disconnectMqtt]);

  const startSosCountdown = useCallback(() => {
    setSosRemainingMs(SOS_WAIT_MS);
    if (sosTimerRef.current) { clearInterval(sosTimerRef.current); }
    sosTimerRef.current = setInterval(() => {
      setSosRemainingMs(prev => {
        const next = prev - 1000;
        return next >= 0 ? next : 0;
      });
    }, 1000);
  }, []);

  const sendSosMqtt = useCallback((on) => {
    if (!selectedImei) return;
    if (!connectedRef.current || !clientRef.current) {
      Alert.alert('⚠️', 'Không kết nối được MQTT (1883).');
      return;
    }
    if (sosPendingRef.current) return;

    sosPendingRef.current = true;
    setSosBusy(true);
    startSosCountdown();

    const payload = { imei: selectedImei, pid: 'android', key: on ? 1 : 0 };
    mlog('PUBLISH ->', topicReq, payload);
    try {
      clientRef.current.publish(topicReq, JSON.stringify(payload), MQTT_QOS, false);
    } catch (e) {
      mlog('publish err:', e?.message);
      sosPendingRef.current = false;
      setSosBusy(false);
      clearSosTimers();
      setSosRemainingMs(0);
      Alert.alert('⚠️', 'Gửi lệnh thất bại.');
      return;
    }

    sosTimeoutRef.current = setTimeout(() => {
      if (!sosPendingRef.current) return;
      sosPendingRef.current = false;
      setSosBusy(false);
      clearSosTimers();
      setSosRemainingMs(0);
      Alert.alert('Hết thời gian chờ', 'Không nhận phản hồi từ thiết bị. Vui lòng thử lại.');
    }, SOS_WAIT_MS);
  }, [selectedImei, topicReq, startSosCountdown, clearSosTimers]);

  const toggleMapType = () => setMapType((prev) => (prev === 'standard' ? 'hybrid' : 'standard'));

  // ============== RENDER ==============
  const isInactive = !!selectedDevice && Number(selectedDevice.active) === 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.menuButton} onPress={toggleHeaderMenu}>
          <Animated.View style={{ transform: [{ rotate: headerIconRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
            <Icon name={showHeaderMenu ? 'arrow-forward' : 'menu'} size={24} color="white" />
          </Animated.View>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {showHeaderMenu ? t('headerList', devices.length) : t('headerTitle', selectedDevice?.plateNumber)}
        </Text>

        <TouchableOpacity style={styles.notificationButton} onPress={handleNotificationPress}>
          <View style={{ position: 'relative' }}>
            <Icon name={showHeaderMenu ? 'refresh' : 'notifications'} size={24} color="white" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Side vehicle list */}
      {showHeaderMenu && (
        <View style={styles.headerMenuOverlay}>
          <TouchableOpacity style={styles.headerMenuOverlayTouchable} onPress={toggleHeaderMenu} />
          <Animated.View style={[styles.headerMenu, { transform: [{ translateX: headerMenuAnim }] }]}>
            <View style={styles.headerMenuContent}>
              {devices.map((v) => (
                <TouchableOpacity
                  key={v.id}
                  style={styles.vehicleMenuItem}
                  onPress={() => { toggleHeaderMenu(); setSelectedId(v.id); }}
                >
                  <View style={styles.vehicleMenuIcon}>
                    <Image source={logoCar} style={styles.vehicleMenuImage} />
                  </View>
                  <View style={styles.vehicleMenuDetails}>
                    <Text style={styles.vehicleMenuPlate}>{t('vehiclePlate', v.plateNumber)}</Text>
                    <Text style={styles.vehicleMenuDriver}>{t('driver', v.driver)}</Text>
                    {v.expired ? (
                      <Text style={styles.vehicleMenuExpired}>{t('expired')}</Text>
                    ) : (
                      <Text style={styles.vehicleMenuExpiry}>{t('expiryDate', v.expiryDate)}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        </View>
      )}

      {/* Content */}
      <View style={styles.mapContainer}>
        {/* INACTIVE */}
        {isInactive ? (
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <ScrollView contentContainerStyle={styles.activationWrap} keyboardShouldPersistTaps="handled">
                <Text style={styles.activationTitle}>
                  Thiết bị <Text style={{ fontWeight: 'bold' }}>{selectedDevice?.plateNumber || selectedDevice?.id}</Text> chưa được kích hoạt
                </Text>
                <Image source={logoActive} style={styles.activationImage} resizeMode="contain" />
                <View style={styles.inputWrap}>
                  <Icon name="smartphone" size={20} color="#666" style={{ marginRight: 8 }} />
                  <TextInput style={styles.input} placeholder="Số điện thoại chủ xe" value={phoneNum} onChangeText={setPhoneNum} keyboardType="phone-pad" returnKeyType="done" blurOnSubmit />
                </View>
                <TouchableOpacity style={styles.activationBtn} onPress={handleSendActiveOTP} disabled={isLoading}>
                  <Text style={styles.activationBtnText}>Kích hoạt ngay →</Text>
                </TouchableOpacity>
                <View style={styles.separatorWrap}>
                  <View style={styles.line} />
                  <Text style={styles.separator}>Hoặc</Text>
                  <View style={styles.line} />
                </View>
                <TouchableOpacity onPress={handleScanQR} disabled={isLoading} style={styles.qrButton}>
                  <Icon name="qr-code-scanner" size={20} color="#1E88E5" style={{ marginRight: 8 }} />
                  <Text style={styles.qrButtonText}>Quét mã</Text>
                </TouchableOpacity>
                <Text style={styles.hotline}>
                  Hoặc liên hệ bộ phận CSKH để được hỗ trợ{' '}
                  <Text style={styles.hotlineLink} onPress={() => Linking.openURL('tel:0902806999')}>0902 806 999</Text>
                </Text>
              </ScrollView>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        ) : selectedDevice?.expired ? (
          // EXPIRED
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
            <Text style={styles.expiredTitle}>{t('expiredTitle', selectedDevice?.plateNumber)}</Text>
            <Image source={bannerExpires} style={{ width: '80%', height: 180, marginBottom: 20 }} resizeMode="contain" />
            <Text style={{ fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 15 }}>{t('expiredDesc')}</Text>
            <TouchableOpacity
              style={{ backgroundColor: '#1e88e5', borderRadius: 25, paddingHorizontal: 30, paddingVertical: 12 }}
              onPress={() => navigateToScreen('extend', { device: selectedDevice?.raw || selectedDevice })}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>{t('renewNow')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          // NORMAL MAP
          <>
            <MapView
              ref={mapRef}
              provider={PROVIDER_GOOGLE}
              style={styles.map}
              mapType={mapType}
              initialRegion={{
                latitude: cruise?.lat || 10.76,
                longitude: cruise?.lon || 106.66,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              showsCompass
              showsBuildings
              onMapReady={() => { markerRef.current?.showCallout(); }}  // chỉ show 1 lần khi vào
            >
              {cruise?.lat && cruise?.lon && (
                <Marker
                  ref={markerRef}
                  coordinate={{ latitude: cruise.lat, longitude: cruise.lon }}
                  anchor={{ x: 0.5, y: 1 }}
                  tracksViewChanges={false}
                >
                  <Image source={logoStar} style={{ width: 36, height: 36 }} resizeMode="contain" />
                  <Callout tooltip>
                    <View style={styles.calloutWrap}>
                      <View style={styles.calloutCard}>
                        <Text style={styles.calloutLine}>{t('calloutAtTime', timeLabel)}</Text>
                        <Text style={styles.calloutLine}>
                          {t(
                            'calloutCoord',
                            typeof cruise?.lat === 'number' ? cruise.lat.toFixed(6) : '—',
                            typeof cruise?.lon === 'number' ? cruise.lon.toFixed(6) : '—'
                          )}
                        </Text>
                        {statusFromDataLikeJourney(cruise || {}) === 'Xe chạy' ? (
                          <Text style={styles.calloutLine}>{t('calloutStatus', spdTextLikeJourney(cruise || {}))}</Text>
                        ) : (
                          <Text style={styles.calloutLine}>{t('calloutStatus', statusFromDataLikeJourney(cruise || {}))}</Text>
                        )}
                        <Text style={styles.calloutLine} numberOfLines={2}>{t('calloutAddr', address)}</Text>
                        <Text style={styles.calloutLine}>{t('calloutFwr', cruise?.fwr)}</Text>
                      </View>
                      <View style={styles.calloutArrow} />
                    </View>
                  </Callout>
                </Marker>
              )}
            </MapView>

            {/* Toggle map type */}
            <TouchableOpacity style={styles.mapTypeBtn} onPress={toggleMapType} activeOpacity={0.8}>
              <Icon name="layers" size={18} color="#4A90E2" />
              <Text style={styles.mapTypeText}>{mapType === 'standard' ? 'Vệ tinh' : 'Chuẩn'}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* FAB Menu */}
        {!selectedDevice?.expired && !isInactive && (
          <View style={styles.fabContainer}>
            <Animated.View
              style={[styles.fabMenuItem, { transform: [{ translateY: menu3Anim }], opacity: menu3Anim.interpolate({ inputRange: [-170, 0], outputRange: [1, 0] }) }]}
              pointerEvents={isMenuOpenLocal ? 'auto' : 'none'}
            >
              <TouchableOpacity
                style={[styles.fabButton, styles.lockButton]}
                onPress={() => { if (cruise?.lat && cruise?.lon) openGoogleMapsFromHereTo(cruise.lat, cruise.lon); }}
              >
                <Image source={iconsDerection} style={styles.fabIcon} />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View
              style={[styles.fabMenuItem, { transform: [{ translateY: menu2Anim }], opacity: menu2Anim.interpolate({ inputRange: [-120, 0], outputRange: [1, 0] }) }]}
              pointerEvents={isMenuOpenLocal ? 'auto' : 'none'}
            >
              <TouchableOpacity style={[styles.fabButton, styles.sosButton]} onPress={openSOSModal}>
                <Image source={logoSOS} style={styles.fabIcon} />
              </TouchableOpacity>
            </Animated.View>

            <Animated.View
              style={[styles.fabMenuItem, { transform: [{ translateY: menu1Anim }], opacity: menu1Anim.interpolate({ inputRange: [-70, 0], outputRange: [1, 0] }) }]}
              pointerEvents={isMenuOpenLocal ? 'auto' : 'none'}
            >
              <TouchableOpacity style={[styles.fabButton, styles.navigationButton]} onPress={openVehicleModalFromMenu}>
                <Image source={logoMoto} style={styles.fabIcon} />
              </TouchableOpacity>
            </Animated.View>

            <TouchableOpacity style={[styles.fabButton, styles.mainFabButton]} onPress={fabToggle}>
              <Animated.View style={{ transform: [{ rotate: fabRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
                <Icon name="apps" size={24} color="white" />
              </Animated.View>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* SOS Modal (MQTT) */}
      <Modal visible={showSOSModal} transparent animationType="none" onRequestClose={closeSOSModal}>
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.sosModal, { transform: [{ translateY: sosModalAnim }] }]}>
            <View style={styles.sosHeader}><Text style={styles.sosTitle}>{t('sosTitle')}</Text></View>
            <View style={styles.sosContent}>
              <Text style={styles.sosMessage}>{t('sosMsg')}</Text>
            </View>
            <View style={styles.sosButtons}>
              <TouchableOpacity style={[styles.sosActivateButton, sosBusy && { opacity: 0.7 }]} onPress={() => sendSosMqtt(true)} disabled={sosBusy}>
                <Text style={styles.sosActivateText}>{t('sosOn')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sosExitButton, sosBusy && { opacity: 0.7 }]} onPress={() => sendSosMqtt(false)} disabled={sosBusy}>
                <Text style={styles.sosExitText}>{t('sosOff')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sosCloseButton} onPress={closeSOSModal} disabled={sosBusy}>
                <Text style={styles.sosCloseText}>{t('ok')}</Text>
              </TouchableOpacity>

              {sosBusy && (
                <View style={{ marginTop: 8, alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator />
                  <Text style={{ color: '#666' }}>
                    Đang đợi phản hồi từ thiết bị…
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        </View>
      </Modal>

      {/* Find Vehicle Modal */}
      <Modal visible={showFindVehicleModal} transparent animationType="none" onRequestClose={closeFindVehicleModal}>
        <View style={styles.modalOverlay}>
          <View style={[styles.findVehicleModal, { transform: [{ translateY: 0 }] }]}>
            <View style={styles.findVehicleHeader}><Text style={styles.findVehicleTitle}>{t('notice')}</Text></View>
            <View style={styles.findVehicleContent}>
              <Text style={styles.findVehicleMessage}>Chức năng tìm xe được điều khiển qua SMS. Bạn muốn thực hiện?</Text>
            </View>
            <View style={styles.findVehicleButtons}>
              <TouchableOpacity style={styles.findVehicleCloseButton} onPress={closeFindVehicleModal}>
                <Text style={styles.findVehicleCloseText}>{t('close')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.findVehicleConfirmButton}
                onPress={async () => {
                  try {
                    let phone =
                      selectedDevice?.phone ||
                      selectedDevice?.raw?.phone_number ||
                      selectedDevice?.raw?.phone;

                    if (!phone) { Alert.alert(t('notice'), t('noPhone')); return; }

                    phone = String(phone).trim();
                    if (!phone.startsWith('0')) phone = '0' + phone;

                    const base = Platform.select({
                      ios: `sms:${phone}&body=${encodeURIComponent('TIMXE')}`,
                      android: `sms:${phone}?body=${encodeURIComponent('TIMXE')}`,
                      default: `sms:${phone}?body=${encodeURIComponent('TIMXE')}`,
                    });

                    const can = await Linking.canOpenURL(base);
                    if (!can) { Alert.alert(t('notice'), t('smsFail')); return; }
                    await Linking.openURL(base);
                    Alert.alert(t('notice'), 'Tin nhắn tìm xe đã được soạn!');
                    closeFindVehicleModal();
                  } catch { Alert.alert(t('notice'), t('smsFail')); }
                }}
              >
                <Text style={styles.findVehicleConfirmText}>{t('agree')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* QR Scanner Modal */}
      <Modal visible={showQRScanner} animationType="slide" onRequestClose={() => setShowQRScanner(false)}>
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <QRCodeScanner
            vibrate={false}
            onRead={onQRRead}
            flashMode={RNCamera.Constants.FlashMode.auto}
            reactivate={false}
            showMarker
            topContent={<Text style={{ color:'#fff', marginTop: 16 }}>Đưa QR vào khung để quét</Text>}
            bottomContent={
              <TouchableOpacity onPress={() => setShowQRScanner(false)} style={{ marginTop: 18, backgroundColor:'#0008', paddingHorizontal:14, paddingVertical:10, borderRadius:8 }}>
                <Text style={{ color:'#fff' }}>Đóng</Text>
              </TouchableOpacity>
            }
            cameraStyle={{ height: '100%' }}
          />
        </View>
      </Modal>

      {/* LOADING OVERLAY */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}
    </View>
  );
};

/* ===== styles ===== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    backgroundColor: '#4A90E2', paddingHorizontal: 20, paddingVertical: 15, paddingTop: 25,
    flexDirection: 'row', alignItems: 'center',
  },
  menuButton: { padding: 4, marginRight: 8 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '500', flex: 1 },
  notificationButton: { padding: 4 },

  mapContainer: { flex: 1, position: 'relative' },
  map: { flex: 1 },

  mapTypeBtn: {
    position: 'absolute',
    right: 12,
    top: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6e6e6',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  mapTypeText: { fontSize: 12, color: '#4A90E2', fontWeight: '600' },

  activationWrap: {
    flexGrow: 1, minHeight: screenHeight - 140, alignItems: 'center', justifyContent: 'center',
    padding: 20, backgroundColor: '#f9f9f9',
  },
  activationTitle: { fontSize: 16, marginVertical: 15, textAlign: 'center' },
  activationImage: { width: 160, height: 160, marginBottom: 20 },

  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, paddingHorizontal: 10, width: '100%', backgroundColor: '#fff' },
  input: { flex: 1, height: 44 },

  activationBtn: { backgroundColor: '#1E88E5', borderRadius: 25, paddingVertical: 12, paddingHorizontal: 30, marginTop: 15, width: '100%', alignItems: 'center' },
  activationBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  separatorWrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 15, width: '100%' },
  line: { flex: 1, height: 1, backgroundColor: '#ccc' },
  separator: { marginHorizontal: 10, color: '#777' },

  qrButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#E3F2FD' },
  qrButtonText: { color: '#1E88E5', fontSize: 15, fontWeight: '600' },

  hotline: { marginTop: 20, textAlign: 'center', color: '#333' },
  hotlineLink: { color: '#1E88E5', textDecorationLine: 'underline' },

  calloutWrap: { alignItems: 'center' },
  calloutCard: { maxWidth: screenWidth * 0.85, minWidth: screenWidth * 0.65, backgroundColor: '#3b86e5', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12 },
  calloutLine: { color: '#fff', fontSize: 14, marginBottom: 4, flexShrink: 1 },
  calloutArrow: {
    width: 0, height: 0, marginTop: -1,
    borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 12,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#3b86e5',
    alignSelf: 'center',
  },

  fabContainer: { position: 'absolute', right: 20, bottom: 20, alignItems: 'center' },
  fabMenuItem: { position: 'absolute', alignItems: 'center' },
  fabIcon: { width: 20, height: 20, resizeMode: 'contain' },
  fabButton: {
    width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center',
    elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84,
  },
  mainFabButton: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#dc3545' },
  navigationButton: { backgroundColor: 'red' },
  sosButton: { backgroundColor: '#dc3545' },
  lockButton: { backgroundColor: 'red' },

  headerMenuOverlay: { position: 'absolute', top: 70, left: 0, right: 0, bottom: 0, zIndex: 1000 },
  headerMenuOverlayTouchable: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  headerMenu: {
    position: 'absolute', left: 0, top: 0, width: screenWidth * 0.7, bottom: 0, backgroundColor: 'white',
    elevation: 10, shadowColor: '#000', shadowOffset: { width: 2, height: 0 }, shadowOpacity: 0.25, shadowRadius: 3.84,
  },
  headerMenuContent: { flex: 1, paddingTop: 20 },
  vehicleMenuItem: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#f8f8f8', borderWidth: 2, borderColor: '#4A90E2', borderRadius: 8,
    marginHorizontal: 15, marginVertical: 3, backgroundColor: '#f8f9fa',
  },
  vehicleMenuIcon: { backgroundColor: '#4A90E2', borderRadius: 6, padding: 6, marginRight: 12, width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  vehicleMenuImage: { width: 16, height: 16, resizeMode: 'contain' },
  vehicleMenuDetails: { flex: 1 },
  vehicleMenuPlate: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 2 },
  vehicleMenuDriver: { fontSize: 12, color: '#666', marginBottom: 2 },
  vehicleMenuExpiry: { fontSize: 12, color: '#666' },
  vehicleMenuExpired: { fontSize: 12, color: '#C62828', fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sosModal: {
    position: 'absolute', left: 20, right: 20, bottom: 100, backgroundColor: 'white',
    borderRadius: 15, padding: 20, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.25, shadowRadius: 3.84,
  },
  sosHeader: { alignItems: 'center', marginBottom: 20 },
  sosTitle: { fontSize: 20, fontWeight: '600', color: '#4A90E2' },
  sosContent: { marginBottom: 20 },
  sosMessage: { fontSize: 14, color: '#333', lineHeight: 20, marginBottom: 15 },
  sosButtons: { gap: 10 },
  sosActivateButton: { backgroundColor: '#dc3545', borderRadius: 25, paddingVertical: 12, alignItems: 'center' },
  sosActivateText: { color: 'white', fontSize: 16, fontWeight: '500' },
  sosExitButton: { backgroundColor: '#4A90E2', borderRadius: 25, paddingVertical: 12, alignItems: 'center' },
  sosExitText: { color: 'white', fontSize: 16, fontWeight: '500' },
  sosCloseButton: { backgroundColor: '#f8f9fa', borderRadius: 25, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  sosCloseText: { color: '#666', fontSize: 16 },

  findVehicleModal: {
    position: 'absolute', left: 50, right: 50, top: '35%', backgroundColor: 'white', borderRadius: 15, padding: 20,
    elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.25, shadowRadius: 3.84,
  },
  findVehicleHeader: { alignItems: 'center', marginBottom: 20 },
  findVehicleTitle: { fontSize: 20, fontWeight: '600', color: '#4A90E2' },
  findVehicleContent: { marginBottom: 20 },
  findVehicleMessage: { fontSize: 16, color: '#333', lineHeight: 24, textAlign: 'center' },
  findVehicleButtons: { flexDirection: 'row', gap: 10 },
  findVehicleCloseButton: { flex: 1, backgroundColor: '#f8f9fa', borderRadius: 25, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ddd' },
  findVehicleCloseText: { color: '#666', fontSize: 16 },
  findVehicleConfirmButton: { flex: 1, backgroundColor: '#00BFFF', borderRadius: 25, paddingVertical: 12, alignItems: 'center' },
  findVehicleConfirmText: { color: 'white', fontSize: 16, fontWeight: '500' },

  expiredTitle: { fontSize: 18, fontWeight: '500', color: '#000', marginBottom: 15, textAlign: 'center' },

  badge: {
    position: 'absolute', top: -6, right: -6, backgroundColor: '#E53935', borderRadius: 10,
    minWidth: 18, height: 18, paddingHorizontal: 3, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
});

export default MonitoringScreen;
