// screens/Home/Extend.jsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, FlatList,
  KeyboardAvoidingView, Platform, TouchableWithoutFeedback, Modal,
  ToastAndroid, Alert, BackHandler, Linking
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';

import {
  getPaymentMethods,
  getExtendServiceCategories,
  createPaymentOrder,
} from '../../apis/payment';

/* ================= i18n ================= */
const LANG_KEY = 'app_language';
const STRINGS = {
  vi: {
    locale: 'vi-VN',
    currencySuffix: 'VNĐ',
    headerTitle: 'Tạo đơn hàng mới',
    deviceLabel: 'Thiết bị',
    pmLabel: 'Phương thức thanh toán',
    pmPlaceholder: 'Chọn phương thức thanh toán',
    packLabel: 'Gói dịch vụ',
    packPlaceholder: 'Chọn gói dịch vụ',
    priceLabelInline: 'Giá tiền',
    phoneLabel: 'Số điện thoại của quý khách',
    phonePlaceholder: 'Số điện thoại của quý khách',
    phoneHint: 'SĐT phải bắt đầu bằng 0 và 10–11 số.',
    bankName: 'Ngân hàng',
    bankAccount: 'Số tài khoản',
    accountName: 'Chủ tài khoản',
    branch: 'Chi nhánh',
    amount: 'Số tiền',
    transferNote: 'Nội dung',
    copied: 'Đã copy',
    ok: 'OK',
    agree: 'Đồng ý',
    error: 'Lỗi',
    createOrderFail: 'Tạo đơn thất bại',
    loadFail: 'Không lấy được dữ liệu thanh toán/gói dịch vụ',
    deviceIdMissing: 'Thiếu device_id (_id) truyền từ DeviceList.',
    bankFallback: 'Ngân hàng',
    and: '–',
    more: 'Xem thêm',
    less: 'Thu gọn',
  },
  en: {
    locale: 'en-US',
    currencySuffix: 'VND',
    headerTitle: 'Create new order',
    deviceLabel: 'Device',
    pmLabel: 'Payment method',
    pmPlaceholder: 'Choose a payment method',
    packLabel: 'Service package',
    packPlaceholder: 'Choose a service package',
    priceLabelInline: 'Price',
    phoneLabel: 'Your phone number',
    phonePlaceholder: 'Your phone number',
    phoneHint: 'Phone must start with 0 and be 10–11 digits.',
    bankName: 'Bank',
    bankAccount: 'Account number',
    accountName: 'Account holder',
    branch: 'Branch',
    amount: 'Amount',
    transferNote: 'Transfer note',
    copied: 'Copied',
    ok: 'OK',
    agree: 'Confirm',
    error: 'Error',
    createOrderFail: 'Failed to create order',
    loadFail: 'Unable to fetch payment/package data',
    deviceIdMissing: 'Missing device_id (_id) from DeviceList.',
    bankFallback: 'Bank',
    and: '–',
    more: 'More',
    less: 'Less',
  },
};
/* ======================================= */

/* ===== palette ===== */
const UI = {
  bg: '#F7F8FA',
  surface: '#FFFFFF',
  text: '#111827',
  muted: '#6B7280',
  border: '#E5E7EB',
  accent: '#2563EB',
  danger: '#DC2626',
  overlay: 'rgba(0,0,0,0.45)',
};

/* ===== Select với Modal overlay ngắn gọn ===== */
const Select = ({
  label, placeholder, valueText, open, setOpen,
  data, onSelect, renderItemText, anchorHeight = 44,
}) => {
  const anchorRef = useRef(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const id = setTimeout(() => {
      anchorRef.current?.measureInWindow?.((x, y, w) => {
        setMenuPos({ top: y + anchorHeight + 6, left: x, width: w });
      });
    }, 0);
    return () => clearTimeout(id);
  }, [open, anchorHeight]);

  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.label}>{label}</Text>

      <View ref={anchorRef} collapsable={false}>
        <TouchableOpacity
          style={[styles.selectInput, open && styles.selectOpen]}
          activeOpacity={0.8}
          onPress={() => setOpen(o => !o)}
        >
          <Text numberOfLines={1} style={[styles.selectText, valueText ? styles.selectTextValue : styles.placeholder]}>
            {valueText || placeholder}
          </Text>
          <Icon name={open ? 'expand-less' : 'expand-more'} size={20} color={UI.muted} />
        </TouchableOpacity>
      </View>

      <Modal transparent animationType="fade" visible={!!open} onRequestClose={() => setOpen(false)}>
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={[styles.dropdownOverlay, { top: menuPos.top, left: menuPos.left, width: menuPos.width }]}>
          <FlatList
            data={data}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => { onSelect(item); setOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={styles.optionText} numberOfLines={2}>
                  {renderItemText ? renderItemText(item) : item.name}
                </Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        </View>
      </Modal>
    </View>
  );
};
/* ========================================================== */

const mapMethods = (m) => ({
  id: m?.id,
  name: m?.name || m?.type || 'Phương thức',
  type: (m?.type || '').toLowerCase(), // bank | cash | momo | vnpay
  bankinfor: m?.bankinfor || [],
  raw: m,
});

const mapPacks = (p) => ({
  id: p?.id,
  name: p?.name,
  time: p?.time,
  price: p?.price,
  raw: p,
});

/* ===== constants ===== */
const ACCOUNT_HOLDER = 'CT Cổ phần Công nghệ Tiện ích Thông Minh';
const FIXED_BRANCH  = 'Chi nhánh Tân Bình, Hồ Chí Minh';

const Extend = ({ navigateToScreen, screenData, navigation }) => {
  // ===== i18n
  const [lang, setLang] = useState('vi');
  const L = useMemo(() => STRINGS[lang] || STRINGS.vi, [lang]);

  useEffect(() => { (async () => {
    try { const saved = await AsyncStorage.getItem(LANG_KEY); if (saved) setLang(saved); } catch {}
  })(); }, []);

  const formatVND = useCallback(
    (n) => `${Number(n || 0).toLocaleString(L.locale, { maximumFractionDigits: 0 })} ${L.currencySuffix}`,
    [L.locale, L.currencySuffix]
  );

  // ===== data thiết bị từ DeviceList
  const deviceRaw  = screenData?.device || null;
  const deviceId   = deviceRaw?._id || deviceRaw?.id || deviceRaw?.imei || '';
  const plate      = deviceRaw?.license_plate || deviceRaw?.imei || '';
  const deviceDisplay = useMemo(() => plate || deviceId, [plate, deviceId]);

  // UI state
  const [payOpen, setPayOpen]   = useState(false);
  const [packOpen, setPackOpen] = useState(false);

  // data
  const [methods, setMethods] = useState([]);
  const [packs, setPacks]     = useState([]);
  const [payment, setPayment] = useState(null);
  const [pack, setPack]       = useState(null);

  const [phone, setPhone]     = useState('');
  const [err, setErr]         = useState('');

  const validPhone = /^0\d{9,10}$/.test((phone || '').trim());
  const methodType = (payment?.type || '').toLowerCase();
  const bankInfo   = useMemo(() => (methodType === 'bank' ? (payment?.bankinfor?.[0] || null) : null), [methodType, payment]);
  const needBank   = !!bankInfo;
  const canSubmit  = !!(deviceId && payment && pack && validPhone);

  // Cache keys
  const K_METHODS = `extend_methods_${deviceId}`;
  const K_PACKS   = `extend_packs_${deviceId}`;

  // Load cache + fetch
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setErr('');
        if (!deviceId) { setErr(L.deviceIdMissing); return; }

        // Cache
        try {
          const [cm, cp] = await Promise.all([
            AsyncStorage.getItem(K_METHODS),
            AsyncStorage.getItem(K_PACKS),
          ]);
          const cachedM = cm ? JSON.parse(cm) : [];
          const cachedP = cp ? JSON.parse(cp) : [];
          if (alive) {
            if (cachedM?.length) setMethods(cachedM);
            if (cachedP?.length) setPacks(cachedP);
            if (cachedM?.length === 1) setPayment(cachedM[0]);
            if (cachedP?.length === 1) setPack(cachedP[0]);
          }
        } catch {}

        // Fetch
        const token = await AsyncStorage.getItem('access_token');
        const [mList, pList] = await Promise.all([
          getPaymentMethods({ accessToken: token, deviceId }),
          getExtendServiceCategories({ accessToken: token, deviceId }),
        ]);

        if (!alive) return;
        const shapedM = (mList || []).map(mapMethods);
        const shapedP = (pList || []).map(mapPacks);

        setMethods(shapedM);
        setPacks(shapedP);

        if (!payment && shapedM.length === 1) setPayment(shapedM[0]);
        if (!pack && shapedP.length === 1) setPack(shapedP[0]);

        await AsyncStorage.setItem(K_METHODS, JSON.stringify(shapedM));
        await AsyncStorage.setItem(K_PACKS,   JSON.stringify(shapedP));
      } catch (e) {
        if (!methods?.length && !packs?.length) setErr(e?.message || L.loadFail);
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, L.loadFail, L.deviceIdMissing]);

  const copy = (txt) => {
    try {
      Clipboard.setString(String(txt ?? ''));
      if (Platform.OS === 'android') ToastAndroid.show(L.copied, ToastAndroid.SHORT);
      else Alert.alert(L.copied);
    } catch {}
  };

  const genRequestId = () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let rand = '';
    for (let i = 0; i < 16; i++) rand += alphabet[Math.floor(Math.random() * alphabet.length)];
    return `momo_${Date.now()}_${rand}`;
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      const token      = await AsyncStorage.getItem('access_token');
      const methodType = (payment?.type || '').toLowerCase();
      const note       = `${plate}${phone ? ` - ${phone.trim()}` : ''}`;

      const payload = {
        packageID : pack.id,
        deviceID  : deviceId,
        methodID  : payment.id,
        note,
      };
      if (methodType === 'bank' && bankInfo?.id) payload.bankID = bankInfo.id;
      if (methodType === 'momo') payload.requestId = genRequestId();

      const orderMsg = await createPaymentOrder({ accessToken: token, ...payload });
      const srv = orderMsg?.msg ?? orderMsg ?? {};

      const orderPayload = {
        code      : `${srv.code ?? srv.orderId ?? orderMsg?.code ?? ''}`,
        name      : srv.name   ?? pack?.name,
        time      : srv.time   ?? pack?.time,
        price     : srv.price  ?? srv.amount ?? pack?.price,
        paymethod : srv.paymethod ?? payment?.name,
        methodType,
        plate,
        note,
        payUrl    : srv.payUrl    ?? orderMsg?.payUrl    ?? '',
        deeplink  : srv.deeplink  ?? orderMsg?.deeplink  ?? '',
        bank: methodType === 'bank' ? {
          name:  bankInfo?.name || bankInfo?.bankName,
          accountNumber: bankInfo?.accountNumber || bankInfo?.stk,
        } : undefined,
      };

      navigateToScreen('paymentConfirm', {
        order: orderPayload,
        device: { ...deviceRaw, deviceId },
      });

    } catch (e) {
      Alert.alert(L.error, e?.message || L.createOrderFail);
    }
  };

  /* ===== BACK HANDLERS (Android & iOS) ===== */
  const goDevice = useCallback(() => { navigateToScreen && navigateToScreen('Device'); }, [navigateToScreen]);

  const handleBackPress = useCallback(() => {
    if (payOpen || packOpen) {
      if (payOpen) setPayOpen(false);
      if (packOpen) setPackOpen(false);
      return true;
    }
    goDevice();
    return true;
  }, [payOpen, packOpen, goDevice]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => sub.remove();
  }, [handleBackPress]);

  useEffect(() => {
    if (!navigation || typeof navigation.addListener !== 'function') return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (payOpen || packOpen) {
        e.preventDefault();
        if (payOpen) setPayOpen(false);
        if (packOpen) setPackOpen(false);
        return;
      }
      e.preventDefault();
      goDevice();
    });
    return unsub;
  }, [navigation, payOpen, packOpen, goDevice]);

  const handleHeaderBack = () => {
    if (payOpen || packOpen) {
      if (payOpen) setPayOpen(false);
      if (packOpen) setPackOpen(false);
    } else {
      goDevice();
    }
  };

  const transferNote = `${plate}${phone ? ` - ${phone}` : ''}`;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: UI.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleHeaderBack} style={styles.iconBtn}>
          <Icon name="arrow-back" size={22} color={'#e5e7eb'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{L.headerTitle}</Text>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigateToScreen('notification', { from: 'extend', device: deviceRaw })}
        >
          <Icon name="notifications-none" size={26} color={'#e5e7eb'} />
        </TouchableOpacity>
      </View>

      {/* Body */}
      <View style={styles.body}>
        {!!err && <Text style={styles.errorText}>{err}</Text>}

        {/* Thiết bị */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>{L.deviceLabel}</Text>
          <View style={[styles.selectInput, { borderColor: UI.border }]}>
            <Text numberOfLines={1} style={[styles.selectText, styles.selectTextValue]}>{deviceDisplay || '—'}</Text>
          </View>
        </View>

        {/* Phương thức thanh toán */}
        <Select
          label={L.pmLabel}
          placeholder={L.pmPlaceholder}
          valueText={payment ? payment.name : ''}
          open={payOpen}
          setOpen={setPayOpen}
          data={methods}
          onSelect={setPayment}
          renderItemText={(it) => {
            if ((it.type || '').toLowerCase() === 'bank' && it.bankinfor?.length) {
              const b = it.bankinfor[0];
              return `${it.name} ${L.and} ${b?.name?.trim() || L.bankFallback}`;
            }
            return it.name;
          }}
        />

        {/* Gói dịch vụ */}
        <Select
          label={L.packLabel}
          placeholder={L.packPlaceholder}
          valueText={pack ? `${pack.name} - ${L.priceLabelInline}: ${formatVND(pack.price)}` : ''}
          open={packOpen}
          setOpen={setPackOpen}
          data={packs}
          onSelect={setPack}
          renderItemText={(it) => `${it.name} - ${L.priceLabelInline}: ${formatVND(it.price)}`}
        />

        {/* SĐT */}
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>{L.phoneLabel}</Text>
          <TextInput
            placeholder={L.phonePlaceholder}
            placeholderTextColor={UI.muted}
            style={styles.textInput}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
            maxLength={11}
          />
          {!validPhone && phone.length > 0 && (
            <Text style={styles.helperError}>{L.phoneHint}</Text>
          )}
        </View>

        {/* BANK info — COMPACT (copy-only) */}
        {needBank && (
          <View style={styles.bankCard}>
            <CompactRow
              label={L.bankName}
              value={bankInfo?.name || bankInfo?.bankName || L.bankFallback}
              onCopy={() => copy(bankInfo?.name || bankInfo?.bankName || '')}
            />
            <CompactRow
              label={L.bankAccount}
              value={bankInfo?.accountNumber || bankInfo?.stk || ''}
              onCopy={() => copy(bankInfo?.accountNumber || bankInfo?.stk || '')}
            />
            <CompactRow
              label={L.accountName}
              value={ACCOUNT_HOLDER}
              onCopy={() => copy(ACCOUNT_HOLDER)}
            />
            <CompactRow
              label={L.branch}
              value={FIXED_BRANCH}
              onCopy={() => copy(FIXED_BRANCH)}
            />
            <CompactRow
              label={L.amount}
              value={pack ? formatVND(pack.price) : '—'}
              onCopy={() => copy(pack ? `${pack.price}` : '')}
            />
            <CompactRow
              label={L.transferNote}
              value={transferNote}
              onCopy={() => copy(transferNote)}
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          activeOpacity={canSubmit ? 0.85 : 1}
          onPress={handleSubmit}
        >
          <Text style={styles.submitText}>{L.agree}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
};

const CompactRow = ({ label, value, onCopy }) => (
  <View style={styles.compactRow}>
    <Text style={styles.compactLabel}>{label}</Text>
    <View style={styles.compactValueWrap}>
      {/* KHÔNG giới hạn số dòng để tự xuống dòng khi dài */}
      <Text style={styles.compactValue}>{value || '—'}</Text>
      {!!onCopy && (
        <TouchableOpacity onPress={onCopy} style={styles.copyBtn} activeOpacity={0.7}>
          <Icon name="content-copy" size={16} color={UI.accent} />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

export default Extend;

/* =============================== Styles =============================== */
const styles = StyleSheet.create({
  /* header */
  header: {
    backgroundColor: '#1e88e5',
    paddingTop: 16,
    paddingBottom: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: UI.border,
  },
  iconBtn: { padding: 6 },
  headerTitle: {
    color: '#e5e7eb',
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    marginLeft: 4,
  },

  body: { paddingHorizontal: 14, paddingTop: 12, flex: 1 },

  fieldBlock: { marginBottom: 14 },
  label: { color: UI.muted, fontSize: 12.5, marginBottom: 6 },

  /* input/select */
  selectInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 10,
    backgroundColor: UI.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 8,
    paddingLeft: 10,
  },
  selectOpen: { borderColor: UI.accent },
  selectText: { fontSize: 15, paddingVertical: 8, color: UI.text, flex: 1 },
  selectTextValue: { color: UI.text },
  placeholder: { color: UI.muted },

  /* Modal overlay + dropdown */
  backdrop: { flex: 1, backgroundColor: UI.overlay },
  dropdownOverlay: {
    position: 'absolute',
    backgroundColor: UI.surface,
    borderRadius: 10,
    paddingVertical: 2,
    maxHeight: 260,
    elevation: 10,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    borderWidth: 1,
    borderColor: UI.border,
  },

  optionItem: { paddingVertical: 12, paddingHorizontal: 12 },
  optionText: { fontSize: 15, color: UI.text },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: UI.border },

  textInput: {
    height: 44,
    borderWidth: 1,
    borderColor: UI.border,
    borderRadius: 10,
    backgroundColor: UI.surface,
    fontSize: 15,
    color: UI.text,
    paddingHorizontal: 10,
  },
  helperError: { marginTop: 4, color: UI.danger, fontSize: 11.5 },

  /* bank card compact (copy-only) */
  bankCard: {
    borderRadius: 10,
    backgroundColor: UI.surface,
    borderWidth: 1,
    borderColor: UI.border,
  },
  compactRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  compactLabel: { width: 108, color: UI.muted, fontSize: 12, paddingTop: 1 },
  compactValueWrap: { flex: 1, flexDirection: 'row', alignItems: 'flex-start' },
  compactValue: { flex: 1, color: UI.text, fontSize: 13, fontWeight: '600', lineHeight: 17 },
  copyBtn: {
    marginLeft: 6,
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: UI.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: UI.surface,
  },

  submitBtn: {
    marginTop: 12,
    backgroundColor: UI.accent,
    height: 40,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: '#fff', fontSize: 15.5, fontWeight: '700', letterSpacing: 0.3 },

  errorText: { color: UI.danger, marginBottom: 8, fontSize: 13 },
});
