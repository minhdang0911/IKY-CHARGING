// App.js
import React, { useEffect, useState, useRef } from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  ActivityIndicator,
  Text,
  Keyboard,
  Platform,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import useScreen from './Hooks/useScreen';
import { refreshAccessToken } from './apis/auth';

// ====== Screens ======
import LoginScreen from './screens/auth/LoginScreen';
import ForgotPasswordScreen from './screens/ForgotPassword/ForgotPasswordScreen';
import ForgotPasswordStep2Screen from './screens/ForgotPassword/ForgotPasswordScreenStep2';
import ForgotPasswordStep3Screen from './screens/ForgotPassword/ForgotPasswordScreenStep3';
import MonitoringScreen from './screens/Home/MonitoringScreen';
import JourneyScreen from './screens/Home/JourneyScreen';
import DeviceScreen from './screens/Home/DeviceScreen';
import InformationScreen from './screens/Home/InformationScreen';
import BottomTabNavigation from './components/NavBottom/navBottom';
import ChangeInfo from './screens/auth/ChangeInfo';
import CompanyInfo from './screens/Company/CompanyInfo';
import ChangePassword from './screens/auth/ChangePassword';
import DevicesInfo from './screens/Home/InfoDevices';
import PhoneUser from './screens/Home/PhoneUser';
import HistoryExtend from './screens/Home/HistoryExtend';
import AddDevices from './screens/Home/addDevices';
import Notification from './screens/Notification/Notification';
import Extend from './screens/Home/Extend';
import OrderDetail from './screens/Home/OrderDetail';
import PaymentConfirm from './screens/Home/PaymentConfirm';
import ActiveDevicesScreen from './screens/Home/ActiveDevices';
import ChargingSession from './screens/Home/ChargingSession';

// 🔌 SSE manager
import sseManager from './utils/sseManager';

// global
import './apis/devices.global';

// Storage keys
const K_ACCESS = 'access_token';
const K_REFRESH = 'refresh_token';
const K_EXPIRES_AT = 'expires_at';
const K_USERNAME = 'username';
const K_USER_OID = 'user_oid';

// ===== Auto refresh 2 phút =====
const LOOP_MS = 40 * 60 * 1000; 
const MIN_GAP_MS = 20 * 60 * 1000;

let refreshTimer = null;
let refreshInFlight = null;
let lastRefreshAt = 0;
let loopArmed = false;  

function clearRefreshLoop() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
  loopArmed = false;
}

async function hardLogout(navigateToScreen) {
  try { sseManager.stop(); } catch {}
  clearRefreshLoop();
  try {
    await AsyncStorage.multiRemove([K_ACCESS, K_REFRESH, K_EXPIRES_AT, K_USER_OID, K_USERNAME]);
  } catch {}
  navigateToScreen('Login');
}

// helper: ngủ ms
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function doRefreshToken(navigateToScreen, { force = false } = {}) {
  if (refreshInFlight) return refreshInFlight;
  if (!force && Date.now() - lastRefreshAt < MIN_GAP_MS) return;

  refreshInFlight = (async () => {
    const [refresh, access] = await Promise.all([
      AsyncStorage.getItem(K_REFRESH),
      AsyncStorage.getItem(K_ACCESS),
    ]);
    if (!refresh || !access) { refreshInFlight = null; return; }

    let attempt = 0;
    let backoff = 2000; // 2s → 4s → 8s (max 30s)

    while (true) {
      try {
        console.log('🔄 Refreshing access token… (attempt', attempt + 1, ')');
        // ✅ truyền cả refresh + access vào
        const data = await refreshAccessToken(refresh, access);

        if (!data || (!data.accessToken && !data.refreshToken)) {
          throw new Error('Bad refresh payload');
        }

        const pairs = [
          [K_ACCESS, data.accessToken || ''],
          [K_REFRESH, data.refreshToken || refresh],
        ];
        if (data.expires_at) pairs.push([K_EXPIRES_AT, String(data.expires_at)]);
        await AsyncStorage.multiSet(pairs);

        lastRefreshAt = Date.now();
        console.log('✅ Refreshed OK.');
        if (data.accessToken) {
          try { sseManager.updateToken(data.accessToken); } catch {}
        }
        break; // DONE
      } catch (e) {
        const status = e?.response?.status;
        const body = e?.response?.data;
        const msg = status ? `HTTP ${status} ${JSON.stringify(body || {})}` : (e?.message || String(e));
        console.log('❌ Refresh failed:', msg);

        // 400/401/invalid -> logout
        const lower = msg.toLowerCase();
        const isAuthErr = status === 400 || status === 401
          || /invalid_grant|invalid refresh|expired|unauthorized|invalid_token/.test(lower);

        if (isAuthErr) {
          console.log('🚪 Refresh token invalid → force logout');
          await hardLogout(navigateToScreen);
          break;
        }

        // 5xx / network → retry với backoff, giới hạn 3 lần
        attempt += 1;
        if (attempt >= 3) {
          console.log('⏭️ Give up retry for now, will try again on next loop.');
          break;
        }
        await sleep(backoff);
        backoff = Math.min(backoff * 2, 30000);
      }
    }

    refreshInFlight = null;
  })();

  return refreshInFlight;
}

function startRefreshLoopOnce(navigateToScreen) {
  if (loopArmed) return;
  clearRefreshLoop();
  refreshTimer = setInterval(async () => {
    try { await doRefreshToken(navigateToScreen); } catch {}
  }, LOOP_MS);
  loopArmed = true;
  console.log(`🕒 Auto-refresh started: every ${Math.round(LOOP_MS / 60000)} minutes`);
}

const SCREEN_TO_TAB = {
  Monitoring: 'Monitoring',
  Journey: 'Journey',
  Device: 'Device',
  Information: 'Information',
  companyInfo: 'Information',
  changePassword: 'Information',
  devicesInfo: 'Device',
  phoneUser: 'Device',
  historyExtend: 'Device',
  extend: 'Device',
  activeDevices: 'Monitoring',
  paymentConfirm: 'Device',
  chargingSession: 'Device',
};

export default function App() {
  const {
    currentScreen,
    screenData,
    navigateToScreen,
    goBack,
    login,
    logout,
    changeInfo,
    forgotStep2,
    restoreSession,
  } = useScreen();

  const [booting, setBooting] = useState(true);

  // Busy overlay
  const [busy, setBusy] = useState({ active: false, text: '' });
  const busyRef = useRef(false);
  const showBusy = (text = 'Đang xử lý…') => { busyRef.current = true; setBusy({ active: true, text }); };
  const hideBusy = () => { busyRef.current = false; setBusy({ active: false, text: '' }); };

  // Ẩn tab khi mở keyboard
  const [kbVisible, setKbVisible] = useState(false);
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.select({ ios: 'keyboardWillShow', android: 'keyboardDidShow' }),
      () => setKbVisible(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.select({ ios: 'keyboardWillHide', android: 'keyboardDidHide' }),
      () => setKbVisible(false),
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Giữ navigateToScreen mới nhất trong ref để handler SSE không bị recreate
  const navRef = useRef(navigateToScreen);
  useEffect(() => { navRef.current = navigateToScreen; }, [navigateToScreen]);

  // SSE: token die → logout + Login (gắn 1 lần)
  const sseHandlerAttached = useRef(false);
  useEffect(() => {
    if (sseHandlerAttached.current) return;
    sseHandlerAttached.current = true;
    sseManager.setAuthInvalidHandler(async () => {
      console.log('[AUTH] SSE invalid/expired → force logout');
      await hardLogout(navRef.current);
    });
    return () => {
      sseManager.setAuthInvalidHandler(null);
      sseHandlerAttached.current = false;
    };
  }, []);

  // Boot
  const bootOnce = useRef(false);
  useEffect(() => {
    if (bootOnce.current) return;
    bootOnce.current = true;

    (async () => {
      try {
        const access = await AsyncStorage.getItem(K_ACCESS);
       if (access) {
  restoreSession();
  startRefreshLoopOnce(navigateToScreen);
  sseManager.start(access);

  const expiresAt = parseInt(await AsyncStorage.getItem(K_EXPIRES_AT), 10) || 0;
  const now = Date.now();
  if (!expiresAt || expiresAt - now < 10 * 60 * 1000) {
    // chỉ force refresh nếu sắp hết hạn (<10 phút)
    try { await doRefreshToken(navigateToScreen, { force: true }); } catch {}
  }
}
else {
          navigateToScreen('Login');
        }
      } catch (e) {
        console.warn('Auto login failed:', e?.message || e);
      } finally {
        setBooting(false);
      }
    })();
  }, [navigateToScreen, restoreSession]);

  // AppState: foreground → refresh ngay; background → dừng loop
 useEffect(() => {
  const sub = AppState.addEventListener('change', async (state) => {
    if (state === 'active') {
      // Đừng force refresh mỗi lần foreground
      try { await doRefreshToken(navigateToScreen, { force: false }); console.log('⏱ Last refresh:', new Date(lastRefreshAt).toLocaleTimeString());
 } catch {}
      startRefreshLoopOnce(navigateToScreen);
    } else {
      clearRefreshLoop();
    }
  });
  return () => { try { sub.remove(); } catch {} };
}, [navigateToScreen]);


  const handleLogin = async (userData = null) => {
    login(userData);
    try {
      const accessToken = await AsyncStorage.getItem(K_ACCESS);
      if (accessToken) {
        startRefreshLoopOnce(navigateToScreen);
        sseManager.start(accessToken);
        try { await doRefreshToken(navigateToScreen, { force: true }); } catch {}
      }
    } catch (e) {
      console.log('⚠️ Login/refresh handling error:', e?.message);
    }
  };

  const handleLogout = async () => {
    if (busyRef.current) return;
    showBusy('Đang đăng xuất…');
    try {
      try { sseManager.stop(); } catch {}
      clearRefreshLoop();
      await AsyncStorage.multiRemove([K_ACCESS, K_REFRESH, K_EXPIRES_AT, K_USER_OID, K_USERNAME]);
    } catch (e) {
      console.log('⚠️ Logout error:', e?.message || e);
    } finally {
      logout();
      hideBusy();
    }
  };

  const screensWithoutBottomNav = ['Login','ForgotPassword','forgotStep2','forgotStep3','changeInfo','AddDevices'];

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'Login': return <LoginScreen navigateToScreen={navigateToScreen} login={handleLogin} />;
      case 'ForgotPassword': return <ForgotPasswordScreen goBack={goBack} navigateToScreen={navigateToScreen} screenData={screenData} />;
      case 'forgotStep2': return <ForgotPasswordStep2Screen goBack={goBack} navigateToScreen={navigateToScreen} screenData={screenData} />;
      case 'forgotStep3': return <ForgotPasswordStep3Screen goBack={goBack} navigateToScreen={navigateToScreen} screenData={screenData} />;
      case 'Monitoring': return <MonitoringScreen logout={handleLogout} navigateToScreen={navigateToScreen} />;
      case 'devicesInfo': return <DevicesInfo logout={handleLogout} navigateToScreen={navigateToScreen} screenData={screenData} />;
      case 'notification': return <Notification navigateToScreen={navigateToScreen} screenData={screenData} />;
      case 'paymentConfirm': return <PaymentConfirm navigateToScreen={navigateToScreen} screenData={screenData} />;
      case 'orderDetail': return <OrderDetail order={screenData?.order} navigateToScreen={navigateToScreen} device={screenData?.device} />;
      case 'Journey': return <JourneyScreen logout={handleLogout} navigateToScreen={navigateToScreen} setAppBusy={() => {}} />;
      case 'extend': return <Extend logout={handleLogout} navigateToScreen={navigateToScreen} screenData={screenData} />;
      case 'companyInfo': return <CompanyInfo logout={handleLogout} navigateToScreen={navigateToScreen} />;
      case 'changePassword': return <ChangePassword navigateToScreen={navigateToScreen} />;
      case 'Device': return <DeviceScreen logout={handleLogout} navigateToScreen={navigateToScreen} />;
      case 'phoneUser': return <PhoneUser screenData={screenData} navigateToScreen={navigateToScreen} />;
      case 'historyExtend': return <HistoryExtend logout={handleLogout} navigateToScreen={navigateToScreen} screenData={screenData} />;
      case 'AddDevices': return <AddDevices navigateToScreen={navigateToScreen} screenData={screenData} />;
      case 'Information': return <InformationScreen changeInfo={changeInfo} logout={handleLogout} screenData={screenData} navigateToScreen={navigateToScreen} />;
      case 'changeInfo': return <ChangeInfo logout={handleLogout} screenData={screenData} navigateToScreen={navigateToScreen} />;
      case 'activeDevices': return <ActiveDevicesScreen screenData={screenData} navigateToScreen={navigateToScreen} />;
      case 'chargingSession': return <ChargingSession screenData={screenData} navigateToScreen={navigateToScreen} />;
      default: return <LoginScreen navigateToScreen={navigateToScreen} login={handleLogin} />;
    }
  };

  if (booting) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const currentTab = SCREEN_TO_TAB[currentScreen] || 'Monitoring';
  const hideTab = kbVisible || screensWithoutBottomNav.includes(currentScreen);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1e88e5" />
      {renderCurrentScreen()}
      {!hideTab && <BottomTabNavigation currentScreen={currentTab} navigateToScreen={navigateToScreen} />}

      {busy.active && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.overlayText}>{busy.text || 'Đang xử lý…'}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  overlayText: { color: '#fff', marginTop: 10, fontSize: 16, fontWeight: '600' },
});