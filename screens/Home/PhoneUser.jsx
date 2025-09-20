// screens/Home/PhoneUser.jsx
import React, {
  useEffect, useState, useContext, useRef, useMemo, useCallback,
} from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, ScrollView,
  BackHandler, Animated, Easing,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NotificationContext } from '../../App';
import MQTT from 'sp-react-native-mqtt';

/* ================== I18N ================== */
const LANG_KEY = 'app_language';
const STRINGS = {
  vi: {
    header: 'Quản lý xe',
    title: 'SỐ ĐIỆN THOẠI CHỦ XE',
    phone1: 'Số ĐT chủ xe 1',
    phone2: 'Số ĐT chủ xe 2',
    phone3: 'Số ĐT chủ xe 3',
    agree: 'Đồng ý',
    close: 'Đóng',
    successTitle: 'Thành công',
    successMsg: 'Số điện thoại chủ xe đã được cập nhật!',
    ok: 'OK',
    errConn: 'Không kết nối được MQTT (1883). Kiểm tra mạng/port.',
    errPhone: 'Số điện thoại không hợp lệ',
    waitingTitle: 'Đang kết nối với thiết bị…',
    waitingHint: 'Nhấn “Hủy chờ” nếu thấy quá lâu',
    cancel: 'Hủy chờ',
  },
  en: {
    header: 'Vehicle Manager',
    title: 'OWNER PHONE NUMBERS',
    phone1: 'Owner Phone 1',
    phone2: 'Owner Phone 2',
    phone3: 'Owner Phone 3',
    agree: 'Confirm',
    close: 'Close',
    successTitle: 'Success',
    successMsg: 'Owner phone numbers updated successfully!',
    ok: 'OK',
    errConn: 'Cannot connect to MQTT (1883).',
    errPhone: 'Invalid phone number',
    waitingTitle: 'Talking to device…',
    waitingHint: 'Tap “Cancel” if it’s taking too long',
    cancel: 'Cancel',
  },
};

/* ================== MQTT CONFIG (TCP 1883) ================== */
const MQTT_URI  = 'mqtt://mqtt.iky.vn:1883';
const MQTT_USER = 'iky';
const MQTT_PASS = 'IKY123456';
const MQTT_QOS  = 1;
const QUERY_THROTTLE_MS = 5000;
const PRIMARY = '#4A90E2';

const makeClientId = (imei) =>
  ('app' + String(imei || '').replace(/\D/g, '')).slice(0, 20) + ((Math.random()*1000)|0);

// log nhẹ
const ts = () => {
  const d = new Date();
  return d.toLocaleTimeString() + '.' + String(d.getMilliseconds()).padStart(3, '0');
};
const mlog = (...args) => console.log('[MQTT]', ts(), ...args);

/* ========== Fancy Loader (thanh sóng nhấp nhô) ========== */
const WaveLoader = ({ barCount = 5, color = '#fff', height = 26, width = 6, gap = 8 }) => {
  const vals = useMemo(() => Array.from({ length: barCount }, () => new Animated.Value(0)), [barCount]);
  const loopsRef = useRef([]);

  useEffect(() => {
    // start each bar with a small delay for wave effect
    vals.forEach((v, i) => {
      const up = Animated.timing(v, { toValue: 1, duration: 420, easing: Easing.out(Easing.quad), useNativeDriver: true });
      const down = Animated.timing(v, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad),  useNativeDriver: true });
      const seq = Animated.sequence([up, down]);
      const loop = Animated.loop(seq, { iterations: -1 });
      loopsRef.current[i] = loop;
      const startWithDelay = setTimeout(() => loop.start(), i * 120);
      // store timeout id on the loop object for cleanup (optional)
      loopsRef.current[i]._delayId = startWithDelay;
    });
    return () => {
      loopsRef.current.forEach((loop) => {
        try { loop?.stop?.(); } catch {}
        if (loop?._delayId) clearTimeout(loop._delayId);
      });
    };
  }, [vals]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      {vals.map((v, i) => {
        const scaleY = v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.35] });
        const translateY = v.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
        return (
          <Animated.View
            key={i}
            style={{
              width,
              height,
              marginHorizontal: gap / 2,
              borderRadius: 3,
              backgroundColor: color,
              transform: [{ translateY }, { scaleY }],
              opacity: 0.95,
            }}
          />
        );
      })}
    </View>
  );
};

function PhoneUser({ navigateToScreen, screenData, navigation }) {
  const [language, setLanguage] = useState('vi');
  const t = (k) => STRINGS[language][k] || k;
  const tRef = useRef(t);
  useEffect(() => { tRef.current = t; }, [t]);

  // Context an toàn
  const notifCtx = useContext(NotificationContext) || {};
  const notifications = Array.isArray(notifCtx.notifications) ? notifCtx.notifications : [];
  const setNotifications = typeof notifCtx.setNotifications === 'function' ? notifCtx.setNotifications : () => {};
  const unreadCount = notifications.filter((n) => n && typeof n === 'object' && !n.isRead).length;

  const imei = useMemo(
    () => String((screenData && (screenData.device?.imei || screenData.imei)) || '').trim(),
    [screenData]
  );

  // topics (không có "/" theo yêu cầu fw)
  const topicReq = useMemo(() => (imei ? `dev${imei}` : ''), [imei]); // app -> device
  const topicRes = useMemo(() => (imei ? `app${imei}` : ''), [imei]); // device -> app

  const [phoneNumbers, setPhoneNumbers] = useState({ phone1: '', phone2: '', phone3: '' });
  const [focusedInput, setFocusedInput] = useState(null);
  const [hasValue, setHasValue] = useState({ phone1: false, phone2: false, phone3: false });

  // Overlay: BẬT khi vào màn & gửi query, chỉ TẮT khi có data (kể cả rỗng) hoặc user hủy
  const [overlayVisible, setOverlayVisible] = useState(false);

  // MQTT refs
  const clientRef = useRef(null);
  const connectedRef = useRef(false);
  const connectingRef = useRef(false);
  const shouldReconnectRef = useRef(true);

  // trạng thái CHỜ
  const waitingRef = useRef(false);

  // flow control
  const requeryOnceRef = useRef(false);
  const lastQueryAtRef = useRef(0);

  // utils
  const normalize = (v) => String(v || '').replace(/\D/g, '');
  const pretty = (v) => {
    const s = normalize(v).replace(/^84/, '0');
    if (!s) return '';
    return s.startsWith('0') ? s : `0${s}`;
  };
  const validPhone = (v) => /^(\+?84|0)?\d{9,10}$/.test(normalize(v).replace(/^84/, '0'));

  const setFromList = (list) => {
    const [a, b, c] = (list || []).slice(0, 3).map(pretty);
    setPhoneNumbers({ phone1: a || '', phone2: b || '', phone3: c || '' });
    setHasValue({ phone1: !!a, phone2: !!b, phone3: !!c });
  };

  useEffect(() => {
    (async () => {
      try { const saved = await AsyncStorage.getItem(LANG_KEY); if (saved) setLanguage(saved); } catch {}
    })();
  }, []);

  /* ===== cancel waiting: dùng chung cho overlay button + back handlers ===== */
  const cancelWaiting = useCallback(() => {
    mlog('Cancel waiting -> disconnect & hide overlay');
    waitingRef.current = false;
    setOverlayVisible(false);
    shouldReconnectRef.current = false;
    try { clientRef.current?.disconnect(); } catch {}
  }, []);

  /* ============== helper: gửi '?' có throttle ============== */
  const sendQuery = useCallback(() => {
    if (!clientRef.current || !topicReq) return;
    const now = Date.now();
    if (now - (lastQueryAtRef.current || 0) < QUERY_THROTTLE_MS) {
      mlog('skip query (throttled)');
      return;
    }
    lastQueryAtRef.current = now;
    const q = { imei, pid: 'android', usd: '?' };
    mlog('PUBLISH ->', topicReq, q);
    try { clientRef.current.publish(topicReq, JSON.stringify(q), MQTT_QOS, false); } catch {}
  }, [imei, topicReq]);

  /* ================== MQTT connect ================== */
  const connectMqtt = useCallback(() => {
    if (!imei) { mlog('skip connect: missing imei'); return; }
    if (connectingRef.current) { mlog('skip: connecting in progress'); return; }

    try { clientRef.current?.disconnect(); } catch {}
    clientRef.current = null;
    connectedRef.current = false;
    requeryOnceRef.current = false;
    lastQueryAtRef.current = 0;

    const clientId = makeClientId(imei).slice(0, 23);
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
      clientRef.current = client;

      client.on('closed', () => {
        mlog('closed');
        connectedRef.current = false;
        connectingRef.current = false;
        if (shouldReconnectRef.current) setTimeout(() => connectMqtt(), 1200);
      });

      client.on('error', (e) => {
        mlog('ERROR:', e);
        connectedRef.current = false;
        connectingRef.current = false;
        if (shouldReconnectRef.current) setTimeout(() => connectMqtt(), 1200);
      });

      client.on('message', (msg) => {
        const text = String(msg.data || '');
        mlog('RX', msg.topic, text.slice(0, 200));
        if (msg.topic !== topicRes) return;

        try {
          const data = JSON.parse(text);
          const hasUsd = Object.prototype.hasOwnProperty.call(data, 'usd');
          if (hasUsd) {
            const raw = (data.usd ?? '').toString().trim();
            const list = raw.length
              ? raw.split(/[,\*\s#]+/).map(s => s.trim()).filter(Boolean)
              : [];
            setFromList(list);            // list rỗng -> set 3 ô trống
            waitingRef.current = false;
            setOverlayVisible(false);     // 🔥 TẮT overlay dù usd rỗng
            return;
          }
          // ACK-only -> hỏi lại 1 phát
          const ack = ('res' in data) || ('typ' in data) || ('pro' in data);
          if (ack && !requeryOnceRef.current) {
            requeryOnceRef.current = true;
            setTimeout(() => sendQuery(), 700);
          }
        } catch (_e) {
          if (text.trim().length === 0) {
            setFromList([]);
            waitingRef.current = false;
            setOverlayVisible(false);
            return;
          }
          if (/[,\*\s#]/.test(text)) {
            const list = text.split(/[,\*\s#]+/).map(s => s.trim()).filter(Boolean);
            setFromList(list);
            waitingRef.current = false;
            setOverlayVisible(false);
          }
        }
      });

      client.on('connect', () => {
        mlog('CONNECTED');
        connectedRef.current = true;
        connectingRef.current = false;

        if (topicRes) client.subscribe(topicRes, MQTT_QOS);

        // BẬT overlay & bắt đầu chờ ngay khi gửi '?'
        waitingRef.current = true;
        setOverlayVisible(true);
        if (topicReq) sendQuery();
      });

      client.connect();
    }).catch(err => {
      connectingRef.current = false;
      mlog('createClient err:', err?.message || String(err));
      Alert.alert('⚠️', tRef.current('errConn'));
    });
  }, [imei, topicRes, sendQuery]);

  useEffect(() => {
    connectMqtt();
    return () => {
      shouldReconnectRef.current = false;
      try { clientRef.current?.disconnect(); } catch {}
      lastQueryAtRef.current = 0;
      requeryOnceRef.current = false;
      waitingRef.current = false;
      setOverlayVisible(false);
    };
  }, [connectMqtt]);

  /* ============== Android hardware BACK ============== */
  useEffect(() => {
    const onBack = () => {
      if (waitingRef.current) {
        mlog('Back pressed -> cancel waiting ONLY');
        cancelWaiting();
        return true;
      }
      navigateToScreen && navigateToScreen('Device');
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [navigateToScreen, cancelWaiting]);

  /* ============== iOS back gesture (react-navigation, nếu có) ============== */
  useEffect(() => {
    if (!navigation || typeof navigation.addListener !== 'function') return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      if (!waitingRef.current) return;
      e.preventDefault();
      mlog('iOS back gesture -> cancel waiting ONLY');
      cancelWaiting();
    });
    return unsub;
  }, [navigation, cancelWaiting]);

  /* ================== Actions ================== */
  const handleAgreePress = () => {
    const values = [phoneNumbers.phone1, phoneNumbers.phone2, phoneNumbers.phone3]
      .map(v => (v || '').trim()).filter(Boolean);

    for (const v of values) {
      if (!validPhone(v)) { Alert.alert('⚠️', tRef.current('errPhone')); return; }
    }
    if (!connectedRef.current || !clientRef.current) {
      Alert.alert('⚠️', tRef.current('errConn'));
      return;
    }

    // format: *s1*s2*s3#
    const payload = '*' + values.map(v => normalize(v).replace(/^84/, '0')).join('*') + '#';

    try {
      const pack = { imei, pid: 'android', usd: payload };
      mlog('PUBLISH ->', topicReq, pack);
      if (topicReq) clientRef.current.publish(topicReq, JSON.stringify(pack), MQTT_QOS, false);

      // Sau khi gửi cài đặt → CHỜ phản hồi
      waitingRef.current = true;
      setOverlayVisible(true);
      setTimeout(() => sendQuery(), 800);
    } catch (e) {
      mlog('publish err:', e?.message);
    }

    Alert.alert(tRef.current('successTitle'), tRef.current('successMsg'), [
      { text: tRef.current('ok') },
    ]);
  };

  const handleClosePress = () => navigateToScreen && navigateToScreen('Device');

  const handleInputChange = (field, value) => {
    setPhoneNumbers(prev => ({ ...(prev || {}), [field]: value }));
    setHasValue(prev => ({ ...(prev || {}), [field]: (value || '').length > 0 }));
  };
  const isLabelFloating = (field) => focusedInput === field || hasValue[field];

  const renderFloatingInput = (field, label) => {
    const isFloating = isLabelFloating(field);
    const isFocused = focusedInput === field;
    return (
      <View style={styles.inputGroup}>
        <View style={[styles.floatingInputContainer, isFocused && styles.focusedContainer]}>
          <Text style={[styles.floatingLabel, isFloating && styles.floatingLabelActive, isFocused && styles.focusedLabel]}>
            {label}
          </Text>
          <View style={styles.inputWithIcon}>
            <Icon name="smartphone" size={20} color="#9aa4b2" style={styles.inputIcon} />
            <TextInput
              style={[styles.floatingInput, isFloating && styles.floatingInputActive]}
              value={phoneNumbers[field]}
              onChangeText={(text) => handleInputChange(field, text)}
              onFocus={() => setFocusedInput(field)}
              onBlur={() => setFocusedInput(null)}
              keyboardType="phone-pad"
              placeholderTextColor="#9aa4b2"
            />
          </View>
        </View>
      </View>
    );
  };

  /* ================== UI ================== */
  return (
    <View style={styles.container}>
      {/* Overlay: bật khi đang CHỜ (Fancy Loader + nút Hủy) */}
      {overlayVisible && (
        <View style={styles.overlay}>
          <WaveLoader barCount={5} color="#fff" height={28} width={7} gap={10} />
          <Text style={styles.overlayTitle}>{t('waitingTitle')}</Text>
          <Text style={styles.overlaySub}>{t('waitingHint')}</Text>

          <TouchableOpacity style={styles.overlayCancel} onPress={cancelWaiting} activeOpacity={0.9}>
            <Icon name="close" size={18} color={PRIMARY} />
            <Text style={styles.overlayCancelText}>{t('cancel')}</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigateToScreen && navigateToScreen('Device')} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          {t('header')}{imei ? `: ${screenData?.device?.license_plate || ''}` : ''}
        </Text>

        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => {
            setNotifications(prev => {
              const arr = Array.isArray(prev) ? prev : [];
              return arr.map(n => {
                const base = (n && typeof n === 'object') ? n : {};
                return { ...base, isRead: true };
              });
            });
            navigateToScreen && navigateToScreen('notification', { from: 'phoneUser' });
          }}>
          <View style={styles.notificationContainer}>
            <Icon name="notifications" size={24} color="white" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{t('title')}</Text>

        {renderFloatingInput('phone1', t('phone1'))}
        {renderFloatingInput('phone2', t('phone2'))}
        {renderFloatingInput('phone3', t('phone3'))}

        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.agreeButton} onPress={handleAgreePress} activeOpacity={0.9}>
            <Text style={styles.agreeButtonText}>{t('agree')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={handleClosePress} activeOpacity={0.9}>
            <Text style={styles.closeButtonText}>{t('close')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

export default PhoneUser;

/* ================== Styles ================== */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 13, 23, .55)',
    zIndex: 99,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  overlayTitle: { color: '#fff', marginTop: 14, fontSize: 16, fontWeight: '800' },
  overlaySub: { color: '#fff', marginTop: 6, fontSize: 13, opacity: 0.9 },
  overlayCancel: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 999,
    elevation: 2,
  },
  overlayCancelText: { color: PRIMARY, fontSize: 14, fontWeight: '800' },

  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 25,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: { padding: 4, marginRight: 8 },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '700', flex: 1 },
  headerBtn: { padding: 4 },
  notificationContainer: { position: 'relative' },
  badge: {
    position: 'absolute', top: -6, right: -6, backgroundColor: '#ff4444',
    borderRadius: 10, minWidth: 18, height: 18, paddingHorizontal: 3,
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700', textAlign: 'center' },

  content: { flex: 1, paddingHorizontal: 20, paddingTop: 30 },
  title: { fontSize: 20, fontWeight: '800', color: PRIMARY, textAlign: 'center', marginBottom: 40 },

  inputGroup: { marginBottom: 30, position: 'relative' },
  floatingInputContainer: {
    borderWidth: 1.2, borderColor: '#e5e7eb', borderRadius: 12,
    backgroundColor: 'white', minHeight: 56, justifyContent: 'center',
  },
  focusedContainer: { borderColor: PRIMARY, borderWidth: 1.6, shadowColor: PRIMARY, shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  floatingLabel: { position: 'absolute', left: 48, top: 18, fontSize: 16, color: '#98a2b3', zIndex: 1 },
  floatingLabelActive: { top: -8, left: 12, fontSize: 12, color: '#667085', backgroundColor: 'white', paddingHorizontal: 6, fontWeight: '700' },
  focusedLabel: { color: PRIMARY },
  inputWithIcon: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  inputIcon: { marginRight: 10 },
  floatingInput: { flex: 1, paddingVertical: 18, fontSize: 16, color: '#0f172a' },
  floatingInputActive: { paddingTop: 20, paddingBottom: 10 },

  buttonContainer: { marginTop: 60, marginBottom: 30, gap: 12 },
  agreeButton: {
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    shadowColor: PRIMARY, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  agreeButtonText: { color: 'white', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  closeButton: {
    backgroundColor: 'white', borderRadius: 14, paddingVertical: 15, alignItems: 'center',
    borderWidth: 1.2, borderColor: '#e5e7eb',
  },
  closeButtonText: { color: '#334155', fontSize: 16, fontWeight: '700' },
});
