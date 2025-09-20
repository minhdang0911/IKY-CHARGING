// screens/Home/PaymentConfirm.jsx
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  Linking, Alert, ScrollView, Platform, ToastAndroid, Dimensions
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Clipboard from '@react-native-clipboard/clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOrderStatusPolling } from '../../Hooks/useOrderStatusPolling';

const backgroundMomo  = require('../../assets/img/ic_momo_confirm.png');
const backgroundVNPAY = require('../../assets/img/vnpay_logo.png');

const LANG_KEY = 'app_language';
const STRINGS = {
  vi: {
    locale: 'vi-VN',
    currencySuffix: 'VNĐ',
    copied: 'Đã copy',
    ok: 'OK',
    errorOpenLink: 'Không mở được liên kết',
    tryAgain: 'Vui lòng thử lại.',
    orderDetail: 'Chi tiết đơn hàng',
    successCreate: 'Tạo đơn hàng thành công',
    successPaid: 'Thành công.',
    pending: 'Chờ duyệt',
    cashAtOffice: 'Tiền mặt tại văn phòng',
    bankTransfer: 'Chuyển khoản',
    close: 'Đóng',
    cancel: 'Bỏ qua',
    orderCode: 'Mã đơn hàng',
    plate: 'Biển số xe',
    packageName: 'Gói dịch vụ',
    time: 'Thời gian',
    months: 'tháng',
    price: 'Giá tiền',
    status: 'Trạng thái',
    payment: 'Thanh toán',
    bankInfoTitle: 'Thông tin chuyển khoản',
    bankName: 'Ngân hàng',
    bankAccount: 'Số tài khoản',
    bankOwner: 'Chủ tài khoản',
    bankBranch: 'Chi nhánh',
    amount: 'Số tiền',
    transferNote: 'Nội dung',
    vnpayTitle: 'Xác nhận thanh toán',
    continue: 'Tiếp tục',
    momoTitle: 'Xác nhận thanh toán MoMo',
    openMomo: 'MỞ ỨNG DỤNG MOMO',
    scanQr: 'QUÉT MÃ QR',
    cancelUpper: 'HỦY',
  },
  en: {
    locale: 'en-US',
    currencySuffix: 'VND',
    copied: 'Copied',
    ok: 'OK',
    errorOpenLink: 'Cannot open the link',
    tryAgain: 'Please try again.',
    orderDetail: 'Order details',
    successCreate: 'Order created successfully',
    successPaid: 'Success.',
    pending: 'Pending approval',
    cashAtOffice: 'Cash at office',
    bankTransfer: 'Bank transfer',
    close: 'Close',
    cancel: 'Skip',
    orderCode: 'Order code',
    plate: 'License plate',
    packageName: 'Service package',
    time: 'Duration',
    months: 'months',
    price: 'Price',
    status: 'Status',
    payment: 'Payment',
    bankInfoTitle: 'Bank transfer details',
    bankName: 'Bank',
    bankAccount: 'Account number',
    bankOwner: 'Account holder',
    bankBranch: 'Branch',
    amount: 'Amount',
    transferNote: 'Transfer note',
    vnpayTitle: 'Payment confirmation',
    continue: 'Continue',
    momoTitle: 'MoMo payment confirmation',
    openMomo: 'OPEN MOMO APP',
    scanQr: 'SCAN QR',
    cancelUpper: 'CANCEL',
  },
};

const ZALO_PHONE = '0902 806 999';

const PaidScreen = ({ L, info, onClose, formatCurrency }) => (
  <View style={{ flex: 1, backgroundColor: '#fff' }}>
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{L.orderDetail}</Text>
      <View style={{ width: 40 }} />
    </View>

    <ScrollView contentContainerStyle={styles.body}>
      <View style={styles.successIcon}>
        <Icon name="check" size={40} color="#4A90E2" />
      </View>
      <Text style={styles.successTitle}>{L.successPaid}</Text>
      <Text style={styles.successTime}>{new Date(info.paidAt).toLocaleString(L.locale)}</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>{L.orderCode}:</Text>
          <Text style={styles.value}>{info.code}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{L.packageName}:</Text>
          <Text style={styles.value}>{info.name}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{L.payment}:</Text>
          <Text style={styles.value}>{info.method}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{L.amount}:</Text>
          <Text style={styles.value}>{formatCurrency(info.price)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>{L.status}:</Text>
          <Text style={[styles.value, { color: '#2E7D32' }]}>{L.successPaid}</Text>
        </View>
      </View>

      <TouchableOpacity style={[styles.defaultBtn, styles.defaultBtnBlue]} onPress={onClose}>
        <Text style={styles.defaultBtnText}>{L.close}</Text>
      </TouchableOpacity>
    </ScrollView>
  </View>
);

const PaymentConfirm = ({ navigateToScreen, screenData }) => {
  const [lang, setLang] = useState('vi');
  const L = useMemo(() => STRINGS[lang] || STRINGS.vi, [lang]);

  useEffect(() => { (async () => {
    try { const saved = await AsyncStorage.getItem(LANG_KEY); if (saved) setLang(saved); } catch {}
  })(); }, []);

  const formatCurrency = useCallback(
    (n) => `${Number(n || 0).toLocaleString(L.locale, { maximumFractionDigits: 0 })} ${L.currencySuffix}`,
    [L.locale, L.currencySuffix]
  );

  const Row = useCallback(({ label, value, copyable }) => (
    <View style={styles.row}>
      <Text style={styles.label}>{label}:</Text>
      <View style={styles.valueWrap}>
        <Text style={styles.value}>{String(value ?? '—')}</Text>
        {copyable && (
          <TouchableOpacity
            onPress={() => {
              Clipboard.setString(String(value ?? ''));
              if (Platform.OS === 'android') ToastAndroid.show(L.copied, ToastAndroid.SHORT);
              else Alert.alert(L.copied);
            }}
            style={styles.copyBtn}
          >
            <Icon name="content-copy" size={18} color="#1976D2" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  ), [L.copied]);

  const raw = screenData?.order ?? {};
  const methodType = (raw.methodType || '').toLowerCase();

  const order = useMemo(() => ({
    code : raw.code ?? '',
    plate: raw.plate ?? '',
    name : raw.name ?? '',
    time : raw.time ?? '',
    price: raw.price ?? 0,
    note : raw.note,
    bank : raw.bank || null,
  }), [raw]);

  const payUrl   = raw.payUrl   ?? '';
  const deeplink = raw.deeplink ?? '';
  const device   = screenData?.device || {};
  const deviceId = device?._id || device?.id || device?.imei || raw.deviceID || '';

  const gotoDevice = () => navigateToScreen('Device');

  const openUrl = async (url) => {
    try {
      if (!url) throw new Error('Missing link');
      const supported = await Linking.canOpenURL(url);
      await Linking.openURL(supported ? url : url);
    } catch (e) {
      Alert.alert(L.errorOpenLink, e?.message || L.tryAgain);
    }
  };

  const openZaloByPhone = async (phoneRaw) => {
    try {
      const phone = String(phoneRaw).replace(/\D/g, '');
      const candidates = [
        `zalo://conversation?phone=${phone}`,
        `zalo://chat?phone=${phone}`,
        `https://zalo.me/${phone}`,
      ];
      for (const url of candidates) {
        const ok = await Linking.canOpenURL(url);
        if (ok) { await Linking.openURL(url); return; }
      }
      await Linking.openURL(`tel:${phone}`);
    } catch (e) {
      Alert.alert(L.errorOpenLink, e?.message || L.tryAgain);
    }
  };

  // ===== Polling result
  const [paidVisible, setPaidVisible] = useState(false);
  const [paidInfo, setPaidInfo] = useState(null);

  const shouldPoll = methodType === 'momo' || methodType === 'vnpay';
  useOrderStatusPolling(shouldPoll ? {
    deviceId,
    orderCode: order.code,
    intervalMs: 5000,
    timeoutMs: 5 * 60 * 1000,
    onSuccess: (found) => {
      setPaidInfo({
        code : found?.code || order.code,
        name : found?.name || order.name,
        price: found?.price ?? order.price,
        paidAt: found?.updated_at || new Date().toISOString(),
        method: methodType === 'momo' ? 'Ví MoMo' : 'VNPay',
      });
      setPaidVisible(true);
    },
  } : null);

  // ======= FULL-SCREEN SUCCESS =======
  if (paidVisible && paidInfo) {
    return (
      <PaidScreen
        L={L}
        info={paidInfo}
        onClose={gotoDevice}
        formatCurrency={formatCurrency}
      />
    );
  }

  // ================= CASH =================
  if (methodType === 'cash') {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigateToScreen('extend')} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{L.orderDetail}</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.successIcon}>
            <Icon name="check" size={40} color="#4A90E2" />
          </View>
          <Text style={styles.successTitle}>{L.successCreate}</Text>
          <Text style={styles.successTime}>{new Date().toLocaleString(L.locale)}</Text>

          <View style={styles.card}>
            <Row label={L.orderCode}   value={order.code} copyable />
            <Row label={L.packageName} value={order.name} />
            <Row label={L.time}        value={order.time ? `${order.time} ${L.months}` : '—'} />
            <Row label={L.price}       value={formatCurrency(order.price)} />
            <Row label={L.status}      value={L.pending} />
            <Row label={L.payment}     value={L.cashAtOffice} />
          </View>

          <TouchableOpacity style={styles.defaultBtn} onPress={gotoDevice}>
            <Text style={styles.defaultBtnText}>{L.close}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // ================= BANK =================
  if (methodType === 'bank') {
    const RowCompact = ({ label, value, copyable }) => (
      <View style={[styles.row, styles.rowCompact]}>
        <Text style={[styles.label, styles.labelCompact]} numberOfLines={1}>{label}:</Text>
        <View style={[styles.valueWrap, styles.valueWrapCompact]}>
          <Text style={[styles.value, styles.valueCompact]} numberOfLines={2} ellipsizeMode="clip">
            {String(value ?? '—')}
          </Text>
          {copyable && (
            <TouchableOpacity
              onPress={() => {
                Clipboard.setString(String(value ?? ''));
                if (Platform.OS === 'android') ToastAndroid.show(L.copied, ToastAndroid.SHORT);
                else Alert.alert(L.copied);
              }}
              style={[styles.copyBtn, styles.copyBtnCompact]}
            >
              <Icon name="content-copy" size={16} color="#1976D2" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );

    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigateToScreen('extend')} style={styles.backBtn}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{L.orderDetail}</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={[styles.body, styles.bodyBankCompact]}>
          <View style={[styles.successIcon, styles.successIconCompact]}>
            <Icon name="check" size={28} color="#4A90E2" />
          </View>
          <Text style={[styles.successTitle, styles.successTitleCompact]} numberOfLines={1}>
            {L.successCreate}
          </Text>
          <Text style={[styles.successTime, styles.successTimeCompact]} numberOfLines={1}>
            {new Date().toLocaleString(L.locale)}
          </Text>

          <View style={[styles.card, styles.cardCompact]}>
            <RowCompact label={L.orderCode}   value={order.code} copyable />
            <RowCompact label={L.packageName} value={order.name} />
            <RowCompact label={L.time}        value={order.time ? `${order.time} ${L.months}` : '—'} />
            <RowCompact label={L.price}       value={formatCurrency(order.price)} />
            <RowCompact label={L.status}      value={L.pending} />
            <RowCompact label={L.payment}     value={L.bankTransfer} />
          </View>

          {order.bank && (
            <View style={[styles.card, styles.cardCompact]}>
              <Text style={[styles.sectionTitle, styles.sectionTitleCompact]} numberOfLines={1}>
                {L.bankInfoTitle}
              </Text>
              <RowCompact label={L.bankName}    value={order.bank?.name}          copyable />
              <RowCompact label={L.bankAccount} value={order.bank?.accountNumber} copyable />
              <RowCompact label={L.bankOwner}   value={order.bank?.owner}         copyable />
              <RowCompact label={L.bankBranch}  value={order.bank?.branch}        copyable />
              <RowCompact label={L.amount}      value={formatCurrency(order.price)} copyable />
              <RowCompact label={L.transferNote} value={order.note}                copyable />

              <Text style={styles.zaloNoteText}>
                Quý khách vui lòng gửi hóa đơn thanh toán đến Zalo{' '}
                <Text style={styles.zaloPhone} onPress={() => openZaloByPhone(ZALO_PHONE)}>
                  {ZALO_PHONE}
                </Text>{' '}
                để được xác nhận gia hạn
              </Text>
            </View>
          )}

          <TouchableOpacity style={[styles.defaultBtn, styles.defaultBtnBlue]} onPress={gotoDevice}>
            <Text style={styles.defaultBtnText}>{L.close}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ================= VNPay =================
  if (methodType === 'vnpay') {
    return (
      <View style={styles.container}>
        <Image source={backgroundVNPAY} style={styles.bannerVnpay} resizeMode="contain" />
        <Text style={styles.vnpayTitle}>{L.vnpayTitle}</Text>
        <Text style={styles.timeNow}>{new Date().toLocaleString(L.locale)}</Text>

        <View style={styles.card}>
          <Row label={L.orderCode}   value={order.code} />
          <Row label={L.plate}       value={order.plate} />
          <Row label={L.packageName} value={order.name} />
          <Row label={L.time}        value={order.time ? `${order.time} ${L.months}` : '—'} />
          <Row label={L.amount}      value={formatCurrency(order.price)} />
        </View>

        <TouchableOpacity style={styles.vnpayBtn} onPress={() => openUrl(payUrl)}>
          <Icon name="account-balance-wallet" size={22} color="#fff" />
          <Text style={styles.vnpayBtnText}>{L.continue}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={gotoDevice}>
          <Icon name="close" size={18} color="#666" />
          <Text style={styles.cancelBtnText}>{L.cancel}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ================= MoMo =================
  if (methodType === 'momo') {
    return (
      <View style={styles.container}>
        <Image source={backgroundMomo} style={styles.bannerMomo} resizeMode="cover" />
        <Text style={styles.momoTitle}>{L.momoTitle}</Text>
        <Text style={styles.timeNow}>{new Date().toLocaleString(L.locale)}</Text>

        <View style={styles.card}>
          <Row label={L.orderCode}   value={order.code} />
          <Row label={L.plate}       value={order.plate} />
          <Row label={L.packageName} value={order.name} />
          <Row label={L.time}        value={order.time ? `${order.time} ${L.months}` : '—'} />
          <Row label={L.amount}      value={formatCurrency(order.price)} />
        </View>

        <TouchableOpacity style={styles.momoBtn} onPress={() => openUrl(deeplink || payUrl)}>
          <Icon name="phone-android" size={20} color="#fff" />
          <Text style={styles.momoBtnText}>{L.openMomo}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.momoQrBtn} onPress={() => openUrl(payUrl)}>
          <Icon name="qr-code-scanner" size={20} color="#ED008C" />
          <Text style={styles.momoQrBtnText}>{L.scanQr}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={gotoDevice}>
          <Text style={styles.momoCancelText}>{L.cancelUpper}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return null;
};

export default PaymentConfirm;

const { height } = Dimensions.get('window');
const tiny = height < 720;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    backgroundColor: '#4A90E2',
    paddingTop: 25, paddingBottom: 12, paddingHorizontal: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center'
  },
  backBtn: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },

  body: { padding: 20 },
  successIcon: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#E3F2FD',
    borderWidth: 3, borderColor: '#4A90E2', alignItems: 'center', justifyContent: 'center',
    alignSelf: 'center', marginBottom: 20,
  },
  successTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#333' },
  successTime: { color: '#666', marginVertical: 10, textAlign: 'center' },

  card: {
    backgroundColor: '#FAFAFA', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#ECEFF1',
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8, color: '#111' },

  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  label: { color: '#555', fontSize: 15, flex: 1 },
  valueWrap: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  value: { color: '#111', fontSize: 15, fontWeight: '600' },
  copyBtn: {
    marginLeft: 6, width: 26, height: 26, borderRadius: 6,
    borderWidth: 1, borderColor: '#BBDEFB', backgroundColor: '#E3F2FD',
    alignItems: 'center', justifyContent: 'center',
  },
  note: { marginTop: 6, color: '#37474F', lineHeight: 20 },

  defaultBtn: { backgroundColor: '#666', paddingVertical: 15, borderRadius: 25, alignItems: 'center', marginTop: 20 },
  defaultBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  defaultBtnBlue: { backgroundColor: '#0D6EFD' },

  // ===== BANK COMPACT =====
  bodyBankCompact: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 10 },
  successIconCompact: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, marginBottom: 10 },
  successTitleCompact: { fontSize: tiny ? 15 : 16, marginTop: 2 },
  successTimeCompact: { fontSize: tiny ? 11.5 : 12.5, marginVertical: 6 },
  cardCompact: { paddingVertical: 8, paddingHorizontal: 10, marginBottom: 10 },
  rowCompact: { marginBottom: 6 },
  labelCompact: { fontSize: tiny ? 12 : 13 },
  valueWrapCompact: {
    flex: 1, maxWidth: '70%', flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start',
  },
  valueCompact: { textAlign: 'right', flexShrink: 1, fontSize: tiny ? 12.5 : 13.5, lineHeight: tiny ? 16 : 18 },
  copyBtnCompact: { width: 22, height: 22, borderRadius: 6, marginLeft: 6, marginTop: 2 },
  sectionTitleCompact: { fontSize: tiny ? 13 : 14, marginBottom: 6, textAlign: 'center' },

  zaloNoteText: { marginTop: 6, color: '#37474F', fontSize: tiny ? 12 : 13, lineHeight: tiny ? 16.5 : 18 },
  zaloPhone: { color: '#0D6EFD', fontWeight: '700', textDecorationLine: 'underline' },

  // vnpay
  bannerVnpay: { width: '80%', height: 120, alignSelf: 'center', marginTop: 16 },
  vnpayTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#0D6EFD', marginTop: 18 },
  timeNow: { color: '#666', marginTop: 6, marginBottom: 16, textAlign: 'center' },
  vnpayBtn: { backgroundColor: '#0D6EFD', paddingVertical: 14, borderRadius: 25, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginHorizontal: 20, marginBottom: 12 },
  vnpayBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  cancelBtn: { backgroundColor: '#f5f5f5', paddingVertical: 14, borderRadius: 25, alignItems: 'center', marginHorizontal: 20 },
  cancelBtnText: { color: '#666', fontSize: 16, fontWeight: 'bold' },

  // momo
  bannerMomo: { width: '100%', height: 180, alignSelf: 'center' },
  momoTitle: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#ED008C', marginTop: 12 },
  momoBtn: { backgroundColor: '#ED008C', paddingVertical: 15, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', marginHorizontal: 20, marginBottom: 12 },
  momoBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  momoQrBtn: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#ED008C', paddingVertical: 15, borderRadius: 8, flexDirection: 'row', justifyContent: 'center', marginHorizontal: 20, marginBottom: 12 },
  momoQrBtnText: { color: '#ED008C', fontSize: 16, fontWeight: 'bold', marginLeft: 8 },
  momoCancelText: { color: '#666', fontSize: 16, fontWeight: 'bold' },
});
