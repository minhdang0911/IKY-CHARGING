// App.js
import React, { useEffect, useState, useRef } from 'react';
import {
  StatusBar,
  StyleSheet,
  View,
  ActivityIndicator,
  AppState,
  Text,
  Keyboard,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// RNFirebase (modular v22+ style)
import { getApp } from '@react-native-firebase/app';
import {
  getMessaging,
  requestPermission,
  getToken,
  onMessage,
  onTokenRefresh,
  isDeviceRegisteredForRemoteMessages,
  registerDeviceForRemoteMessages,
  deleteToken as rnfbDeleteToken,
  onNotificationOpenedApp,
  getInitialNotification,
} from '@react-native-firebase/messaging';

import { requestAndroidPostNotifPermission } from './askNotifications';
import useScreen from './Hooks/useScreen';
import { getUserInfo, refreshAccessToken } from './apis/auth';
import { registerFCMToken, deleteFCMToken } from './apis/fcm';
import {
  initPush,
  showLocalNotification,
  setOnOpenNotification,
} from './PushNotificationConfig';

// ========== Screens ==========
import LoginScreen from './screens/auth/LoginScreen';
import ForgotPasswordScreen from './screens/ForgotPassword/ForgotPasswordScreen';
import ForgotPasswordStep2Screen from './screens/ForgotPassword/ForgotPasswordScreenStep2';
import ForgotPasswordStep3Screen from './screens/ForgotPassword/ForgotPasswordScreenStep3';
import MonitoringScreen from './screens/Home/MonitoringScreen';
import JourneyScreen from './screens/Home/JourneyScreen';
import DeviceScreen from './screens/Home/DeviceScreen';
import InformationScreen from './screens/Home/InformationScreen';
import BottomTabNavigation from './components/NavBottom/navBottom'; // hoặc './components/BottomTabNavigation'
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

// ========== Storage Keys ==========
const K_ACCESS = 'access_token';
const K_REFRESH = 'refresh_token';
const K_EXPIRES_AT = 'expires_at';
const K_NOTI_QUEUE = 'noti_queue';
const K_USERNAME = 'username';
const K_USER_OID = 'user_oid';

// ========= Auto Refresh (2h) =========
const LOOP_MS = 2 * 60 * 60 * 1000;
const MIN_GAP_MS = 60 * 1000;

let forceIntervalTimer = null;
let refreshInFlight = null;
let lastRefreshAt = 0;

function clearTokenTimers() {
  if (forceIntervalTimer) {
    clearInterval(forceIntervalTimer);
    forceIntervalTimer = null;
  }
}

async function doRefreshToken() {
  if (refreshInFlight) return refreshInFlight;
  if (Date.now() - lastRefreshAt < MIN_GAP_MS) return;

  refreshInFlight = (async () => {
    try {
      const refresh = await AsyncStorage.getItem(K_REFRESH);
      if (!refresh) return;
      console.log('🔄 Refreshing access token (loop/2h)…');

      const data = await refreshAccessToken(refresh);
      await AsyncStorage.multiSet([
        [K_ACCESS, data.access_token],
        [K_REFRESH, data.refresh_token || refresh],
      ]);

      lastRefreshAt = Date.now();
      console.log('✅ Refreshed OK (loop/2h).');
    } catch (e) {
      const msg = e?.message || '';
      console.log('❌ Refresh failed (loop/2h):', msg);
      if (/invalid_grant|invalid refresh|expired/i.test(msg)) {
        console.log('🚪 Refresh token invalid → force logout');
        await AsyncStorage.multiRemove([
          K_ACCESS,
          K_REFRESH,
          K_EXPIRES_AT,
          K_USER_OID,
          K_USERNAME,
        ]);
      }
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function startTwoHourRefreshLoop({ runNow = false } = {}) {
  clearTokenTimers();
  if (runNow) {
    try {
      await doRefreshToken();
    } catch {}
  }
  forceIntervalTimer = setInterval(async () => {
    try {
      await doRefreshToken();
    } catch {}
  }, LOOP_MS);
  console.log('🕒 Auto-refresh started: every 2h');
}

// Context share notifications
export const NotificationContext = React.createContext({
  notifications: [],
  setNotifications: () => {},
});

// ======= USER / OID =======
async function fetchUserOid(accessToken) {
  if (!accessToken) return '';
  try {
    const info = await getUserInfo(accessToken);
    const oid = info?.sub?.oid || '';
    if (oid) await AsyncStorage.setItem(K_USER_OID, oid);
    if (info?.username) await AsyncStorage.setItem(K_USERNAME, info.username);
    return oid;
  } catch (e) {
    console.log('⚠️ fetchUserOid error:', e?.message || e);
    return '';
  }
}

// ======= FCM REGISTER / UNREGISTER =======
async function handleFCMOnLogin(accessToken) {
  if (!accessToken) return;

  try {
    const msg = getMessaging(getApp());
    const fcmToken = await getToken(msg);
    if (!fcmToken) {
      console.log('⚠️ Không có FCM token để xử lý');
      return;
    }

    // Xoá map cũ
    const oldOid = await AsyncStorage.getItem(K_USER_OID);
    if (oldOid) {
      console.log('🧹 Xóa token mapping cũ cho user:', oldOid);
      try {
        await deleteFCMToken({ accessToken, userID: oldOid, token: fcmToken });
      } catch (e) {
        console.log('⚠️ Xóa token mapping cũ failed:', e?.message);
      }
    }

    // Lấy OID mới & đăng ký
    const newOid = await fetchUserOid(accessToken);
    if (!newOid) {
      console.log('⚠️ Không lấy được OID mới để register FCM');
      return;
    }

    console.log('✅ Register FCM token cho user mới:', newOid);
    await registerFCMToken({ accessToken, userID: newOid, token: fcmToken });
  } catch (e) {
    console.log('❌ handleFCMOnLogin error:', e?.message || e);
  }
}

async function unregisterFCMForCurrentUser() {
  try {
    const [accessToken, oid] = await Promise.all([
      AsyncStorage.getItem(K_ACCESS),
      AsyncStorage.getItem(K_USER_OID),
    ]);
    if (!accessToken || !oid) {
      console.log('⚠️ Không có access token hoặc OID để unregister FCM');
      return;
    }

    const msg = getMessaging(getApp());
    let fcmToken = '';
    try {
      fcmToken = await getToken(msg);
    } catch (e) {
      console.log('⚠️ Không lấy được FCM token:', e?.message);
    }

    if (fcmToken) {
      console.log('🗑️ Xóa FCM token mapping cho user:', oid);
      await deleteFCMToken({ accessToken, userID: oid, token: fcmToken });
    }

    try {
      await rnfbDeleteToken(msg);
      console.log('🗑️ Đã xóa FCM token trên device');
    } catch (e) {
      console.log('⚠️ Xóa FCM token trên device failed:', e?.message);
    }
  } catch (e) {
    console.log('⚠️ unregisterFCMForCurrentUser error:', e?.message || e);
  } finally {
    await AsyncStorage.multiRemove([K_USER_OID, K_USERNAME]);
  }
}

// ====== MAP MÀN → TAB CHA (để icon tab luôn highlight đúng) ======
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
  paymentConfirm:'Device'
};

// ========== App ==========
function App() {
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
  const [notifications, setNotifications] = useState([]);
  const [screenBusy, setScreenBusy] = useState({ active: false, text: '' });

  // 🔥 Loading overlay cho tác vụ nặng (logout)
  const [busy, setBusy] = useState({ active: false, text: '' });
  const busyRef = useRef(false);
  const showBusy = (text = 'Đang xử lý…') => {
    busyRef.current = true;
    setBusy({ active: true, text });
  };
  const hideBusy = () => {
    busyRef.current = false;
    setBusy({ active: false, text: '' });
  };

  const appStateRef = useRef('active');

  // 👇 Theo dõi bàn phím để ẩn/hiện nav
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
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // boot
  useEffect(() => {
    (async () => {
      try {
        const access = await AsyncStorage.getItem(K_ACCESS);
        if (access) {
          restoreSession('Monitoring');
          await handleFCMOnLogin(access);
          await startTwoHourRefreshLoop({ runNow: false });
        }
      } catch (e) {
        console.warn('Auto login failed:', e?.message || e);
      } finally {
        setBooting(false);
      }
    })();
  }, []);

  // hút queue noti (background handler đã ghi)
  const drainQueuedNotifications = async () => {
    try {
      const raw = (await AsyncStorage.getItem(K_NOTI_QUEUE)) || '[]';
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length) {
        const mapped = arr.map(n => ({
          ...n,
          createdAt: new Date(n.createdAt),
          isRead: n.isRead || false,
        }));
        setNotifications(prev => [...mapped, ...prev]);
        await AsyncStorage.setItem(K_NOTI_QUEUE, '[]');
      }
    } catch {}
  };

  // khi app active lại
  useEffect(() => {
    const sub = AppState.addEventListener('change', async next => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        next === 'active'
      ) {
        await drainQueuedNotifications();
        setTimeout(() => {
          doRefreshToken().catch(() => {});
        }, 5000);
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, []);

  // Local notification: tap -> mở màn notification
  useEffect(() => {
    initPush();
    setOnOpenNotification(() => {
      navigateToScreen('notification', { from: currentScreen });
    });
  }, [navigateToScreen, currentScreen]);

  // Remote notification: tap từ background/quit
  useEffect(() => {
    let unsubOpened;
    const wireOpenHandlers = async () => {
      const app = getApp();
      const msg = getMessaging(app);

      unsubOpened = onNotificationOpenedApp(msg, remoteMessage => {
        console.log('📬 Opened from background:', JSON.stringify(remoteMessage));
        navigateToScreen('notification', { from: currentScreen });
      });

      const initial = await getInitialNotification(msg);
      if (initial) {
        console.log('🚀 Launched from notification:', JSON.stringify(initial));
        navigateToScreen('notification', { from: currentScreen || 'Information' });
      }
    };

    wireOpenHandlers();
    return () => {
      if (typeof unsubOpened === 'function') unsubOpened();
    };
  }, [navigateToScreen, currentScreen]);

  // ==== FCM init (foreground + token refresh) ====
  useEffect(() => {
    let unsubFG, unsubRefresh;

    const init = async () => {
      const app = getApp();
      const msg = getMessaging(app);

      const authStatus = await requestPermission(msg);
      console.log('🔐 iOS permission status:', authStatus);

      try {
        const registered = await isDeviceRegisteredForRemoteMessages(msg);
        console.log('📡 device registered?', registered);
        if (!registered) await registerDeviceForRemoteMessages(msg);
      } catch (e) {
        console.log('📡 registerDevice error:', e?.message);
      }

      const granted = await requestAndroidPostNotifPermission();
      console.log('🔔 Android POST_NOTIFICATIONS granted?', granted);

      const token = await getToken(msg);
      console.log('📲 FCM Token:', token);

      // Foreground messages
      unsubFG = onMessage(msg, async rm => {
        console.log('🔥 FG message:', JSON.stringify(rm));
        const now = new Date();
        const noti = {
          id: String(now.getTime()),
          createdAt: now,
          title: rm.notification?.title || 'Thông báo',
          message: rm.notification?.body || JSON.stringify(rm.data || {}),
          isRead: false,
        };
        showLocalNotification(noti.title, noti.message);
        setNotifications(prev => [noti, ...prev]);
      });

      // Token refresh
      unsubRefresh = onTokenRefresh(msg, async () => {
        try {
          const accessToken = await AsyncStorage.getItem(K_ACCESS);
          if (accessToken) await handleFCMOnLogin(accessToken);
        } catch (e) {
          console.log('⚠️ Token refresh handling error:', e?.message);
        }
      });

      await drainQueuedNotifications();
    };

    init();
    return () => {
      if (typeof unsubFG === 'function') unsubFG();
      if (typeof unsubRefresh === 'function') unsubRefresh();
    };
  }, []);

  // ===== WRAP LOGIN/LOGOUT =====
  const handleLogin = async (userData = null) => {
    login(userData);
    try {
      const accessToken = await AsyncStorage.getItem(K_ACCESS);
      if (accessToken) {
        await handleFCMOnLogin(accessToken);
        await startTwoHourRefreshLoop({ runNow: false });
      }
    } catch (e) {
      console.log('⚠️ Login FCM/refresh handling error:', e?.message);
    }
  };

  const handleLogout = async () => {
    if (busyRef.current) return; // chống double tap
    showBusy('Đang đăng xuất…');

    try {
      clearTokenTimers();
      await unregisterFCMForCurrentUser();
      await AsyncStorage.multiRemove([
        K_ACCESS,
        K_REFRESH,
        K_EXPIRES_AT,
        K_USER_OID,
        K_USERNAME,
      ]);
    } catch (e) {
      console.log('⚠️ Logout error:', e?.message || e);
    } finally {
      logout();
      setNotifications([]);
      hideBusy();
    }
  };

  // 🟡 Ẩn nav chỉ ở các màn auth/fullscreen thực sự cần ẩn
  const screensWithoutBottomNav = [
    'Login',
    'ForgotPassword',
    'forgotStep2',
    'forgotStep3',
    'changeInfo',
    'AddDevices'
  ];

  const renderCurrentScreen = () => {
    switch (currentScreen) {
      case 'Login':
        return (
          <LoginScreen
            navigateToScreen={navigateToScreen}
            login={handleLogin}
          />
        );
      case 'ForgotPassword':
        return (
          <ForgotPasswordScreen
            goBack={goBack}
            navigateToScreen={navigateToScreen}
            screenData={screenData}
          />
        );
      case 'forgotStep2':
        return (
          <ForgotPasswordStep2Screen
            goBack={goBack}
            navigateToScreen={navigateToScreen}
            screenData={screenData}
          />
        );
      case 'forgotStep3':
        return (
          <ForgotPasswordStep3Screen
            goBack={goBack}
            navigateToScreen={navigateToScreen}
            screenData={screenData}
          />
        );
      case 'Monitoring':
        return (
          <MonitoringScreen
            logout={handleLogout}
            navigateToScreen={navigateToScreen}
          />
        );
      case 'devicesInfo':
        return (
          <DevicesInfo
            logout={handleLogout}
            navigateToScreen={navigateToScreen}
            screenData={screenData}
          />
        );
      case 'notification':
        return (
          <Notification
            navigateToScreen={navigateToScreen}
            screenData={screenData}
          />
        );
      case 'paymentConfirm':
        return (
          <PaymentConfirm
            navigateToScreen={navigateToScreen}
            screenData={screenData}
          />
        );
      case 'orderDetail':
        return (
          <OrderDetail
            order={screenData?.order}
            navigateToScreen={navigateToScreen}
            device={screenData?.device}
          />
        );
      case 'Journey':
        return (
          <JourneyScreen
            logout={handleLogout}
            navigateToScreen={navigateToScreen}
            setAppBusy={setScreenBusy}
          />
        );
      case 'extend':
        return (
          <Extend
            logout={handleLogout}
            navigateToScreen={navigateToScreen}
            screenData={screenData}
          />
        );
      case 'companyInfo':
        return (
          <CompanyInfo
            logout={handleLogout}
            navigateToScreen={navigateToScreen}
          />
        );
      case 'changePassword':
        return <ChangePassword navigateToScreen={navigateToScreen} />;
      case 'Device':
        return (
          <DeviceScreen
            logout={handleLogout}
            navigateToScreen={navigateToScreen}
          />
        );
      case 'phoneUser':
        return (
          <PhoneUser
            screenData={screenData}
            navigateToScreen={navigateToScreen}
          />
        );
      case 'historyExtend':
        return (
          <HistoryExtend
            logout={handleLogout}
            navigateToScreen={navigateToScreen}
            screenData={screenData}
          />
        );
      case 'AddDevices':
        return (
          <AddDevices
            navigateToScreen={navigateToScreen}
            screenData={screenData}
          />
        );
      case 'Information':
        return (
          <InformationScreen
            changeInfo={changeInfo}
            logout={handleLogout}
            screenData={screenData}
            navigateToScreen={navigateToScreen}
          />
        );
      case 'changeInfo':
        return (
          <ChangeInfo
            logout={handleLogout}
            screenData={screenData}
            navigateToScreen={navigateToScreen}
          />
        );
      case 'activeDevices':
        return (
          <ActiveDevicesScreen
            screenData={screenData}
            navigateToScreen={navigateToScreen}
          />
        );
      default:
        return (
          <LoginScreen
            navigateToScreen={navigateToScreen}
            login={handleLogin}
          />
        );
    }
  };

  if (booting) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  }

  // 🔵 Tính tab đang active & quyết định ẩn/hiện nav
  const currentTab = SCREEN_TO_TAB[currentScreen] || 'Monitoring';
  const hideTab = kbVisible || screensWithoutBottomNav.includes(currentScreen);

  return (
    <NotificationContext.Provider value={{ notifications, setNotifications }}>
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#1e88e5" />
        {renderCurrentScreen()}

        {/* Nav dưới: luôn hiện, trừ khi hideTab = true */}
        {!hideTab && (
          <BottomTabNavigation
            currentScreen={currentTab}     // 👈 dùng tab đã map để highlight đúng
            navigateToScreen={navigateToScreen}
          />
        )}

        {/* Overlay loading toàn màn */}
        {busy.active && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.overlayText}>{busy.text || 'Đang xử lý…'}</Text>
          </View>
        )}
      </View>
    </NotificationContext.Provider>
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
  overlayText: {
    color: '#fff',
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;
