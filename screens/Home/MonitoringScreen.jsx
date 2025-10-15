// screens/Home/MonitoringScreen.jsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView,
  FlatList, Platform, ToastAndroid, Alert, Image, Modal,
  PermissionsAndroid, Linking
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import QRCode from 'react-native-qrcode-svg';
import RNFS from 'react-native-fs';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import BottomTabNavigation from '../../components/NavBottom/navBottom';

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
    // ⬇ empty
    noDevicesTitle: 'Không có thiết bị nào',
    noDevicesDesc: 'Tài khoản này chưa có thiết bị hoặc chưa được phân quyền.',
    tryAgain: 'Thử lại',
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
    // ⬇ empty
    noDevicesTitle: 'No devices',
    noDevicesDesc: 'This account has no devices or lacks permissions.',
    tryAgain: 'Try again',
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
  const keys = ['access_token'];
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

function slugify(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/* ====== Cache keys (SWR) ====== */
const K_MONI_DEVICES_MENU = 'moni_devices_menu';
const K_MONI_SELECTED_ID  = 'moni_selected_id';
const K_MONI_DEVICE_MAP   = 'moni_device_map';
const K_MONI_SCOPE        = 'moni_scope';
const SWR_MAX_AGE_MS = 60 * 1000;

// purge toàn bộ cache monitor
async function purgeMonitoringCache() {
  try {
    await AsyncStorage.multiRemove([K_MONI_DEVICES_MENU, K_MONI_SELECTED_ID, K_MONI_DEVICE_MAP]);
  } catch {}
}

/* ====== LIVE overlay config ====== */
const LIVE_TTL_MS = 10 * 1000;
const ZERO_TO_READY_SEC = 0;

// Map<device_code, {...}>
const liveRef = { current: new Map() };

function mapPortStatusToVisual(s) {
  const x = normalize(s);
  if (x === 'offline') return 'offline';
  if (['fault','error','unavailable'].includes(x)) return 'fault';
  if (['busy','charging','running','in_progress','active'].includes(x)) return 'charging';
  if (['idle','ready','completed','finish','finished'].includes(x)) return 'ready';
  return undefined;
}

// scope theo token (không lưu full token)
async function computeScope() {
  const token = await getAccessTokenSafe();
  if (!token) return 'anon';
  return 't:' + token.slice(-12);
}

/* ====== ADAPTER (web rule) ====== */
function adaptDeviceInfoToUI(info, sessionsDev, lang) {
  const name = info?.name || info?.device_code || '—';
  const agentName = (typeof info?.agent_id === 'object' ? info?.agent_id?.name : '') || '';
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
    agentName,
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
      kw:  fresh && typeof liveP.powerKW === 'number'   ? liveP.powerKW   : p.kw,
      kwh: fresh && typeof liveP.energyKWh === 'number' ? liveP.energyKWh : p.kwh,
      end: fresh && liveP.end ? liveP.end : p.end,
    };
  });

  return next;
}

/* ===================== SCREEN ===================== */
export default function MonitoringScreen({ setBottomHidden }) {
  const { t, lang } = useI18n();

  const [drawerOpen, setDrawerOpen] = useState(false);
 const openDrawer = useCallback(() => {
  setDrawerOpen(true);
  try { setBottomHidden?.(true); } catch {}
}, [setBottomHidden]);

const closeDrawer = useCallback(() => {
  setDrawerOpen(false);
  try { setBottomHidden?.(showModal); } catch {} // còn modal thì vẫn ẩn
}, [setBottomHidden, showModal]);


  const [devicesMenu, setDevicesMenu] = useState([]); 
  const [selectedId, setSelectedId] = useState(null);
  const [selectedDevice, setSelectedDevice] = useState(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const baseDeviceRef = useRef(null);
  const HEADER_DEFAULT_H = 64;
  const [headerHeight, setHeaderHeight] = useState(HEADER_DEFAULT_H);

  const toast = useCallback((msg) => {
    if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
    else Alert.alert('', msg);
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [modalPort, setModalPort] = useState(null);

  const qrRef = useRef(null);

  /* ====== SWR: hydrate cache + scope-busting theo account ====== */
  useEffect(() => {
    (async () => {
      try {
        // scope check
        const scope = await computeScope();
        const curScope = await AsyncStorage.getItem(K_MONI_SCOPE);
        if (curScope !== scope) {
          await purgeMonitoringCache();
          await AsyncStorage.setItem(K_MONI_SCOPE, scope);
        }

        // hydrate cache
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

      // rỗng → clear hết & hiển thị empty state
      if (arr.length === 0) {
        await purgeMonitoringCache();
        setDevicesMenu([]);
        setSelectedId(null);
        setSelectedDevice(null);
        return;
      }

      arr.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      const menu = arr.map((item) => ({
        id: item?._id ?? item?.device_code,
        name: item?.name || item?.device_code || '—',
        portsCount: Array.isArray(item?.ports) ? item.ports.length : 0,
        createdAt: item?.createdAt || null,
      }));
      setDevicesMenu(menu);
      saveMenuToCache(menu);

      // id cũ không còn → chọn lại
      const stillExists = selectedId && menu.some(m => m.id === selectedId);
      if (!stillExists) {
        const nextId = menu[0]?.id ?? null;
        setSelectedId(nextId);
        if (nextId) saveSelectedId(nextId); else await AsyncStorage.removeItem(K_MONI_SELECTED_ID);
        baseDeviceRef.current = null;
        setSelectedDevice(null);
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
          if (!uiBase || !uiBase.deviceId) throw new Error('Device not found');

          baseDeviceRef.current = uiBase;
          const uiApplied = applyLiveToUI(uiBase);
          setSelectedDevice(uiApplied);
          saveDeviceUiToCache(deviceId, uiBase);
        } catch (e) {
          console.warn('loadDeviceDetail(SWR) error', e);
          baseDeviceRef.current = null;
          setSelectedDevice(null);
          !cached?.ui && toast(e?.message || t('errLoadDeviceInfo'));
        } finally {
          setLoadingDetail(false);
        }
      }
    } else {
      setLoadingDetail(true);
      try {
        const uiBase = await fetchDeviceDetail(deviceId);
        if (!uiBase || !uiBase.deviceId) throw new Error('Device not found');
        baseDeviceRef.current = uiBase;
        const uiApplied = applyLiveToUI(uiBase);
        setSelectedDevice(uiApplied);
        saveDeviceUiToCache(deviceId, uiBase);
      } catch (e) {
        console.warn('loadDeviceDetail error', e);
        baseDeviceRef.current = null;
        setSelectedDevice(null);
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
      loadDeviceDetail(selectedId, { swr: false }); // ép gọi API mới ngay sau F5
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  function WebModal({ visible, onRequestClose, children }) {
    if (!visible) return null;
    return (
      <Pressable style={styles.modalOverlayAbs} onPress={onRequestClose}>
        <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
          {children}
        </View>
      </Pressable>
    );
  }

 function ModalContent({ t, headerName, modalPort, buildCheckoutUrl, openLink, saveQrPng, qrRef, onRequestClose }) {
    return (
      <>
        {/* Header cố định */}
       <View style={styles.modalHeader}>
  <View style={styles.modalHeaderLeft}>
    <View style={styles.modalIconBadge}>
      <Icon name="bolt" size={20} color="#fff" />
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

  {/* 👇 Nút X để đóng modal */}
  <TouchableOpacity onPress={onRequestClose} style={styles.modalCloseBtn}>
    <Icon name="close" size={22} color="#6B7280" />
  </TouchableOpacity>
</View>


        {/* Phần có thể kéo */}
        <ScrollView
          style={styles.modalScroll}
  contentContainerStyle={styles.modalScrollContent}
  keyboardShouldPersistTaps="handled"
  nestedScrollEnabled
  showsVerticalScrollIndicator
  bounces={false}
  maintainVisibleContentPosition={{ minIndexForVisible: 0 }} 
  scrollEventThrottle={16} 
  automaticallyAdjustContentInsets={false} 
        >
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

                  <TouchableOpacity style={styles.btnGhost} onPress={saveQrPng}>
                    <Text style={styles.btnGhostText}>{t('saveQR')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      </>
    );
  }

 const handleOpenPortModal = useCallback((port) => {
   setModalPort(port || null);
   setShowModal(Boolean(port));
   try { setBottomHidden?.(true); } catch {}
 }, [setBottomHidden]);
 


 const handleClosePortModal = useCallback(() => {
  setShowModal(false);
  try { setBottomHidden?.(false); } catch {} }, [setBottomHidden]);
 const ModalLike = Platform.OS === 'web' ? WebModal : Modal;
  const modalProps = Platform.OS === 'web'
    ? { visible: showModal, onRequestClose: handleClosePortModal }
    : { visible: showModal, transparent: true, animationType: 'fade', onRequestClose: handleClosePortModal };


   useEffect(() => {
  return () => {
    try { setBottomHidden?.(false); } catch {}
   };
 }, [setBottomHidden]);


 // Ẩn/hiện navBottom theo Drawer hoặc Modal
useEffect(() => {
  try { setBottomHidden?.(drawerOpen || showModal); } catch {}
}, [drawerOpen, showModal, setBottomHidden]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadDeviceList({ silent: true });
      if (selectedId) await loadDeviceDetail(selectedId, { swr: false });
    } finally { setRefreshing(false); }
  }, [loadDeviceList, loadDeviceDetail, selectedId]);

  /* ======= SSE: parse & overlay live theo device_code + port ======= */
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

  /* ===== Skeleton / header & empty-state ===== */
  const expectedPorts = (() => {
    if (selectedDevice?.ports?.length) return selectedDevice.ports.length;
    const m = devicesMenu.find(d => d.id === selectedId);
    if (m?.portsCount) return m.portsCount;
    return 8;
  })();
  const isLoadingPorts = !selectedDevice || loadingDetail || !(selectedDevice?.ports?.length > 0);

  const menuSelected = devicesMenu.find(d => d.id === selectedId);

  const showEmpty = !loadingList && devicesMenu.length === 0; // ⬅️ empty khi list rỗng

  const headerName =
    showEmpty ? t('noDevicesTitle') : (selectedDevice?.name || menuSelected?.name || t('loading'));

  const headerPortsText = (() => {
    if (showEmpty) return t('ports', 0);
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

    const device = selectedDevice?.name || selectedDevice?.code || 'Device';
    const port = modalPort.portNumber != null ? `cổng ${modalPort.portNumber}` : 'c?';
    const baseLabel = `${device}-${port}`;
    const fname = `${slugify(baseLabel)}.png`;

    if (Platform.OS === 'web') {
      try {
        let svgEl = null;
        const modalSvgs = document.querySelectorAll('[class*="modal"] svg, [class*="Modal"] svg');
        if (modalSvgs.length > 0) svgEl = modalSvgs[modalSvgs.length - 1];
        if (!svgEl) {
          const qrSvgs = document.querySelectorAll('.qrBox svg, .qrWrap svg');
          if (qrSvgs.length > 0) svgEl = qrSvgs[0];
        }
        if (!svgEl) {
          const allSvgs = Array.from(document.querySelectorAll('svg'));
          svgEl = allSvgs.find(svg => {
            const w = svg.getAttribute('width') || svg.clientWidth;
            const h = svg.getAttribute('height') || svg.clientHeight;
            return Number(w) >= 150 && Number(h) >= 150;
          });
        }
        if (!svgEl) { toast(t('toastQrNotReady')); return; }

        const clonedSvg = svgEl.cloneNode(true);
        const width = clonedSvg.getAttribute('width') || clonedSvg.clientWidth || 200;
        const height = clonedSvg.getAttribute('height') || clonedSvg.clientHeight || 200;
        clonedSvg.setAttribute('width', width);
        clonedSvg.setAttribute('height', height);
        const svgData = new XMLSerializer().serializeToString(clonedSvg);

        const img = new window.Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const scale = 2;
            canvas.width = Number(width) * scale;
            canvas.height = Number(height) * scale;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            const pngUrl = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = fname;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            toast(t('toastSaved'));
          } catch {
            toast(t('toastQrNotReady'));
          }
        };
        img.onerror = () => toast(t('toastQrNotReady'));
        const svgWithNs = svgData.includes('xmlns')
          ? svgData
          : svgData.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgWithNs);
      } catch (e) {
        toast('' + (e?.message || e));
      }
      return;
    }

    // Native
    try {
      if (!qrRef.current) { toast(t('toastQrNotReady')); return; }
      if (Platform.OS === 'ios') {
        const permission = await PermissionsAndroid.request('ios.permission.PHOTO_LIBRARY_ADD_ONLY');
        if (permission === 'denied') { toast(t('toastNeedPhoto')); return; }
      }
      if (Platform.OS === 'android' && Platform.Version < 29) {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          toast(t('toastNeedStorage')); return;
        }
      }
      qrRef.current.toDataURL(async (base64Data) => {
        try {
          const tempPath = `${RNFS.CachesDirectoryPath}/${fname}`;
          await RNFS.writeFile(tempPath, base64Data, 'base64');
          await CameraRoll.save(tempPath, { type: 'photo' });
          await RNFS.unlink(tempPath).catch(() => {});
          toast(t('toastSaved'));
        } catch (writeError) {
          toast('' + (writeError?.message || writeError));
        }
      });
    } catch (error) {
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
  }, [selectedDevice, t]);

  const ListHeader = (
    <View style={{ paddingHorizontal: 16, paddingTop: 10 }}>
      <Text style={styles.deviceHeader}>{t('deviceName', headerName)}</Text>
      <Text style={styles.deviceSub}>{headerPortsText}</Text>
    </View>
  );

 const EmptyState = () => (
  <View style={styles.emptyWrap}>
    <View style={styles.emptyBadge}>
      <Icon name="energy" size={26} color="#2563EB" />
    </View>

    <Text style={styles.emptyTitle}>{t('noDevicesTitle')}</Text>
    <Text style={styles.emptyDesc}>{t('noDevicesDesc')}</Text>

    <View style={styles.emptyActions}>
      <TouchableOpacity
        onPress={() => onRefresh()}
        style={styles.emptyPrimaryBtn}
        activeOpacity={0.9}
      >
        <Icon name="refresh" size={18} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.emptyPrimaryText}>{t('tryAgain')}</Text>
      </TouchableOpacity>

      <View style={{ width: 10 }} />

      {/* <TouchableOpacity
        onPress={() => toast('Chức năng thêm thiết bị sẽ có ở màn Thiết bị')}
        style={styles.emptyGhostBtn}
        activeOpacity={0.9}
      >
        <Icon name="add" size={18} color="#2563EB" style={{ marginRight: 6 }} />
        <Text style={styles.emptyGhostText}>Thêm thiết bị</Text>
      </TouchableOpacity> */}
    </View>
  </View>
);


  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header} onLayout={(e)=> setHeaderHeight(e?.nativeEvent?.layout?.height || HEADER_DEFAULT_H)}>
        <TouchableOpacity style={styles.menuButton} onPress={openDrawer}>
          <Icon name="menu" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('headerTitle', headerName)}</Text>
      </View>

      {/* Drawer */}
      <View style={{zIndex:1000}}>
        <EdgeDrawer visible={drawerOpen} onClose={closeDrawer} topOffset={0}>
          <View style={styles.drawerHeader}>
  <View style={styles.drawerHeaderLeft}>
    <View style={styles.drawerBadge}>
      <Icon name="ev-station" size={16} color="#fff" />
    </View>
    <Text style={styles.drawerTitle}>{t('devices')}</Text>
  </View>

  {/* nút X close */}
  <TouchableOpacity
    onPress={closeDrawer}
    accessibilityLabel={t('close')}
    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
    style={styles.drawerCloseBtn}
    activeOpacity={0.8}
  >
    <Icon name="close" size={18} color="#6B7280" />
  </TouchableOpacity>
</View>

          <View style={{ height: 8 }} />
          <FlatList
            data={devicesMenu}
            keyExtractor={(x) => String(x.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  // clear “bóng ma” trước khi đổi id
                  baseDeviceRef.current = null;
                  setSelectedDevice(null);
                  setSelectedId(item.id);
                  closeDrawer();
                }}
                style={[styles.deviceMenuItem, selectedId === item.id && { borderColor: '#111827', backgroundColor: '#f7faff' }]}
              >
                <View style={styles.deviceMenuIcon}><Icon name="memory" size={16} color="#fff" /></View>
                <View>
                  <Text style={styles.deviceMenuName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.deviceMenuPorts}>{t('ports', item.portsCount)}</Text>
                </View>
                <Icon name="chevron-right" size={22} color="#9CA3AF" />
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
            contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 16 }}
            ListEmptyComponent={
              loadingList
                ? <Text style={{ color:'#6B7280', padding:16 }}>{t('loading')}</Text>
                : <Text style={{ color:'#6B7280', padding:16 }}>{t('noDevicesTitle')}</Text>
            }
            showsVerticalScrollIndicator={false}
          />
        </EdgeDrawer>
      </View>

      {/* Main list */}
      {/* Main list */}
<View style={{ flex: 1 }}>
  {showEmpty ? (
    <ScrollView
      contentContainerStyle={{
        paddingTop: headerHeight + 24,   // ⬅️ đẩy xuống dưới header
        paddingBottom: (BottomTabNavigation.TAB_BAR_HEIGHT || 72) + 24,
        flexGrow: 1,
      }}
      showsVerticalScrollIndicator={false}
    >
      <EmptyState />
    </ScrollView>
  ) : isLoadingPorts ? (
    <FlatList
      data={Array.from({ length: expectedPorts })}
      keyExtractor={(_, i) => `sk-${i}`}
      ListHeaderComponent={ListHeader}
      renderItem={() => <PortCardSkeleton />}
      ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
      contentContainerStyle={{
        paddingTop: headerHeight + 8,    // ⬅️ tránh đè header
        paddingBottom: 32,
      }}
      showsVerticalScrollIndicator={false}
      refreshing={refreshing}
      onRefresh={onRefresh}
    />
  ) : (
    <FlatList
      data={selectedDevice?.ports || []}
      keyExtractor={(p) => String(p.id)}
      ListHeaderComponent={ListHeader}
      renderItem={renderItem}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      contentContainerStyle={{
        paddingTop: headerHeight + 8,    // ⬅️ tránh đè header
        paddingBottom: (BottomTabNavigation.TAB_BAR_HEIGHT || 72) + 24,
      }}
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
            onRequestClose={handleClosePortModal}
          />
        ) : (
          <Pressable style={styles.modalOverlay} onPress={handleClosePortModal}>
            <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
              <ModalContent
                t={t}
                headerName={selectedDevice?.name || ''}
                modalPort={modalPort}
                buildCheckoutUrl={buildCheckoutUrl}
                openLink={openLink}
                saveQrPng={saveQrPng}
                qrRef={qrRef}
                onRequestClose={handleClosePortModal}
              />
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
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 1000,
  },

    /* ===== Empty state ===== */
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  emptyBadge: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#E8F1FF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 6 },
    elevation: 2,
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  emptyDesc: {
    marginTop: 6,
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    maxWidth: 420,
  },
  emptyActions: { flexDirection: 'row', marginTop: 14 },

  emptyPrimaryBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 120,
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  emptyPrimaryText: { color: '#fff', fontWeight: '800' },

  emptyGhostBtn: {
    borderWidth: 1,
    borderColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 140,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  emptyGhostText: { color: '#2563EB', fontWeight: '800' },

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

  drawerHeader: {
  paddingHorizontal: 16,
  paddingTop: 14,
  paddingBottom: 8,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between', // 👈 để canh X bên phải
},

drawerHeaderLeft: {
  flexDirection: 'row',
  alignItems: 'center',
  flexShrink: 1,
  gap: 8,
},
  drawerBadge: {
  width: 28,
  height: 28,
  borderRadius: 8,
  backgroundColor: '#4A90E2',
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 4,
},
  drawerTitle: { fontSize: 16, fontWeight: '800', color: '#111827' },

  drawerCloseBtn: {
  width: 32,
  height: 32,
  borderRadius: 16,
  backgroundColor: '#F3F4F6',
  alignItems: 'center',
  justifyContent: 'center',
  // nhẹ nhàng một tí bóng:
  shadowColor: '#000',
  shadowOpacity: 0.06,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 2,
},

  deviceHeader: { fontSize: 18, fontWeight: '800', color: '#111827' },
  deviceSub: { fontSize: 12, color: '#6B7280', marginTop: 2, marginBottom: 10 },

  portCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 3,
    marginBottom: 12,
    position: 'relative',
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
    top: 0, right: 0, bottom: 0, left: 0,
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
  height: 'auto',               
  maxHeight: '85%',
  overflow: 'hidden',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 10 },
  shadowOpacity: 0.25,
  shadowRadius: 20,
  elevation: 10,
  willChange: 'transform',      
},

  modalScroll: { flexGrow: 0 },
  modalScrollContent: { paddingBottom: 20 },
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
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  modalSubtitle: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  modalContent: { padding: 20 },
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
  modalInfoKey: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  modalInfoValue: { fontSize: 14, color: '#111827', fontWeight: '700' },

  // QR area
  qrWrap: { alignItems: 'center', marginTop: 5, width:'100%' },
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

  modalActions: { flexDirection: 'row', marginTop: 14, width:'100%', columnGap:10 },

  btnPrimary: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 14,
  },
  btnPrimaryText: { color: '#fff', fontWeight: '600', fontSize:14 },

  btnGhost: {
    borderWidth: 1, borderColor: '#2563EB', borderRadius: 12,
    paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    flex: 1,
    paddingHorizontal: 14,
  },
  btnGhostText: { color: '#2563EB', fontWeight: '600', fontSize:14 },
  modalCloseBtn: {
  width: 36,
  height: 36,
  borderRadius: 18,
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#F3F4F6',
  marginLeft: 10,
},

});
