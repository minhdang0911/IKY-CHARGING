// screens/Home/Extend.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, KeyboardAvoidingView,
  Platform, TextInput, Linking, ActivityIndicator, Modal, BackHandler, PanResponder,
  Image, Animated, Easing, useWindowDimensions
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { getPublicPricingPlans, createOrder, createOrderCash } from '../../apis/payment';
import { getDevices } from '../../apis/devices';

// logos
import momologo from '../../assets/img/momo.png';
import vnpaylogo from '../../assets/img/vnpay.jpg';
import cashlogo from '../../assets/img/cash.png';

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

// Chỉ coi là rảnh khi thuộc nhóm này
const IDLE_STATES = ['idle', 'available', 'free', 'ready'];

/* ================= Small utils ================= */
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

/* ============== Reusable Custom Select (centered modal) ============== */
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

      {/* CENTERED DIALOG */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setOpen(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ width: '100%' }}>
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
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

/* ================= MAIN ================= */
export default function Extend({ navigateToScreen, screenData }) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // biến device thành state để có thể cập nhật realtime
  const [device, setDevice] = useState(screenData?.device || {});
  const agentId = device?.agent_id?._id || '';
  const deviceId = device?._id || '';
  const ports = Array.isArray(device?.ports) ? device.ports : [];

  const [pricingPlans, setPricingPlans] = useState([]);
  const [planLoading, setPlanLoading] = useState(false);

  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedPort, setSelectedPort] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [phone, setPhone] = useState('');

  const [creating, setCreating] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);

  // custom alert state
  const [showAlert, setShowAlert] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');

  const navigatingRef = useRef(false);

  // animation badge success
  const successPulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(successPulse, { toValue: 1.08, duration: 650, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(successPulse, { toValue: 1, duration: 650, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [successPulse]);

  const goBack = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;
    try {
      navigateToScreen?.('Device');
    } finally {
      setTimeout(() => { navigatingRef.current = false; }, 300);
    }
  }, [navigateToScreen]);

  // ANDROID: back cứng -> chỉ back trang
  useEffect(() => {
    const onHWBack = () => {
      goBack();
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onHWBack);
    return () => sub.remove();
  }, [goBack]);

  // ✅ WEB: chặn nút Back của trình duyệt -> quay về Device
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    // Tuỳ app của m: giữ nguyên root hoặc route hiện tại
    const TARGET_PATH = '/';
    // Ghim URL hiện tại về TARGET_PATH để khi back không rời app
    window.history.replaceState(null, '', TARGET_PATH);

    const handlePopState = () => {
      // giữ URL cố định & điều hướng nội bộ
      window.history.replaceState(null, '', TARGET_PATH);
      goBack();
    };

    // đẩy thêm một state để bắt popstate
    window.history.pushState(null, '', TARGET_PATH);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [goBack]);

  // iOS: edge swipe từ mép trái để back
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
    } catch {}
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
    { id: 'momo', name: 'MoMo', type: 'momo', icon: momologo },
    { id: 'vnpay', name: 'VNPay', type: 'vnpay', icon: vnpaylogo },
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
      const msg = onlyMessage(e);
      setAlertMsg(msg);
      setShowAlert(true);
    } finally {
      setPlanLoading(false);
    }
  }, [agentId]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  /* ===== Validate port before create ===== */
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
        ...(phone ? { phone } : {}),
      };

      const method = selectedPayment.type;
      const payload = { ...basePayload, payment_method: method };
      const api = method === 'momo' ? createOrder : createOrderCash;

      const res = await api(token, payload);

      const orderId    = res?.orderId    ?? res?.order_id   ?? null;
      const paymentUrl = res?.paymentUrl ?? res?.data       ?? null;
      const amount     = res?.amount     ?? selectedPlan?.raw?.price
                                      ?? selectedPlan?.price ?? 0;

      setOrderSuccess({
        orderId,
        paymentUrl,
        method,
        planName: selectedPlan?.raw?.name ?? selectedPlan?.name,
        amount,
        portNumber: selectedPort?.portNumber,
        deviceName: device?.name || '',
        deviceCode: device?.device_code || '',
        expDate: res?.expDate || null,
        createdAt: res?.createdAt || null,
      });
    } catch (err) {
      setAlertMsg(onlyMessage(err));
      setShowAlert(true);
    } finally {
      setCreating(false);
    }
  }, [selectedPlan, selectedPort, selectedPayment, phone, device, ensurePortStillIdle, refreshDevice]);

  /* ===== Success Screen ===== */
  if (orderSuccess) {
    const payBtnLabel =
      orderSuccess.method === 'momo'
        ? 'Thanh toán MoMo'
        : orderSuccess.method === 'vnpay'
        ? 'Thanh toán VNPay'
        : 'Đã nhận tiền mặt';
    const canOpen =
      !!orderSuccess.paymentUrl &&
      (orderSuccess.method === 'momo' || orderSuccess.method === 'vnpay');

    return (
      <View style={[styles.container, { padding: 16, justifyContent: 'center' }]}>
        <View style={styles.successWrap}>
          <Animated.View style={[styles.successBadge, { transform: [{ scale: successPulse }] }]}>
            <Icon name="check" size={30} color="#fff" />
          </Animated.View>

          <Text style={styles.successTitle}>Tạo đơn thành công!</Text>
          <Text style={styles.successSubtitle}>
            {orderSuccess.method === 'cash'
              ? 'Đã ghi nhận thanh toán tiền mặt.'
              : (orderSuccess.method === 'vnpay'
                  ? 'Đơn hàng VNPay đã sẵn sàng.'
                  : 'Đơn hàng MoMo đã tạo.')}
          </Text>

          {orderSuccess.method === 'momo' && (
            <View style={styles.successInfoCard}>
              <Row k="Mã đơn" v={orderSuccess.orderId || '—'} />
            </View>
          )}

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
              <Icon name="open-in-new" size={18} color="#fff" style={{ marginRight: 8 }} />
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

        <CustomAlert
          visible={showAlert}
          message={alertMsg}
          onClose={() => setShowAlert(false)}
        />
      </View>
    );
  }

  /* ===== Main Form ===== */
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: UI.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      {...(Platform.OS === 'ios' ? panResponder.panHandlers : {})}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={{ padding: 6 }}>
          <Text style={{fontSize: 30, color: '#fff'}}>{'‹'}</Text>
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

        {/* Selects: GRID */}
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
                options={['momo','vnpay','cash'].map(id => paymentMethods.find(p => p.id === id))}
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

          {/* Button gọn */}
          <View style={{ marginTop: 4, alignItems: 'center' }}>
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
          </View>
        </View>
      </View>

      <CustomAlert
        visible={showAlert}
        message={alertMsg}
        onClose={() => setShowAlert(false)}
      />
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

  // compact labels & selects
  label: { fontSize: 12.5, color: UI.sub, marginBottom: 4 },
  selectBox: {
    borderWidth: 1, borderColor: UI.border, borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: UI.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  selectText: { fontSize: 14.5, color: UI.text },

  // centered modal
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
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8
  },
  sheetTitle: { fontWeight: '800', color: UI.text, fontSize: 16 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: UI.border, backgroundColor: '#F8FAFC',
    borderRadius: 10, paddingHorizontal: 10, height: 38, marginBottom: 8
  },
  searchInput: { flex: 1, color: UI.text },

  separator: { height: 1, backgroundColor: UI.border },
  optionItem: {
    paddingVertical: 10, paddingHorizontal: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'
  },
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

  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: UI.border, backgroundColor: UI.surface,
    borderRadius: 10, paddingHorizontal: 10, height: 42
  },
  input: { flex: 1, color: UI.text },

  // GRID compact
  grid: { gap: 10 },
  gridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  col: { flexBasis: '100%', flexGrow: 1, minWidth: 260 },

  btn: {
    backgroundColor: UI.accent,
    paddingVertical: 10, borderRadius: 12,
    paddingHorizontal: 18,
  },
  btnNarrow: { minWidth: 240, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800', textAlign: 'center' },

  // Success screen
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
  successTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 12, color: '#111827' },
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
  btnGhostText: { color: UI.accent, fontWeight: '500', fontSize: 12 },

  // CustomAlert styles
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
