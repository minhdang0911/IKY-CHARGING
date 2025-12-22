// screens/Home/Extend.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, Linking, ActivityIndicator, Modal, BackHandler, PanResponder,
  Image, Animated, Easing, useWindowDimensions, ScrollView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import QRCode from 'react-native-qrcode-svg';
import QRCodeLib from 'qrcode';

import { getPublicPricingPlans, createOrder, createOrderCash } from '../../apis/payment';
import { getDevices } from '../../apis/devices';

// logos
import vietQRlogo from '../../assets/img/unnamed (1).png';
import momologo from '../../assets/img/momo.png';
import cashlogo from '../../assets/img/cash.png';

import vietQrFrame from '../../assets/img/template.png';

/* ================= THEME ================= */
const UI = {
  bg: '#F6F7FB',
  text: '#0F172A',
  sub: '#64748B',
  border: '#E5E7EB',
  accent: '#2563EB',
  surface: '#FFFFFF',
  good: '#16A34A',
};

const IDLE_STATES = ['idle', 'available', 'free', 'ready'];

/**
 * Frame template.png gốc 850x1100
 * Vùng QR: left=160, top=239, width=528, height=526
 */
const FRAME_BOX = {
  leftPct: 160 / 850,
  topPct: 239 / 1100,
  widthPct: 528 / 850,
  heightPct: 526 / 1100,
  padding: 8,
};

const QR_TTL_MS = 30 * 60 * 1000;
const QR_CACHE_KEY = 'vietqr_cache_v1';

/* ================= utils ================= */
const onlyMessage = (err) => {
  try {
    if (err?.response?.data?.message) return String(err.response.data.message);
    if (err?.data?.message) return String(err.data.message);
    if (typeof err?.message === 'string' && err.message) return err.message;
    if (typeof err === 'string') {
      const parsed = JSON.parse(err);
      if (parsed?.message) return String(parsed.message);
    }
    return 'Có lỗi xảy ra, thử lại sau.';
  } catch {
    return 'Có lỗi xảy ra, thử lại sau.';
  }
};

const parseExpDate = (expDateStr) => {
  if (!expDateStr) return null;
  const s = String(expDateStr);
  if (s.length < 10) return null;
  const yy = Number(s.slice(0, 2));
  const MM = Number(s.slice(2, 4));
  const dd = Number(s.slice(4, 6));
  const HH = Number(s.slice(6, 8));
  const mm = Number(s.slice(8, 10));
  if (![yy, MM, dd, HH, mm].every((n) => Number.isFinite(n))) return null;
  return new Date(2000 + yy, MM - 1, dd, HH, mm, 0);
};

const pad2 = (n) => String(n).padStart(2, '0');
const fmtDateTimeVN = (d) => {
  if (!(d instanceof Date) || isNaN(d.getTime())) return '';
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
};
const msToMMSS = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${pad2(m)}:${pad2(r)}`;
};

/* ============== Custom Alert ============== */
const CustomAlert = ({ visible, title = 'Thông báo', message = '', onClose }) => {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.alertBackdrop}>
        <View style={styles.alertBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Icon name="error-outline" size={20} color={UI.accent} />
            <Text style={styles.alertTitle}>{title}</Text>
          </View>
          <Text style={styles.alertMsg}>{message}</Text>
          <TouchableOpacity style={styles.alertBtn} onPress={onClose}>
            <Text style={styles.alertBtnText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

/* ============== CustomSelect ============== */
const CustomSelect = ({
  label,
  placeholder = 'Chọn…',
  options = [],
  value,
  onChange,
  getLabel = (x) => x?.label ?? '',
  keyExtractor = (x) => String(x?.id ?? x?.value),
  searchable = true,
  rightIcon = 'expand-more',
  disabled = false,
  renderValue,
  renderOption,
}) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  
  const filtered = useMemo(() => {
    if (!q) return options;
    const qq = q.toLowerCase();
    return options.filter((o) => getLabel(o)?.toLowerCase?.().includes(qq));
  }, [q, options, getLabel]);

  return (
    <View style={{ marginBottom: 10 }}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        disabled={disabled}
        onPress={() => setOpen(true)}
        activeOpacity={0.85}
        style={[styles.selectBox, disabled && { opacity: 0.6 }]}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          {value
            ? (renderValue ? renderValue(value) : <Text style={styles.selectText}>{getLabel(value)}</Text>)
            : <Text style={[styles.selectText, { color: UI.sub }]}>{placeholder}</Text>}
        </View>
        <Icon name={rightIcon} size={20} color={UI.sub} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label || 'Chọn'}</Text>
              <TouchableOpacity onPress={() => setOpen(false)}>
                <Icon name="close" size={22} color={UI.sub} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={filtered}
              keyExtractor={keyExtractor}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => {
                const isOn = keyExtractor(item) === keyExtractor(value || {});
                return (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={[styles.optionItem, isOn && { backgroundColor: '#F0F6FF' }]}
                    onPress={() => { onChange?.(item); setOpen(false); }}
                  >
                    {renderOption ? (
                      renderOption(item, isOn)
                    ) : (
                      <>
                        <Text style={[styles.optionText, isOn && { color: UI.accent, fontWeight: '700' }]}>
                          {getLabel(item)}
                        </Text>
                        {isOn && <Icon name="check" size={18} color={UI.accent} />}
                      </>
                    )}
                  </TouchableOpacity>
                );
              }}
              style={{ maxHeight: 420 }}
              ListEmptyComponent={
                <View style={{ padding: 16, alignItems: 'center' }}>
                  <Text style={{ color: UI.sub }}>Không có lựa chọn phù hợp</Text>
                </View>
              }
            />
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

/* ================= MAIN ================= */
export default function Extend({ navigateToScreen, screenData }) {
  const { width: winW } = useWindowDimensions();
  const isDesktop = winW >= 1024;

  const [device, setDevice] = useState(screenData?.device || {});
  const agentId = device?.agent_id?._id || '';
  const deviceId = device?._id || '';
  const ports = Array.isArray(device?.ports) ? device.ports : [];

  const [pricingPlans, setPricingPlans] = useState([]);
  const [planLoading, setPlanLoading] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedPort, setSelectedPort] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);

  const [creating, setCreating] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  const [showAlert, setShowAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  const navigatingRef = useRef(false);

  // ===== VietQR export/download =====
  const qrRef = useRef(null);
  const [frameLayout, setFrameLayout] = useState({ w: 0, h: 0 });

  // ===== VietQR "xem lại" cache =====
  const [cachedVietQrOrder, setCachedVietQrOrder] = useState(null);

  // countdown tick
  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (!orderSuccess || orderSuccess.method !== 'vietQR' || orderSuccess.isViewAgain) return;
    const t = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, [orderSuccess]);

  const qrBox = useMemo(() => {
    const w = frameLayout.w || 0;
    const h = frameLayout.h || 0;

    const boxW = w * FRAME_BOX.widthPct;
    const boxH = h * FRAME_BOX.heightPct;

    const size = Math.max(0, Math.min(boxW, boxH) - FRAME_BOX.padding * 2);

    const boxLeft = w * FRAME_BOX.leftPct;
    const boxTop = h * FRAME_BOX.topPct;

    const left = boxLeft + (boxW - size) / 2;
    const top = boxTop + (boxH - size) / 2;

    return { left, top, size };
  }, [frameLayout]);

  const goBack = useCallback(() => {
    setOrderSuccess(null);
  }, []);

  // Android hardware back
  useEffect(() => {
    const onHWBack = () => {
      goBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHWBack);
    return () => sub.remove();
  }, [goBack]);

  // iOS edge swipe
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e, g) => Platform.OS === 'ios' && g.x0 <= 20,
      onMoveShouldSetPanResponder: (e, g) =>
        Platform.OS === 'ios' && g.dx > 10 && Math.abs(g.dy) < 20,
      onPanResponderRelease: (e, g) => {
        if (Platform.OS === 'ios' && g.dx > 60) goBack();
      },
    })
  ).current;

  /* ===== REFRESH DEVICE ===== */
  const refreshDevice = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token || !deviceId) return;
      const data = await getDevices(token);
      const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      const fresh = list.find(d => (d?._id === deviceId) || (d?.device_code === device?.device_code));
      if (fresh) {
        setDevice(fresh);
        if (selectedPort) {
          const latestPort = (fresh.ports || []).find(p => String(p.portNumber) === String(selectedPort.portNumber));
          const latestStatus = String(latestPort?.status || '').toLowerCase();
          if (!IDLE_STATES.includes(latestStatus)) setSelectedPort(null);
        }
      }
    } catch { }
  }, [deviceId, device?.device_code, selectedPort]);

  useEffect(() => { refreshDevice(); }, [refreshDevice]);

  /* ===== OPTIONS ===== */
  const idlePortOptions = useMemo(
    () =>
      ports
        .filter((p) => IDLE_STATES.includes(String(p.status || '').toLowerCase()))
        .map((p) => ({ id: p._id, portNumber: p.portNumber, status: p.status })),
    [ports]
  );

  const paymentMethods = [
    { id: 'vietqr', name: 'VietQR', type: 'vietQR', icon: vietQRlogo },
    { id: 'momo', name: 'MoMo', type: 'momo', icon: momologo },
    { id: 'cash', name: 'Tiền mặt', type: 'cash', icon: cashlogo },
  ];

  /* ===== Load pricing plans ===== */
  const fetchPlans = useCallback(async () => {
    if (!agentId) return;
    try {
      setPlanLoading(true);
      const data = await getPublicPricingPlans(agentId);
      const list = Array.isArray(data) ? data : [];
      setPricingPlans(
        list.map((p) => ({
          id: p._id,
          name: p.name,
          price: p.price,
          raw: p,
        }))
      );
    } catch (e) {
      setAlertMsg(onlyMessage(e));
      setShowAlert(true);
    } finally {
      setPlanLoading(false);
    }
  }, [agentId]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const ensurePortStillIdle = useCallback(async (portNumber) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token || !deviceId) return true;
      const data = await getDevices(token);
      const list = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      const fresh = list.find(d => (d?._id === deviceId) || (d?.device_code === device?.device_code));
      const p = fresh?.ports?.find(pp => String(pp.portNumber) === String(portNumber));
      const st = String(p?.status || '').toLowerCase();
      return IDLE_STATES.includes(st);
    } catch {
      return true;
    }
  }, [deviceId, device?.device_code]);

  /* ===== Cache helpers ===== */
  const makeCacheKey = useCallback(() => {
    const deviceKey = device?._id || device?.device_code || '';
    const planKey = selectedPlan?.id || '';
    const portKey = selectedPort?.portNumber != null ? String(selectedPort.portNumber) : '';
    return `${deviceKey}|${planKey}|${portKey}`;
  }, [device, selectedPlan, selectedPort]);

  const loadCachedVietQr = useCallback(async () => {
    try {
      const key = makeCacheKey();
      if (!key || !selectedPayment || selectedPayment?.type !== 'vietQR') {
        setCachedVietQrOrder(null);
        return;
      }

      const raw = await AsyncStorage.getItem(QR_CACHE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      const hit = obj?.[key] || null;
      if (!hit) {
        setCachedVietQrOrder(null);
        return;
      }

      const expFromExpDate = parseExpDate(hit.expDate);
      const expMs = expFromExpDate?.getTime?.() || (Number(hit.createdAt || 0) + QR_TTL_MS);
      const ok = Date.now() < expMs;

      setCachedVietQrOrder(ok ? hit : null);

      if (!ok) {
        const next = { ...(obj || {}) };
        delete next[key];
        await AsyncStorage.setItem(QR_CACHE_KEY, JSON.stringify(next));
      }
    } catch {
      setCachedVietQrOrder(null);
    }
  }, [makeCacheKey, selectedPayment]);

  useEffect(() => {
    loadCachedVietQr();
  }, [loadCachedVietQr]);

  const saveCachedVietQr = useCallback(async (payload) => {
    try {
      const key = `${payload.deviceId || ''}|${payload.planId || ''}|${String(payload.portNumber ?? '')}`;
      const raw = await AsyncStorage.getItem(QR_CACHE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      obj[key] = payload;
      await AsyncStorage.setItem(QR_CACHE_KEY, JSON.stringify(obj));
    } catch { }
  }, []);

  /* ===== Download QR ===== */
  const downloadQrImage = useCallback(async () => {
    try {
      if (!orderSuccess?.qrData) {
        setAlertMsg('Thiếu dữ liệu QR để xuất ảnh.');
        setShowAlert(true);
        return;
      }

      // WEB: generate png dataURL
      if (Platform.OS === 'web') {
        const dataUrl = await QRCodeLib.toDataURL(orderSuccess.qrData, {
          width: 900,
          margin: 1,
          errorCorrectionLevel: 'M',
          type: 'image/png',
        });

        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `vietqr_${orderSuccess?.orderId || 'order'}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // Native
      if (!qrRef.current?.toDataURL) {
        setAlertMsg('Không thể export QR lúc này.');
        setShowAlert(true);
        return;
      }

      qrRef.current.toDataURL((data) => {
        const uri = `data:image/png;base64,${data}`;
        Linking.openURL(uri).catch(() => {
          setAlertMsg('Thiết bị không hỗ trợ tải trực tiếp. Cần tích hợp thư viện lưu ảnh.');
          setShowAlert(true);
        });
      });
    } catch (e) {
      setAlertMsg(e?.message || 'Tải ảnh thất bại.');
      setShowAlert(true);
    }
  }, [orderSuccess]);

  /* ===== Create Order ===== */
  const handleCreateOrder = useCallback(async () => {
    if (!selectedPlan || !selectedPort || !selectedPayment) {
      setAlertMsg('Chọn gói, cổng sạc và phương thức thanh toán trước đã.');
      setShowAlert(true);
      return;
    }

    const ok = await ensurePortStillIdle(selectedPort.portNumber);
    if (!ok) {
      setAlertMsg('Cổng vừa chuyển trạng thái. Vui lòng chọn lại cổng khác.');
      setShowAlert(true);
      await refreshDevice();
      return;
    }

    try {
      setCreating(true);
      const token = await AsyncStorage.getItem('access_token');

      const basePayload = {
        agent_id: device?.agent_id?._id || '',
        device_id: device?._id || '',
        pricing_plan_id: selectedPlan.id,
        portNumber: selectedPort.portNumber,
      };

      const method = selectedPayment.type; // momo | cash | vietQR
      const payload = { ...basePayload, payment_method: method };

      const api = method === 'cash' ? createOrderCash : createOrder;
      const res = await api(token, payload);

      const orderId = res?.orderId ?? res?.order_id ?? null;
      const paymentUrl = res?.paymentUrl ?? (method === 'momo' ? res?.data : null);
      const qrData = method === 'vietQR' ? (res?.data ?? null) : null;
      const amount = res?.amount ?? selectedPlan?.raw?.price ?? selectedPlan?.price ?? 0;

      const next = {
        orderId,
        paymentUrl,
        qrData,
        method,
        planName: selectedPlan?.raw?.name ?? selectedPlan?.name,
        amount,
        portNumber: selectedPort?.portNumber,
        deviceName: device?.name || '',
        deviceCode: device?.device_code || '',
        expDate: res?.expDate || null,
        createdAt: res?.createdAt || Date.now(),
        isViewAgain: false,
      };

      setOrderSuccess(next);

      if (method === 'vietQR') {
        await saveCachedVietQr({
          deviceId: device?._id || device?.device_code || '',
          planId: selectedPlan?.id || '',
          portNumber: selectedPort?.portNumber,
          orderId: next.orderId,
          qrData: next.qrData,
          expDate: next.expDate,
          createdAt: next.createdAt,
        });
        await loadCachedVietQr();
      }
    } catch (err) {
      setAlertMsg(onlyMessage(err));
      setShowAlert(true);
    } finally {
      setCreating(false);
    }
  }, [selectedPlan, selectedPort, selectedPayment, device, ensurePortStillIdle, refreshDevice, saveCachedVietQr, loadCachedVietQr]);

  /* =================== SUCCESS SCREENS =================== */
  if (orderSuccess) {
    if (orderSuccess.method === 'vietQR') {
      // ✅ giảm padding + tránh che nút
      const outerPadding = isDesktop ? 12 : 10;

      // ✅ giảm height khung để lộ 2 nút
      const frameW = Math.min(520, Math.max(300, winW * (isDesktop ? 0.40 : 0.76)));
      const rawH = frameW * (1100 / 850);
      const frameH = Math.min(rawH, isDesktop ? 520 : 440); // ✅ giảm

      // exp info (chỉ show khi vừa tạo, không show khi xem lại)
      const expDt = parseExpDate(orderSuccess.expDate);
      const expMs = expDt?.getTime?.() || (Number(orderSuccess.createdAt || 0) + QR_TTL_MS);
      const remainMs = expMs - nowTick;
      const expired = remainMs <= 0;

      const isViewAgain = !!orderSuccess.isViewAgain;

      return (
        <View style={[styles.container, { padding: outerPadding }]}>
          <ScrollView
            contentContainerStyle={{
              alignItems: 'center',
              paddingBottom: 110, // ✅ chừa chỗ cho bottom nav, không che 2 nút
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.successOnlyWrap, { padding: isDesktop ? 14 : 12 }]}>
              {/* ✅ Nếu xem lại: CHỈ hiện QR + 2 nút */}
              {!isViewAgain ? (
                <>
                 <View style={styles.successBadge}>

                    <Icon name="check" size={30} color="#fff" />
                  </View>
                  <Text style={styles.successTitle}>Tạo đơn thành công!</Text>
                  <Text style={styles.successSubtitle}>Vui lòng quét QR để thanh toán.</Text>
                </>
              ) : null}

              <View style={{ marginTop: isViewAgain ? 6 : 12, alignItems: 'center' }}>
                <View
                  style={[styles.vietqrFrameWrap, { width: frameW, height: frameH }]}
                  onLayout={(e) => {
                    const { width: w, height: h } = e.nativeEvent.layout;
                    setFrameLayout({ w, h });
                  }}
                >
                  <Image source={vietQrFrame} style={styles.vietqrFrameImg} resizeMode="contain" />
                  <View
                    style={[
                      styles.vietqrQrOverlayAbs,
                      { left: qrBox.left, top: qrBox.top, width: qrBox.size, height: qrBox.size }
                    ]}
                  >
                    <QRCode
                      value={orderSuccess.qrData || ''}
                      size={Math.max(0, qrBox.size)}
                      ecl="M"
                      getRef={(c) => (qrRef.current = c)}
                    />
                  </View>
                </View>

                {/* ✅ note chỉ hiện khi vừa tạo đơn, không hiện khi xem lại */}
                {!isViewAgain ? (
                  <View style={styles.qrNoteWrap}>
                    <Text style={styles.qrNoteText}>
                      Mã QR này sẽ hết hạn sau <Text style={{ fontWeight: '800' }}>30 phút</Text>.
                    </Text>
                    <Text style={styles.qrNoteText}>
                      Hết hạn lúc: <Text style={{ fontWeight: '800' }}>{expDt ? fmtDateTimeVN(expDt) : '—'}</Text>
                      {expired ? <Text style={{ fontWeight: '900', color: '#DC2626' }}> (đã hết hạn)</Text> : null}
                    </Text>
                    {!expired ? (
                      <Text style={styles.qrCountdown}>Còn lại: {msToMMSS(remainMs)}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>

              <View style={[styles.actionRow, { marginTop: 14, marginBottom: 6 }]}>
                <TouchableOpacity style={[styles.btnGhost, { flex: 1 }]} onPress={goBack}>
                  <Text style={[styles.btnGhostText, { fontSize: 30 }]}>{'‹'}</Text>
                  <Text style={styles.btnGhostText}>Quay lại</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnPrimary, { flex: 1 }, (!isViewAgain && expired) && { opacity: 0.6 }]}
                  onPress={downloadQrImage}
                  disabled={!isViewAgain && expired}
                >
                  <Icon name="download" size={18} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.btnText}>Tải ảnh</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          <CustomAlert visible={showAlert} message={alertMsg} onClose={() => setShowAlert(false)} />
        </View>
      );
    }

    // ===== momo / cash success giữ như cũ =====
    const payBtnLabel =
      orderSuccess.method === 'momo' ? 'Thanh toán MoMo' : 'Đã nhận tiền mặt';

    const canOpen = !!orderSuccess.paymentUrl && orderSuccess.method === 'momo';

    return (
      <View style={[styles.container, { padding: 16, justifyContent: 'center' }]}>
        <View style={styles.successWrap}>
         <View style={styles.successBadge}>

            <Icon name="check" size={30} color="#fff" />
          </View>

          <Text style={styles.successTitle}>Tạo đơn thành công!</Text>
          <Text style={styles.successSubtitle}>
            {orderSuccess.method === 'cash'
              ? 'Đã ghi nhận thanh toán tiền mặt.'
              : 'Đơn hàng MoMo đã tạo.'}
          </Text>

          <View style={styles.successInfoCard}>
            <Row k="Thiết bị" v={orderSuccess.deviceName || '—'} />
            <Row k="Cổng" v={orderSuccess.portNumber} />
            <Row k="Gói" v={orderSuccess.planName} />
            <Row
              k="Số tiền"
              v={<Text style={{ fontWeight: '800' }}>
                {Number(orderSuccess.amount || 0).toLocaleString('vi-VN')}đ
              </Text>}
            />
          </View>

          {canOpen ? (
            <TouchableOpacity
              style={[styles.btn, styles.ctaBtn]}
              onPress={() => Linking.openURL(orderSuccess.paymentUrl)}
            >
            
              <Text style={styles.btnText}>{payBtnLabel}</Text>
            </TouchableOpacity>
          ) : (
            <Text style={{ color: UI.sub, textAlign: 'center', marginTop: 12 }}>
              Phương thức: {payBtnLabel}
            </Text>
          )}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <TouchableOpacity
              style={[styles.btnGhost, { flex: 1 }]}
              onPress={() => navigateToScreen('historyExtend')}
            >
              <Text style={styles.btnGhostText}>Xem lịch sử đơn hàng</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnGhost, { flex: 1 }]}
              onPress={async () => {
                setOrderSuccess(null);
                setSelectedPlan(null);
                setSelectedPort(null);
                setSelectedPayment(null);
                await refreshDevice();
              }}
            >
              <Text style={styles.btnGhostText}>Tạo đơn khác</Text>
            </TouchableOpacity>
          </View>
        </View>

        <CustomAlert visible={showAlert} message={alertMsg} onClose={() => setShowAlert(false)} />
      </View>
    );
  }

  /* =================== MAIN FORM =================== */
  const showViewAgainBtn =
    selectedPayment?.type === 'vietQR' &&
    !!selectedPlan &&
    !!selectedPort &&
    !!cachedVietQrOrder &&
    !!cachedVietQrOrder.qrData;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: UI.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      {...(Platform.OS === 'ios' ? panResponder.panHandlers : {})}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={{ padding: 6 }}>
          <Text style={{ fontSize: 30, color: '#fff' }}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Tạo đơn hàng</Text>
        <TouchableOpacity onPress={refreshDevice} style={{ padding: 6 }}>
          <Icon name="refresh" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={{ padding: 16, flex: 1 }}>
        {/* Device */}
        <View style={styles.deviceBar}>
          <Text style={styles.deviceText} numberOfLines={1} ellipsizeMode="tail">
            {device?.name || 'Thiết bị'}
          </Text>
        </View>

        <View style={{ marginTop: 10 }}>
          <View style={[styles.grid, isDesktop && styles.gridDesktop]}>
            <View style={styles.col}>
              <CustomSelect
                label="Gói dịch vụ"
                placeholder={planLoading ? 'Đang tải…' : 'Chọn gói dịch vụ'}
                options={pricingPlans}
                value={selectedPlan}
                onChange={setSelectedPlan}
                getLabel={(it) =>
                  it ? `${it.raw?.name ?? it.name} — ${Number(it.raw?.price ?? it.price).toLocaleString('vi-VN')}đ` : ''
                }
                keyExtractor={(it) => String(it?.id)}
                searchable
                disabled={planLoading}
              />
            </View>

            <View style={styles.col}>
              <CustomSelect
                label="Cổng sạc"
                placeholder="Chọn cổng còn trống"
                options={idlePortOptions}
                value={selectedPort}
                onChange={setSelectedPort}
                getLabel={(it) => (it ? `Cổng ${it.portNumber}` : '')}
                keyExtractor={(it) => String(it?.id)}
              />
            </View>

            <View style={styles.col}>
              <CustomSelect
                label="Phương thức thanh toán"
                placeholder="Chọn phương thức"
                options={['vietqr', 'momo', 'cash'].map(id => paymentMethods.find(p => p.id === id))}
                value={selectedPayment}
                onChange={setSelectedPayment}
                getLabel={(it) => it?.name || ''}
                keyExtractor={(it) => String(it?.id)}
                searchable={false}
                rightIcon="payments"
                renderValue={(it) => (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Image source={it.icon} style={{ width: 20, height: 20, borderRadius: 4, marginRight: 8 }} />
                    <Text style={styles.selectText}>{it.name}</Text>
                  </View>
                )}
                renderOption={(it, isOn) => (
                  <>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <Image source={it.icon} style={{ width: 22, height: 22, borderRadius: 6, marginRight: 10 }} />
                      <Text style={[styles.optionText, isOn && { color: UI.accent, fontWeight: '700' }]}>{it.name}</Text>
                    </View>
                    {isOn && <Icon name="check" size={18} color={UI.accent} />}
                  </>
                )}
              />
            </View>
          </View>

          <View style={{ marginTop: 10, alignItems: 'center' }}>
            <TouchableOpacity
              style={[
                styles.btn, styles.btnNarrow,
                (!selectedPlan || !selectedPort || !selectedPayment || creating) && { opacity: 0.5 },
              ]}
              disabled={!selectedPlan || !selectedPort || !selectedPayment || creating}
              onPress={handleCreateOrder}
              activeOpacity={0.9}
            >
              {creating ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Tạo đơn hàng</Text>}
            </TouchableOpacity>

            {/* ✅ Xem lại (mở màn QR minimal: chỉ QR + 2 nút) */}
            {showViewAgainBtn ? (
              <TouchableOpacity
                style={[styles.btnGhostSmall, { marginTop: 10 }]}
                activeOpacity={0.9}
                onPress={() => {
                  setOrderSuccess({
                    method: 'vietQR',
                    isViewAgain: true, // ✅ minimal UI
                    orderId: cachedVietQrOrder.orderId,
                    qrData: cachedVietQrOrder.qrData,
                    expDate: cachedVietQrOrder.expDate,
                    createdAt: cachedVietQrOrder.createdAt,
                  });
                }}
              >
 
                <Text style={styles.btnGhostSmallText}>Xem lại mã QR</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>

      <CustomAlert visible={showAlert} message={alertMsg} onClose={() => setShowAlert(false)} />
    </KeyboardAvoidingView>
  );
}

/* ============== tiny row ============== */
const Row = ({ k, v }) => (
  <View style={styles.summaryRow}>
    <Text style={styles.summaryKey}>{k}</Text>
    {typeof v === 'string' || typeof v === 'number' ? (
      <Text style={styles.summaryVal}>{v}</Text>
    ) : (
      v
    )}
  </View>
);

/* ===================== Styles ===================== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: UI.bg },

  header: {
    backgroundColor: UI.accent,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTitle: { textAlign: 'center', color: '#fff', fontSize: 18, fontWeight: '800' },

  label: { fontSize: 12.5, color: UI.sub, marginBottom: 4 },
  selectBox: {
    borderWidth: 1, borderColor: UI.border, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: UI.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectText: { fontSize: 14.5, color: UI.text },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    backgroundColor: UI.surface,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    width: '92%',
    maxWidth: 420,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontWeight: '800', color: UI.text, fontSize: 16 },

  separator: { height: 1, backgroundColor: UI.border },
  optionItem: { paddingVertical: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { fontSize: 15, color: UI.text },

  deviceBar: {
    backgroundColor: UI.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: UI.border,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deviceText: { marginLeft: 8, color: UI.text, fontWeight: '600' },

  grid: { gap: 10 },
  gridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  col: { flexBasis: '100%', flexGrow: 1, minWidth: 260 },

  btn: { backgroundColor: UI.accent, paddingVertical: 10, borderRadius: 12, paddingHorizontal: 18 },
  btnNarrow: { minWidth: 240, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center' },

  btnGhostSmall: {
    borderWidth: 1,
    borderColor: UI.accent,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 240,
    backgroundColor: '#fff',
  },
  btnGhostSmallText: { color: UI.accent, fontWeight: '800' },

  successWrap: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E7EEF9',
  },
  successBadge: {
    alignSelf: 'center',
    width: 74, height: 74, borderRadius: 37,
    backgroundColor: '#22C55E',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#22C55E',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 6,
  },
  successTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 10, color: '#111827' },
  successSubtitle: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 4 },

  successInfoCard: {
    marginTop: 14,
    backgroundColor: '#F8FAFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E6EEF9',
    padding: 12,
  },
  ctaBtn: { marginTop: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },

  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  summaryKey: { color: UI.sub },
  summaryVal: { color: UI.text, fontWeight: '600' },

  btnGhost: {
    borderWidth: 1, borderColor: UI.accent, borderRadius: 12, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 1
  },
  btnGhostText: { color: UI.accent, fontWeight: '700', fontSize: 14 },

  // ===== VietQR UI =====
  successOnlyWrap: {
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E7EEF9',
    alignItems: 'center',
    width: '100%',
    maxWidth: 760,
  },
  vietqrFrameWrap: { position: 'relative' },
  vietqrFrameImg: { width: '100%', height: '100%' },
  vietqrQrOverlayAbs: { position: 'absolute', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },

  qrNoteWrap: { marginTop: 8, alignItems: 'center' },
  qrNoteText: { fontSize: 12.5, color: UI.sub, textAlign: 'center', lineHeight: 18 },
  qrCountdown: { marginTop: 4, fontSize: 13, fontWeight: '900', color: UI.text },

  actionRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: 2,
  },
  btnPrimary: {
    backgroundColor: UI.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Alert
  alertBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  alertBox: {
    width: '88%',
    maxWidth: 420,
    backgroundColor: UI.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: UI.border,
  },
  alertTitle: { marginLeft: 8, fontSize: 16, fontWeight: '800', color: UI.text },
  alertMsg: { marginTop: 6, fontSize: 14, color: UI.text },
  alertBtn: {
    alignSelf: 'center',
    marginTop: 14,
    backgroundColor: UI.accent,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    minWidth: 90,
  },
  alertBtnText: { color: '#fff', fontWeight: '700', textAlign: 'center' },
});
