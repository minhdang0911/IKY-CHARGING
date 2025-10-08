// screens/Home/MonitoringScreen.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable,
  FlatList, Platform, ToastAndroid, Alert, Image,
  Modal, PermissionsAndroid, Linking, ScrollView
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import RNFS from 'react-native-fs';

// CameraRoll: chỉ require khi KHÔNG phải web
let CameraRoll;
if (Platform.OS !== 'web') {
  try {
    // eslint-disable-next-line global-require
    CameraRoll = require('@react-native-camera-roll/camera-roll').CameraRoll;
  } catch {}
}

// ICONS
import plugOffline from '../../assets/img/ic_offline.png';
import plugOnline from '../../assets/img/ic_online.png';
import plugCharging from '../../assets/img/ic_charging.png';

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
    toastNeedPhoto: 'Thiếu quyền truy cập thư viện ảnh',
    toastQrNotReady: 'QR Code chưa sẵn sàng, vui lòng thử lại',
    toastSaved: 'Đã lưu ảnh vào thư viện',
    errLoadDevices: 'Load devices lỗi',
    errLoadDeviceInfo: 'Load device info lỗi',
    missingToken: 'Thiếu accessToken',
    viewDetail: 'Xem chi tiết',
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
    toastNeedPhoto: 'Photo library permission required',
    toastQrNotReady: 'QR Code not ready, please try again',
    toastSaved: 'Saved to Photos',
    errLoadDevices: 'Failed to load devices',
    errLoadDeviceInfo: 'Failed to load device info',
    missingToken: 'Missing accessToken',
    viewDetail: 'View details',
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
const SWR_MAX_AGE_MS = 60 * 1000;

/* ====== LIVE overlay config ====== */
const LIVE_TTL_MS = 10 * 1000;        // TTL overlay
const ZERO_TO_READY_SEC = 0;          // nếu backend không bắn pt=3, set >0 để auto ready khi kw=0 liên tục Xs

// Map<device_code, { status?:'online'|'offline', ts:number, ports: Map<number, {portStatus?:string, powerKW?:number, energyKWh?:number, end?:string, zeroSince?:number, ts:number}> }>
const liveRef = { current: new Map() };

function mapPortStatusToVisual(s) {
  const x = normalize(s);
  if (x === 'offline') return 'offline';
  if (['fault','error','unavailable'].includes(x)) return 'fault';
  if (['busy','charging','running','in_progress','active'].includes(x)) return 'charging';
  if (['idle','ready','completed','finish','finished'].includes(x)) return 'ready';
  return undefined;
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

    let visual;
    let textStat;

    if (deviceOffline) {
      visual = 'offline'; textStat = 'offline';
    } else if (portStat === 'busy') {
      visual = 'charging'; textStat = 'charging';
    } else if (portStat === 'idle') {
      visual = 'ready'; textStat = 'ready';
    } else if (['fault', 'error', 'unavailable'].includes(portStat)) {
      visual = 'fault'; textStat = 'fault';
    } else {
      const isRun = ['running','in_progress','active','charging'].includes(sessStat);
      visual = isRun ? 'charging' : 'ready';
      textStat = isRun ? 'charging' : 'ready';
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

/* ========= WebModal (giả lập Modal trên web) ========= */
function WebModal({ visible, onRequestClose, children }) {
  if (!visible) return null;
  return (
    <Pressable style={styles.modalOverlayAbs} onPress={onRequestClose}>
      <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
        <ScrollView
          style={styles.modalScrollWeb}
          contentContainerStyle={styles.modalScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {children}
          <View style={{ height: 16 }} />
        </ScrollView>
      </View>
    </Pressable>
  );
}

/* ========= ModalContent (nội dung modal, dùng chung web/native) ========= */
function ModalContent({
  t, headerName, modalPort,
  buildCheckoutUrl, openLink, saveQrPng, qrRef
}) {
  if (!modalPort) return null;
  return (
    <>
      {/* Header */}
      <View style={styles.modalHeader}>
        <View style={styles.modalHeaderLeft}>
          <View style={styles.modalIconBadge}>
            <Icon name="bolt" size={20} color="#fff" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.modalTitle}>{t('portDetail')}</Text>
            <Text style={styles.modalSubtitle}>
              {headerName} • {t('port')} {modalPort?.name} • {t(modalPort?.portTextStatus)}
            </Text>
          </View>
        </View>
      </View>

      {/* Content */}
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
              style={styles.btnPrimary}
              onPress={() => openLink(buildCheckoutUrl(modalPort.portNumber))}
            >
              <Text style={styles.btnPrimaryText}>{t('openLink')}</Text>
            </TouchableOpacity>

            <View style={{ width: 10 }} />

            <TouchableOpacity
              style={styles.btnGhost}
              onPress={saveQrPng}
            >
              <Text style={styles.btnGhostText}>{t('saveQR')}</Text>
            </TouchableOpacity>
          </View>
        </View>
        {/* ==== /QR AREA ==== */}
      </View>
    </>
  );
}

/* ===================== SCREEN ===================== */
export default function MonitoringScreen() {
  const { t, lang } = useI18n();

  // ✅ Spacer để chừa chỗ cho navBottom đang fixed
  const BOTTOM_SPACER = Platform.select({ web: 120, default: 90 });
  const FooterSpacer = useCallback(() => <View style={{ height: BOTTOM_SPACER }} />, [BOTTOM_SPACER]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const [headerHeight, setHeaderHeight] = useState(0);

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

  // ✅ Hàm mở/đóng modal
  const handleOpenPortModal = useCallback((port) => {
    setModalPort(port || null);
    setShowModal(Boolean(port));
  }, []);
  const handleClosePortModal = useCallback(() => setShowModal(false), []);

  // QR ref (trong modal)
  const qrRef = useRef(null);

  /* ====== SWR: hydrate cache ====== */
  useEffect(() => {
    (async () => {
      try {
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
  useEffect(() => { if (selectedId) { saveSelectedId(selectedId); loadDeviceDetail(selectedId, { swr: true }); } /* eslint-disable-line */ }, [selectedId]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDeviceList({ silent: true });
      if (selectedId) await loadDeviceDetail(selectedId, { swr: false });
    } finally { setRefreshing(false); }
  }, [loadDeviceList, loadDeviceDetail, selectedId]);

  /* ======= SSE: parse & overlay (per-port + pt:3) ======= */
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
    if (!code && selectedId && devicesMenu.length) { /* đợi fetch detail */ }
    return code;
  }, [selectedDevice, selectedId, devicesMenu.length]);

  useEffect(() => {
    const off = sseManager.on((evt) => {
      if (evt?.type !== 'message') return;

      const obj = parseMaybeJson(evt.data) || evt.data;
      const pt = toInt(obj?.packetType);
      const code = obj?.device_code || obj?.deviceCode || obj?.deviceID || obj?.deviceId || null;
      if (!code || !Number.isFinite(pt)) return;

      const now = Date.now();
      const dev = liveRef.current.get(code) || { ports: new Map(), ts: now };

      if (pt === 1) {
        // power/energy (tổng hoặc theo port)
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
        // online/offline device
        const st = normalize(obj?.status);
        dev.status = (st === 'offline') ? 'offline' : 'online';
        dev.ts = now;
        liveRef.current.set(code, dev);

      } else if (pt === 3) {
        // completed / status cổng
        const pn = toInt(obj?.portNumber);
        if (Number.isFinite(pn)) {
          const cur = dev.ports.get(pn) || {};
          const mapped = mapPortStatusToVisual(obj?.portStatus) || 'ready';
          dev.ports.set(pn, {
            ...cur,
            portStatus: mapped,                  // flip về ready ngay
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

      // render ngay nếu đang xem đúng device
      const showing = getSelectedDeviceCode();
      if (showing && showing === code && baseDeviceRef.current) {
        setSelectedDevice(applyLiveToUI(baseDeviceRef.current));
      }
    });

    return () => { try { off?.(); } catch {} };
  }, [getSelectedDeviceCode]);

  // Tick mỗi 1s để TTL tự rơi overlay, và (tuỳ chọn) auto-ready khi kw=0 đủ lâu
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
  const [modalPortState, setModalPortState] = useState(null); // (nếu m dùng chỗ khác)
  const buildCheckoutUrl = useCallback((portNumber) => {
    const agentId = selectedDevice?.agentId || '';
    const deviceId = selectedDevice?.deviceId || '';
    const p = portNumber ?? modalPort?.portNumber ?? modalPortState?.portNumber ?? '';
    return `https://ev-charging.iky.vn/checkout.html?agentId=${encodeURIComponent(agentId)}&deviceId=${encodeURIComponent(deviceId)}&port=${encodeURIComponent(p)}`;
  }, [selectedDevice, modalPort, modalPortState]);

  const openLink = useCallback(async (url) => {
    try { await Linking.openURL(url); } catch { toast(t('toastOpenLinkFail')); }
  }, [toast, t]);

  const saveQrPng = useCallback(async () => {
    const portCtx = modalPort || modalPortState;
    if (!portCtx) { toast(t('toastNoPort')); return; }

    // ⚡ WEB: vẽ QR lên canvas -> tải PNG
    if (Platform.OS === 'web') {
      try {
        const url = buildCheckoutUrl(portCtx.portNumber);
        const QRCodeLib = await import('qrcode'); // dynamic import
        const canvas = document.createElement('canvas');
        const size = 300;
        canvas.width = size; canvas.height = size;
        await QRCodeLib.toCanvas(canvas, url, { width: size, margin: 1 });
        const pngUrl = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = pngUrl;
        a.download = `qr_${selectedDevice?.code || 'device'}_port${portCtx.portNumber}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast(t('toastSaved'));
      } catch (err) {
        console.error('saveQrPng web error', err);
        toast(err?.message || 'Save error');
      }
      return;
    }

    // ⚡ Native
    try {
      if (!qrRef.current) { toast(t('toastQrNotReady')); return; }

      if (Platform.OS === 'android' && Platform.Version < 29) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          toast(t('toastNeedStorage'));
          return;
        }
      }

      qrRef.current.toDataURL(async (base64Data) => {
        try {
          const fname = `qr_${selectedDevice?.code || 'device'}_port${portCtx.portNumber}_${Date.now()}.png`;
          const tempPath = `${RNFS.CachesDirectoryPath}/${fname}`;
          await RNFS.writeFile(tempPath, base64Data, 'base64');
          await CameraRoll?.save(tempPath, { type: 'photo' });
          await RNFS.unlink(tempPath).catch(() => {});
          toast(t('toastSaved'));
        } catch (err) {
          console.error('Save error:', err);
          toast(err?.message || 'Save failed');
        }
      });
    } catch (err) {
      console.error('saveQrPng native error:', err);
      toast(err?.message || 'Save failed');
    }
  }, [modalPort, modalPortState, selectedDevice, toast, t, buildCheckoutUrl]);

  /* ===== UI ===== */
  const renderItem = useCallback(({ item }) => {
    const icon =
      selectedDevice?.deviceStatus === 'offline'
        ? plugOffline
        : (item.visualStatus === 'charging'
            ? plugCharging
            : (item.visualStatus === 'ready' ? plugOnline : plugOffline)); // 'fault' -> tạm dùng offline icon

    const portLabel = `${t('port')} ${item.name}`;

    return (
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

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.btnDetail}
            onPress={() => handleOpenPortModal(item)}
            activeOpacity={0.85}
          >
            <Icon name="visibility" size={18} color="#2563EB" style={{ marginRight: 6 }} />
            <Text style={styles.btnDetailText}>{t('viewDetail')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }, [selectedDevice, t, handleOpenPortModal]);

  const ListHeader = (
    <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
      <Text style={styles.deviceHeader}>{t('deviceName', headerName)}</Text>
      <Text style={styles.deviceSub}>{headerPortsText}</Text>
    </View>
  );

  // Chọn component Modal theo platform
  const ModalLike = Platform.OS === 'web' ? WebModal : Modal;
  const modalProps = Platform.OS === 'web'
    ? { visible: showModal, onRequestClose: handleClosePortModal }
    : { visible: showModal, transparent: true, animationType: 'fade', onRequestClose: handleClosePortModal };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header} onLayout={(e)=>setHeaderHeight(e.nativeEvent.layout.height)}>
        <TouchableOpacity style={styles.menuButton} onPress={openDrawer}>
          <Icon name="menu" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('headerTitle', selectedDevice?.name || t('loading'))}</Text>
      </View>

      {/* Drawer */}
      {drawerOpen && (
        <View
          pointerEvents="box-none"
          style={Platform.select({
            web: { position:'fixed', left:0, right:0, bottom:0, top:headerHeight, zIndex:9998 },
            default: { position:'absolute', left:0, right:0, bottom:0, top:headerHeight, zIndex:9998 },
          })}
        >
          <EdgeDrawer visible onClose={closeDrawer}>
            <View style={{ flexGrow: 0 }}>
              <View style={styles.drawerHeader}>
                <View style={styles.drawerBadge}><Icon name="memory" size={16} color="#fff" /></View>
                <Text style={styles.drawerTitle}>{t('devices')}</Text>
              </View>
              <View style={{ height: 8 }} />
              <FlatList
                data={devicesMenu}
                keyExtractor={(x) => String(x.id)}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => { setSelectedId(item.id); closeDrawer(); }}
                    style={[styles.deviceMenuItem, selectedId === item.id && { borderColor: '#111827', backgroundColor: '#f7faff' }]}
                  >
                    <View style={styles.deviceMenuIcon}><Icon name="memory" size={16} color="#fff" /></View>
                    <View style={{  minWidth: 0 }}>
                      <Text style={styles.deviceMenuName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.deviceMenuPorts}>{t('ports', item.portsCount)}</Text>
                    </View>
                    <Icon name="chevron-right" size={22} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
                contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
                ListEmptyComponent={<Text style={{ color:'#6B7280', padding:16 }}>{t('loading')}</Text>}
                showsVerticalScrollIndicator={false}
              />
            </View>
          </EdgeDrawer>
        </View>
      )}

      {/* Main list */}
      <View style={{ flex: 1 }}>
        {isLoadingPorts ? (
          <FlatList
            data={Array.from({ length: expectedPorts })}
            keyExtractor={(_, i) => `sk-${i}`}
            ListHeaderComponent={ListHeader}
            renderItem={() => <PortCardSkeleton />}
            ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
            contentContainerStyle={{ paddingTop: 8 }}
            ListFooterComponent={FooterSpacer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        ) : (
          <FlatList
            data={selectedDevice?.ports || []}
            keyExtractor={(p) => String(p.id)}
            ListHeaderComponent={ListHeader}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            contentContainerStyle={{ paddingTop: 8 }}
            ListFooterComponent={FooterSpacer}
            refreshing={refreshing}
            onRefresh={onRefresh}
            removeClippedSubviews={false}
            initialNumToRender={32}
            maxToRenderPerBatch={32}
            windowSize={10}
            onEndReachedThreshold={0.1}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </View>

      {/* MODAL / WEB-MODAL */}
      <ModalLike {...modalProps}>
        {Platform.OS === 'web' ? (
          <ModalContent
            t={t}
            headerName={selectedDevice?.name || ''}
            modalPort={modalPort}
            buildCheckoutUrl={buildCheckoutUrl}
            openLink={openLink}
            saveQrPng={saveQrPng}
            qrRef={qrRef}
          />
        ) : (
          <Pressable style={styles.modalOverlay} onPress={handleClosePortModal}>
            <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
              <ScrollView
                style={styles.modalScrollNative}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                <ModalContent
                  t={t}
                  headerName={selectedDevice?.name || ''}
                  modalPort={modalPort}
                  buildCheckoutUrl={buildCheckoutUrl}
                  openLink={openLink}
                  saveQrPng={saveQrPng}
                  qrRef={qrRef}
                />
                <View style={{ height: 16 }} />
              </ScrollView>
            </View>
          </Pressable>
        )}
      </ModalLike>
    </View>
  );
}

/* ============== styles ============== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F7FB' },

  header: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuButton: { padding: 4, marginRight: 8 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '600', flex: 1 },

  deviceMenuItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12,
    backgroundColor: '#fff'
  },
  deviceMenuIcon: {
    backgroundColor: '#4A90E2', borderRadius: 8, padding: 6, marginRight: 12,
    width: 32, height: 32, justifyContent: 'center', alignItems: 'center',
  },
  deviceMenuName: { fontSize: 14, fontWeight: '700', color: '#111827', marginBottom: 2 },
  deviceMenuPorts: { fontSize: 12, color: '#6B7280' },

  drawerHeader: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' },
  drawerBadge: { width: 28, height: 28, borderRadius: 8, backgroundColor:'#4A90E2', alignItems:'center', justifyContent:'center', marginRight: 8 },
  drawerTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },

  deviceHeader: { fontSize: 18, fontWeight: '800', color: '#111827' },
  deviceSub: { fontSize: 12, color: '#6B7280', marginTop: 2, marginBottom: 10 },

  portCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 3,
    marginBottom: 12,
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

  // Card actions
  cardActions: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  btnDetail: {
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnDetailText: {
    color: '#2563EB',
    fontWeight: '800',
  },

  // Nền mờ cho native Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },

  // Overlay tuyệt đối cho web (portal giả lập)
  modalOverlayAbs: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
    zIndex: 2147483647,
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 450,
    ...Platform.select({
      web: { maxHeight: '90vh', overflow: 'hidden' },
      default: { maxHeight: '90%', overflow: 'hidden' },
    }),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },

  // Khu vực cuộn bên trong modal
  modalScrollWeb: {
    width: '100%',
    maxHeight: '90vh',
  },
  modalScrollNative: {
    flexGrow: 0,
    maxHeight: '90%',
  },
  modalScrollContent: {
    paddingBottom: 24,
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
    flex: 1,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize:14 },

  btnGhost: {
    borderWidth: 1, borderColor: '#2563EB', borderRadius: 12,
    paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    flex: 1,
  },
  btnGhostText: { color: '#2563EB', fontWeight: '600', fontSize:14 },
});
