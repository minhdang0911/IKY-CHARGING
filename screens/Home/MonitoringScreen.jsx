// screens/Home/MonitoringScreen.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  FlatList, Platform, ToastAndroid, Alert, Image, Modal,
  Linking, Pressable,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import RNFS from 'react-native-fs';
import CameraRoll from '@react-native-camera-roll/camera-roll';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// ICONS (status)
import plugOffline from '../../assets/img/ic_offline.png';
import plugOnline from '../../assets/img/ic_online.png';
import plugCharging from '../../assets/img/ic_charging.png';

// NEW PNG ICONS
import icHeaderMenu from '../../assets/img/ic_header_menu.png';
import icDrawerDevices from '../../assets/img/ic_drawer_devices.png';
import icDrawerSettings from '../../assets/img/ic_drawer_settings.png';
import icOpenPng from '../../assets/img/ic_open.png';
import icDownloadPng from '../../assets/img/ic_download.png';
import icBoltWhite from '../../assets/img/ic_bolt_white.png';

// APIs
import { getDevices, getDeviceInfo, getDashboardSessions } from '../../apis/devices';

// UI
import EdgeDrawer from '../../components/EdgeDrawer';
import PortCardSkeleton from '../../components/Skeletons/PortCardSkeleton';

// SSE
import sseManager from '../../utils/sseManager';

/* ================= i18n ================= */
const LANG_KEY = 'app_language';
const STRINGS = {
  vi: {
    headerTitle: (name) => `Giám sát thiết bị: ${name || '—'}`,
    close: 'Đóng',
    deviceName: (n) => `Thiết bị: ${n}`,
    ports: (n) => `Số cổng: ${n}`,
    port: 'Cổng',
    portCardTitle: (dev, p) => `${dev} - ${p}`,
    status: 'Trạng thái',
    ready: 'Sẵn sàng',
    charging: 'Đang sạc',
    offline: 'Offline',
    fault: 'Lỗi',
    start: 'Bắt đầu',
    end: 'Kết thúc',
    power: 'Công suất sạc',
    energy: 'Năng lượng tiêu thụ',
    loading: 'Đang tải…',
    noPorts: 'Không có cổng nào',
    portDetail: 'Chi tiết cổng',
    sessionTimeline: 'Dòng thời gian phiên',
    devices: 'Thiết bị',
    openLink: 'Mở liên kết',
    saveQR: 'Tải QR',
    tapQRHint: 'Chạm QR để mở link',
    savedTo: (f) => `Đã lưu: ${f}`,
    toastOpenLinkFail: 'Không mở được link',
    toastNoPort: 'Không có thông tin cổng',
    toastNeedStorage: 'Thiếu quyền lưu file',
    toastQrNotReady: 'QR Code chưa sẵn sàng, vui lòng thử lại',
    toastSaved: 'Đã lưu ảnh vào thư viện',
    errLoadDevices: 'Load devices lỗi',
    errLoadDeviceInfo: 'Load device info lỗi',
    missingToken: 'Thiếu accessToken',
  },
  en: {
    headerTitle: (name) => `Monitoring device: ${name || '—'}`,
    close: 'Close',
    deviceName: (n) => `Device: ${n}`,
    ports: (n) => `Ports: ${n}`,
    port: 'Port',
    portCardTitle: (dev, p) => `${dev} - ${p}`,
    status: 'Status',
    ready: 'Ready',
    charging: 'Charging',
    offline: 'Offline',
    fault: 'Fault',
    start: 'Start',
    end: 'End',
    power: 'Charge power',
    energy: 'Energy',
    loading: 'Loading…',
    noPorts: 'No ports',
    portDetail: 'Port detail',
    sessionTimeline: 'Session timeline',
    devices: 'Devices',
    openLink: 'Open link',
    saveQR: 'Save QR',
    tapQRHint: 'Tap QR to open link',
    savedTo: (f) => `Saved: ${f}`,
    toastOpenLinkFail: 'Failed to open link',
    toastNoPort: 'Missing port info',
    toastNeedStorage: 'Storage permission required',
    toastQrNotReady: 'QR Code not ready, please try again',
    toastSaved: 'Saved to Photos',
    errLoadDevices: 'Failed to load devices',
    errLoadDeviceInfo: 'Failed to load device info',
    missingToken: 'Missing accessToken',
  },
};
const useI18n = () => {
  const [lang, setLang] = useState('vi');
  useEffect(() => { (async () => { try { const s = await AsyncStorage.getItem(LANG_KEY); if (s) setLang(s); } catch {} })(); }, []);
  const t = (k, ...args) => {
    const v = STRINGS[lang]?.[k];
    return typeof v === 'function' ? v(...args) : (v ?? k);
  };
  return { t, lang };
};

/* ========== helpers ========== */
const STATUS_COLOR = { ready: '#16a34a', charging: '#2563eb', offline: '#ef4444', fault: '#f59e0b' };
const normalize = (s) => String(s || '').trim().toLowerCase();

async function getAccessTokenSafe() {
  const keys = ['accessToken', 'ACCESS_TOKEN', 'token', 'auth_token', 'access_token'];
  for (const k of keys) { const v = await AsyncStorage.getItem(k); if (v) return v; }
  return null;
}

function isDeviceOffline(info) {
  const s = normalize(info?.status);
  const a = normalize(info?.availability);
  return s === 'offline' || a === 'offline';
}
function formatDateTime(iso, lang = 'vi') {
  if (!iso) return '—';
  try {
    const loc = lang === 'en' ? 'en-US' : 'vi-VN';
    return new Date(iso).toLocaleString(loc);
  } catch { return '—'; }
}

function trim0(n, dp = 2) {
  if (!isFinite(n)) n = 0;
  return Number(n).toFixed(dp).replace(/\.?0+$/, '');
}
function formatPowerKW(n) {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  return a < 1 ? `${Math.round(v * 1000)} W` : `${trim0(v, 2)} kW`;
}
function formatEnergyKWh(n) {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  return a < 1 ? `${Math.round(v * 1000)} Wh` : `${trim0(v, 2)} kWh`;
}

/* ====== Cache keys (SWR) ====== */
const K_MONI_DEVICES_MENU = 'moni_devices_menu';
const K_MONI_SELECTED_ID  = 'moni_selected_id';
const K_MONI_DEVICE_MAP   = 'moni_device_map';
const K_MONI_SCOPE        = 'moni_scope';
const SWR_MAX_AGE_MS = 60 * 1000;
/* ====== LIVE overlay config ====== */
const LIVE_TTL_MS = 10 * 1000;
const ZERO_TO_READY_SEC = 0;

// Map<device_code, { status?:..., ports: Map<number, {...}> }>
const liveRef = { current: new Map() };

function mapPortStatusToVisual(s) {
  const x = normalize(s);
  if (x === 'offline') return 'offline';
  if (['fault','error','unavailable'].includes(x)) return 'fault';
  if (['busy','charging','running','in_progress','active'].includes(x)) return 'charging';
  if (['idle','ready','completed','finish','finished'].includes(x)) return 'ready';
  return undefined;
}

async function purgeMonitoringCache() {
  try {
    await AsyncStorage.multiRemove([K_MONI_DEVICES_MENU, K_MONI_SELECTED_ID, K_MONI_DEVICE_MAP]);
  } catch {}
}

async function computeScope() {
  const token = await getAccessTokenSafe();
  if (!token) return 'anon';
  return 't:' + token.slice(-12);
}

/* ====== ADAPTER ====== */
function adaptDeviceInfoToUI(info, sessionsDev, lang) {
  const name = info?.name || info?.device_code || '—';
  const ports = Array.isArray(info?.ports) ? info.ports : [];
  const deviceOffline = isDeviceOffline(info);

  const sessionByPort = {};
  if (sessionsDev && Array.isArray(sessionsDev.ports)) {
    for (const p of sessionsDev.ports) {
      if (p?.portNumber != null) sessionByPort[p.portNumber] = p.latestSession || null;
    }
  }

  const uiPorts = ports.map((p) => {
    const sess = sessionByPort[p?.portNumber] || p?.latestSession || null;
    const portStat = normalize(p?.status);
    const sessStat = normalize(sess?.status);

    let visual = 'ready';
    let textStat = 'ready';

    if (deviceOffline) {
      visual = 'offline'; textStat = 'offline';
    } else if (['busy','charging'].includes(portStat)) {
      visual = 'charging'; textStat = 'charging';
    } else if (['idle','ready'].includes(portStat)) {
      visual = 'ready'; textStat = 'ready';
    } else if (!portStat) {
      if (['running','in_progress','active','charging'].includes(sessStat)) {
        visual = 'charging'; textStat = 'charging';
      } else if (['completed','finish','finished','stopped','pending'].includes(sessStat)) {
        visual = 'ready'; textStat = 'ready';
      }
    } else if (['fault','error','unavailable'].includes(portStat)) {
      visual = 'fault'; textStat = 'fault';
    }

    return {
      id: p?._id ?? `${p?.portNumber ?? 'x'}`,
      portNumber: p?.portNumber,
      name: String(p?.portNumber ?? '—'),
      visualStatus: visual,
      portTextStatus: textStat,
      start: formatDateTime(sess?.startTime, lang),
      end: formatDateTime(sess?.endTime, lang),
      kw: p?.kw ?? 0,
      kwh: sess?.energy_used_kwh ?? 0,
    };
  });

  return {
    id: info?._id ?? info?.device_code ?? 'unknown',
    deviceId: info?._id ?? '',
    agentId: info?.agent_id?._id ?? info?.agent_id ?? '',
    code: info?.device_code ?? '',
    name,
    ports: uiPorts,
    deviceStatus: deviceOffline ? 'offline' : 'online',
    rawStatus: info?.status,
  };
}

/* ========= APPLY LIVE OVERLAY ========= */
function applyLiveToUI(ui) {
  if (!ui?.code) return ui;
  const dev = liveRef.current.get(ui.code);
  if (!dev) return ui;

  const next = { ...ui };
  if (dev.status) next.deviceStatus = dev.status;

  next.ports = (ui.ports || []).map((p) => {
    const portMap = dev.ports || new Map();
    const liveP = portMap.get(p.portNumber);
    if (!liveP) return p;

    const fresh = (Date.now() - liveP.ts) <= LIVE_TTL_MS;

    let visual = p.visualStatus;
    let text   = p.portTextStatus;

    if (liveP.portStatus) {
      const mapped = mapPortStatusToVisual(liveP.portStatus);
      if (mapped) { visual = mapped; text = mapped; }
    }

    return {
      ...p,
      visualStatus: visual,
      portTextStatus: text,
      kw:    fresh && typeof liveP.powerKW === 'number'   ? liveP.powerKW   : p.kw,
      kwh:   fresh && typeof liveP.energyKWh === 'number' ? liveP.energyKWh : p.kwh,
      end:   fresh && liveP.end ? liveP.end : p.end,
    };
  });

  return next;
}

/* ===================== SCREEN ===================== */
export default function MonitoringScreen({ setTabHidden }) {
  const { t, lang } = useI18n();
  const insets = useSafeAreaInsets();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    setTabHidden?.(drawerOpen);
    return () => setTabHidden?.(false);
  }, [drawerOpen, setTabHidden]);

  const [devicesMenu, setDevicesMenu] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const baseDeviceRef = useRef(null);

  const toast = useCallback((msg) => {
    if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
    else Alert.alert('', msg);
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [modalPort, setModalPort] = useState(null);
  const openPortModal = useCallback((p) => { setModalPort(p); setShowModal(true); }, []);
  const closePortModal = useCallback(() => setShowModal(false), []);

  const qrRef = useRef(null);

  /* ====== SWR: hydrate cache ====== */
  useEffect(() => {
    (async () => {
      try {
        const scope = await computeScope();
        const curScope = await AsyncStorage.getItem(K_MONI_SCOPE);
        if (curScope !== scope) {
          await purgeMonitoringCache();
          await AsyncStorage.setItem(K_MONI_SCOPE, scope);
        }

        const entries = await AsyncStorage.multiGet([K_MONI_DEVICES_MENU, K_MONI_SELECTED_ID, K_MONI_DEVICE_MAP]);
        const [menuStr, sid, mapStr] = entries.map(([, v]) => v);
        if (menuStr) { try { setDevicesMenu(JSON.parse(menuStr)); } catch {} }
        if (sid) setSelectedId(sid);

        if (sid && mapStr) {
          try {
            const map = JSON.parse(mapStr) || {};
            const cached = map[sid];
            if (cached?.ui) {
              baseDeviceRef.current = cached.ui;
              setSelectedDevice(applyLiveToUI(cached.ui));
            }
          } catch {}
        }
      } catch {}
    })();
  }, []);

  const saveMenuToCache = useCallback(async (menu) => {
    try { await AsyncStorage.setItem(K_MONI_DEVICES_MENU, JSON.stringify(menu)); } catch {}
  }, []);
  const saveSelectedId = useCallback(async (id) => {
    try { await AsyncStorage.setItem(K_MONI_SELECTED_ID, id ?? ''); } catch {}
  }, []);
  const saveDeviceUiToCache = useCallback(async (deviceId, ui) => {
    try {
      const raw = await AsyncStorage.getItem(K_MONI_DEVICE_MAP);
      const map = raw ? JSON.parse(raw) : {};
      map[deviceId] = { ui, ts: Date.now() };
      await AsyncStorage.setItem(K_MONI_DEVICE_MAP, JSON.stringify(map));
    } catch {}
  }, []);
  const getCachedDevice = useCallback(async (deviceId) => {
    try {
      const raw = await AsyncStorage.getItem(K_MONI_DEVICE_MAP);
      if (!raw) return null;
      const map = JSON.parse(raw) || {};
      return map[deviceId] || null;
    } catch { return null; }
  }, []);

  /* ===== Loaders ===== */
  const loadDeviceList = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoadingList(true);
    try {
      const token = await getAccessTokenSafe(); if (!token) throw new Error(t('missingToken'));
      const res = await getDevices(token);
      const arr = Array.isArray(res?.data) ? res.data : [];
      arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const menu = arr.map((item) => ({
        id: item?._id ?? item?.device_code,
        name: item?.name || item?.device_code || '—',
        portsCount: Array.isArray(item?.ports) ? item.ports.length : 0,
        createdAt: item?.createdAt || null,
      }));
      setDevicesMenu(menu);
      saveMenuToCache(menu);

      if (!selectedId && menu.length > 0) {
        setSelectedId(menu[0].id);
        saveSelectedId(menu[0].id);
      }
    } catch (e) {
      console.warn('loadDeviceList error', e); toast(e?.message || t('errLoadDevices'));
    } finally {
      if (!silent) setLoadingList(false);
    }
  }, [selectedId, toast, saveMenuToCache, saveSelectedId, t]);

  const fetchDeviceDetail = useCallback(async (deviceId) => {
    const token = await getAccessTokenSafe(); if (!token) throw new Error(t('missingToken'));
    const [infoRaw, sessionsRaw] = await Promise.all([ getDeviceInfo(token, deviceId), getDashboardSessions(token) ]);
    const infoPayload = infoRaw?.data ?? infoRaw;
    const sessionsArr = Array.isArray(sessionsRaw) ? sessionsRaw : [];
    const sessionsDev =
      sessionsArr.find((d) => d?._id === infoPayload?._id) ||
      sessionsArr.find((d) => d?.device_code === infoPayload?.device_code) ||
      null;
    return adaptDeviceInfoToUI(infoPayload, sessionsDev, lang);
  }, [lang, t]);

  const loadDeviceDetail = useCallback(async (deviceId, { swr = true } = {}) => {
    if (!deviceId) return;

    if (swr) {
      const cached = await getCachedDevice(deviceId);
      if (cached?.ui) {
        baseDeviceRef.current = cached.ui;
        setSelectedDevice(applyLiveToUI(cached.ui));
      }

      const tooOld = !cached?.ts || (Date.now() - cached.ts > SWR_MAX_AGE_MS);
      if (tooOld) {
        try {
          if (!cached?.ui) setLoadingDetail(true);
          const uiBase = await fetchDeviceDetail(deviceId);
          baseDeviceRef.current = uiBase;
          const uiApplied = applyLiveToUI(uiBase);
          setSelectedDevice(uiApplied);
          saveDeviceUiToCache(deviceId, uiBase);
        } catch (e) {
          console.warn('loadDeviceDetail(SWR) error', e);
          !cached?.ui && toast(e?.message || t('errLoadDeviceInfo'));
        } finally {
          setLoadingDetail(false);
        }
      }
    } else {
      setLoadingDetail(true);
      try {
        const uiBase = await fetchDeviceDetail(deviceId);
        baseDeviceRef.current = uiBase;
        const uiApplied = applyLiveToUI(uiBase);
        setSelectedDevice(uiApplied);
        saveDeviceUiToCache(deviceId, uiBase);
      } catch (e) {
        console.warn('loadDeviceDetail error', e);
        toast(e?.message || t('errLoadDeviceInfo'));
      } finally {
        setLoadingDetail(false);
      }
    }
  }, [fetchDeviceDetail, getCachedDevice, saveDeviceUiToCache, toast, t]);

  useEffect(() => { loadDeviceList({ silent: !!devicesMenu.length }); /* eslint-disable-line */ }, []);
  useEffect(() => {
    if (selectedId) {
      saveSelectedId(selectedId);
      loadDeviceDetail(selectedId, { swr: false });
    }
  } ,[selectedId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDeviceList({ silent: true });
      if (selectedId) await loadDeviceDetail(selectedId, { swr: false });
    } finally { setRefreshing(false); }
  }, [loadDeviceList, loadDeviceDetail, selectedId]);

  /* ======= SSE ======= */
  const parseMaybeJson = (x) => {
    if (x && typeof x === 'object') return x;
    if (typeof x === 'string') {
      try { return JSON.parse(x); } catch { return null; }
    }
    return null;
  };
  const toInt = (v) => {
    if (typeof v === 'number') return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  };

  const getSelectedDeviceCode = useCallback(() => {
    let code = baseDeviceRef.current?.code || selectedDevice?.code;
    return code;
  }, [selectedDevice]);

  useEffect(() => {
    const off = sseManager.on((evt) => {
      if (evt?.type !== 'message') return;

      const obj = parseMaybeJson(evt.data) || evt.data;
      const pt = toInt(obj?.packetType);
      const code = obj?.device_code || obj?.deviceCode || obj?.deviceID || obj?.deviceId;
      if (!code || !Number.isFinite(pt)) return;

      const now = Date.now();
      const dev = liveRef.current.get(code) || { ports: new Map(), ts: now };

      if (pt === 1) {
        const arr = Array.isArray(obj?.kw) ? obj.kw : null;
        const powerKW   = Number(arr?.[0]) || 0;
        const energyKWh = Number(arr?.[1]) || 0;

        const pn = toInt(obj?.portNumber);
        if (Number.isFinite(pn)) {
          const cur = dev.ports.get(pn) || {};
          dev.ports.set(pn, {
            ...cur,
            powerKW,
            energyKWh,
            zeroSince: (powerKW === 0 ? (cur.zeroSince || now) : undefined),
            ts: now,
          });
        }
        dev.ts = now;
        liveRef.current.set(code, dev);

      } else if (pt === 2) {
        const st = normalize(obj?.status);
        dev.status = (st === 'offline') ? 'offline' : 'online';
        dev.ts = now;
        liveRef.current.set(code, dev);

      } else if (pt === 3) {
        const pn = toInt(obj?.portNumber);
        if (Number.isFinite(pn)) {
          const cur = dev.ports.get(pn) || {};
          const mapped = mapPortStatusToVisual(obj?.portStatus) || 'ready';
          dev.ports.set(pn, {
            ...cur,
            portStatus: mapped,
            energyKWh: Number(obj?.kwh) || cur.energyKWh,
            end: obj?.endTime || cur.end,
            powerKW: 0,
            zeroSince: now,
            ts: now,
          });
          dev.ts = now;
          liveRef.current.set(code, dev);
        }
      } else {
        return;
      }

      const showing = getSelectedDeviceCode();
      if (showing && showing === code && baseDeviceRef.current) {
        setSelectedDevice(applyLiveToUI(baseDeviceRef.current));
      }
    });

    return () => { try { off?.(); } catch {} };
  }, [getSelectedDeviceCode]);

  // Tick mỗi 1s để TTL tự rơi overlay
  useEffect(() => {
    const id = setInterval(() => {
      const base = baseDeviceRef.current;
      if (!base) return;

      if (ZERO_TO_READY_SEC > 0) {
        const dev = liveRef.current.get(base.code);
        const now = Date.now();
        if (dev?.ports) {
          for (const [pn, cur] of dev.ports.entries()) {
            if (cur?.powerKW === 0 && cur?.zeroSince && (now - cur.zeroSince >= ZERO_TO_READY_SEC * 1000)) {
              dev.ports.set(pn, { ...cur, portStatus: 'ready', ts: now });
            }
          }
        }
      }

      setSelectedDevice(applyLiveToUI(base));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  /* ===== Skeleton / header ===== */
  const expectedPorts = (() => {
    if (selectedDevice?.ports?.length) return selectedDevice.ports.length;
    const m = devicesMenu.find(d => d.id === selectedId);
    if (m?.portsCount) return m.portsCount;
    return 8;
  })();
  const isLoadingPorts = !selectedDevice || loadingDetail || !(selectedDevice?.ports?.length > 0);

  const menuSelected = devicesMenu.find(d => d.id === selectedId);
  const headerName = selectedDevice?.name || menuSelected?.name || t('loading');
  const headerPortsText = (() => {
    if (isLoadingPorts) {
      return menuSelected?.portsCount != null
        ? t('ports', menuSelected.portsCount)
        : t('ports', '…');
    }
    return t('ports', selectedDevice?.ports?.length || 0);
  })();

  /* ===== helpers QR ===== */
  const buildCheckoutUrl = useCallback((portNumber) => {
    const agentId = selectedDevice?.agentId || '';
    const deviceId = selectedDevice?.deviceId || '';
    const p = portNumber ?? modalPort?.portNumber ?? '';
    return `https://ev-charging.iky.vn/checkout.html?agentId=${encodeURIComponent(agentId)}&deviceId=${encodeURIComponent(deviceId)}&port=${encodeURIComponent(p)}`;
  }, [selectedDevice, modalPort]);

  const openLink = useCallback(async (url) => {
    try { await Linking.openURL(url); } catch { toast(t('toastOpenLinkFail')); }
  }, [toast, t]);

  const saveQrPng = useCallback(async () => {
    if (!modalPort) { toast(t('toastNoPort')); return; }

    try {
      // ✅ iOS: KHÔNG dùng PermissionsAndroid. CameraRoll tự prompt khi cần.
      // Android < 29: xin WRITE_EXTERNAL_STORAGE
      if (Platform.OS === 'android' && Platform.Version < 29) {
        const { PermissionsAndroid } = require('react-native');
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          toast(t('toastNeedStorage'));
          return;
        }
      }

      if (!qrRef.current) { toast(t('toastQrNotReady')); return; }

      qrRef.current.toDataURL(async (base64Data) => {
        try {
          const fname = `qr_${selectedDevice?.code || 'device'}_port${modalPort.portNumber}_${Date.now()}.png`;
          const tempPath = `${RNFS.CachesDirectoryPath}/${fname}`;
          await RNFS.writeFile(tempPath, base64Data, 'base64');
          await CameraRoll.save(tempPath, { type: 'photo' });
          await RNFS.unlink(tempPath).catch(() => {});
          toast(t('toastSaved'));
        } catch (writeError) {
          console.error('Save error:', writeError);
          toast('' + (writeError?.message || writeError));
        }
      });
    } catch (error) {
      console.error('saveQrPng error:', error);
      toast('' + (error?.message || error));
    }
  }, [modalPort, selectedDevice, toast, t]);

  /* ===== UI ===== */
  const renderItem = useCallback(({ item }) => {
    const icon =
      selectedDevice?.deviceStatus === 'offline'
        ? plugOffline
        : (item.visualStatus === 'charging'
            ? plugCharging
            : (item.visualStatus === 'ready' ? plugOnline : plugOffline));

    const portLabel = `${t('port')} ${item.name}`;

    return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => { setModalPort(item); setShowModal(true); }}>
        <View style={[styles.portCard, { marginHorizontal: 16 }]}>
          <Text style={styles.portTitle}>{t('portCardTitle', selectedDevice?.name, portLabel)}</Text>

          <View style={styles.portStatusWrap}>
            <View style={styles.portIconWrap}>
              <Image source={icon} style={styles.portIcon} resizeMode="contain" />
            </View>
            <View>
              <Text style={styles.portStatusLabel}>{t('status')}</Text>
              <Text style={[styles.portStatusValue, { color: STATUS_COLOR[item.portTextStatus] || '#333' }]}>
                {t(item.portTextStatus)}
              </Text>
            </View>
          </View>

          <View style={styles.row}><Text style={styles.kv}>{t('start')}</Text><Text style={styles.v}>{item.start}</Text></View>
          <View style={styles.row}><Text style={styles.kv}>{t('end')}</Text><Text style={styles.v}>{item.end}</Text></View>
          <View style={styles.row}>
            <Text style={styles.kv}>{t('power')}</Text>
            <Text style={styles.v}>{formatPowerKW(item.kw)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.kv}>{t('energy')}</Text>
            <Text style={styles.v}>{formatEnergyKWh(item.kwh)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [selectedDevice, t]);

  const ListHeader = (
    <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
      <Text style={styles.deviceHeader}>{t('deviceName', headerName)}</Text>
      <Text style={styles.deviceSub}>{headerPortsText}</Text>
    </View>
  );

  const listPadTop = 8 // chừa chỗ cho header

  return (
    <View style={styles.container}>
      {/* Header (SafeArea) */}
      <SafeAreaView edges={['top']} style={{ backgroundColor: '#4A90E2' }}>
        <View
          style={[styles.header, { paddingTop: 8 }]}
          onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
        >
          <TouchableOpacity style={styles.menuButton} onPress={openDrawer}>
            <Image source={icHeaderMenu} style={{ width: 24, height: 24 }} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('headerTitle', headerName)}</Text>
        </View>
      </SafeAreaView>

      {/* Drawer overlay */}
      <View
        pointerEvents={drawerOpen ? 'auto' : 'none'}
        style={{
          position: 'absolute',
          left: 0, right: 0, bottom: 0, top:0,
          zIndex: drawerOpen ? 999999 : 0,
          elevation: drawerOpen ? 999999 : 0,
           
        }}
      >
        <EdgeDrawer visible={drawerOpen} onClose={closeDrawer} topOffset={headerHeight}>
          <View style={styles.drawerHeader}>
            <View style={styles.drawerHeaderLeft}>
              <View style={styles.drawerBadge}>
                <Image source={icBoltWhite} style={{ width: 16, height: 16 }} />
              </View>
              <Text style={styles.drawerTitle}>{t('devices')}</Text>
            </View>
            <TouchableOpacity onPress={closeDrawer} style={styles.drawerCloseBtn} hitSlop={{top:8,bottom:8,left:8,right:8}}>
              <Icon name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          <View style={{ height: 6 }} />

          <FlatList
            data={devicesMenu}
            keyExtractor={(x) => String(x.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => { setSelectedId(item.id); closeDrawer(); }}
                style={[
                  styles.deviceMenuItemCompact,
                  selectedId === item.id && {
                    borderColor: '#111827',
                    backgroundColor: '#f7faff',
                  },
                ]}
              >
                <View style={styles.deviceMenuIconCompact}>
                  <Image source={icDrawerDevices} style={{ width: 14, height: 14, tintColor: '#fff' }} />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.deviceMenuNameCompact} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.deviceMenuPortsCompact}>
                    {t('ports', item.portsCount)}
                  </Text>
                </View>

                <Icon name="chevron-right" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
            contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 12 }}
            ListEmptyComponent={
              <Text style={{ color: '#6B7280', padding: 12 }}>{t('loading')}</Text>
            }
            showsVerticalScrollIndicator={true}
            removeClippedSubviews={true}
            initialNumToRender={20}
            maxToRenderPerBatch={20}
            windowSize={7}
          />
        </EdgeDrawer>
      </View>

      {/* Main list */}
      <View style={{ flex: 1 }}>
        {isLoadingPorts ? (
          <FlatList
            data={Array.from({ length: expectedPorts })}
            keyExtractor={(_, i) => `sk-${i}`}
            ListHeaderComponent={ListHeader}
            renderItem={() => <PortCardSkeleton />}
            ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
            contentContainerStyle={{ paddingTop: listPadTop, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <FlatList
            data={selectedDevice?.ports || []}
            keyExtractor={(p) => String(p.id)}
            ListHeaderComponent={ListHeader}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            contentContainerStyle={{ paddingTop: listPadTop, paddingBottom: 32 }}
            refreshing={refreshing}
            onRefresh={onRefresh}
            removeClippedSubviews={false}
            initialNumToRender={32}
            maxToRenderPerBatch={32}
            windowSize={10}
            onEndReachedThreshold={0.1}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* CENTER MODAL có QR */}
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        presentationStyle="overFullScreen"
        onRequestClose={closePortModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closePortModal}>
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconBadge}>
                  <Image source={icBoltWhite} style={{ width: 20, height: 20 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>{t('portDetail')}</Text>
                  {!!modalPort && (
                    <Text style={styles.modalSubtitle}>
                      {headerName} • {t('port')} {modalPort?.name} • {t(modalPort?.portTextStatus)}
                    </Text>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={closePortModal} style={styles.modalCloseBtn}>
                <Icon name="close" size={24} color="#111827" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            {!!modalPort && (
              <View style={styles.modalContent}>
                <View style={styles.modalInfoCard}>
                  {[
                    ['Port', `${t('port')} ${modalPort.name}`],
                    [t('status'), t(modalPort.portTextStatus)],
                    [t('start'), modalPort.start],
                    [t('end'), modalPort.end],
                    [t('power'), formatPowerKW(modalPort.kw)],
                    [t('energy'), formatEnergyKWh(modalPort.kwh)],
                  ].map(([k, v], i) => (
                    <View key={k} style={[styles.modalInfoRow, i === 0 && { borderTopWidth: 0 }]}>
                      <Text style={styles.modalInfoKey}>{k}</Text>
                      <Text style={styles.modalInfoValue}>{v}</Text>
                    </View>
                  ))}
                </View>

                {/* ==== QR AREA ==== */}
                <Text style={styles.qrHint}>{t('tapQRHint')}</Text>
                <View style={styles.qrWrap}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => openLink(buildCheckoutUrl(modalPort.portNumber))}
                  >
                    <View style={styles.qrBox}>
                      <QRCode
                        value={buildCheckoutUrl(modalPort.portNumber)}
                        size={200}
                        quietZone={10}
                        getRef={(c) => { qrRef.current = c; }}
                      />
                    </View>
                  </TouchableOpacity>

                  <View style={styles.modalActions}>
                    <TouchableOpacity
                      style={[styles.btnPrimary, { flex: 1 }]}
                      onPress={() => openLink(buildCheckoutUrl(modalPort.portNumber))}
                    >
                      <Image source={icOpenPng} style={{ width: 18, height: 18, marginRight: 6, tintColor: '#fff' }} />
                      <Text style={styles.btnPrimaryText}>{t('openLink')}</Text>
                    </TouchableOpacity>

                    <View style={{ width: 10 }} />

                    <TouchableOpacity
                      style={[styles.btnGhost, { flex: 1 }]}
                      onPress={saveQrPng}
                    >
                      <Image source={icDownloadPng} style={{ width: 18, height: 18, marginRight: 6, tintColor: '#2563EB' }} />
                      <Text style={styles.btnGhostText}>{t('saveQR')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {/* ==== /QR AREA ==== */}
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ============== styles ============== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },

  header: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: { padding: 4, marginRight: 8 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '600', flex: 1 },

  drawerHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent:'space-between' },
  drawerHeaderLeft: { flexDirection: 'row', alignItems: 'center' },
  drawerCloseBtn: { padding: 6, borderRadius: 999 },

  drawerBadge: { width: 28, height: 28, borderRadius: 8, backgroundColor:'#4A90E2', alignItems:'center', justifyContent:'center', marginRight: 8 },
  drawerTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },

  deviceHeader: { fontSize: 18, fontWeight: '800', color: '#111827' },
  deviceSub: { fontSize: 12, color: '#6B7280', marginTop: 2, marginBottom: 10 },

  portCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 3,
  },
  portTitle: { fontSize: 15, fontWeight: '800', color: '#111827', marginBottom: 8 },

  portStatusWrap: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  portIconWrap: { width: 50, height: 50, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  portIcon: { width: 40, height: 40 },

  portStatusLabel: { fontSize: 12, color: '#6B7280' },
  portStatusValue: { fontSize: 14, fontWeight: '800' },

  row: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#EEE',
  },
  kv: { fontSize: 13, color: '#6B7280' },
  v: { fontSize: 13, color: '#111827', fontWeight: '600' },

  // CENTER MODAL STYLES
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 450,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  modalIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#4A90E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 8,
    marginLeft: 8,
  },
  modalContent: {
    padding: 20,
  },
  modalInfoCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  modalInfoKey: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  modalInfoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '700',
  },

  // QR area
  qrWrap: { alignItems: 'center', marginTop: 5 },
  qrBox: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  qrHint: { marginTop: 2, fontSize: 12, color: '#6B7280', textAlign:'center' },

  modalActions: { flexDirection: 'row', marginTop: 14 },

  btnPrimary: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '800' },

  btnGhost: {
    borderWidth: 1, borderColor: '#2563EB', borderRadius: 12,
    paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center'
  },
  btnGhostText: { color: '#2563EB', fontWeight: '800' },

  deviceMenuItemCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  deviceMenuIconCompact: {
    backgroundColor: '#4A90E2',
    borderRadius: 7,
    padding: 5,
    marginRight: 10,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceMenuNameCompact: {
    fontSize: 13,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 1,
  },
  deviceMenuPortsCompact: {
    fontSize: 11,
    color: '#6B7280',
  },
});
