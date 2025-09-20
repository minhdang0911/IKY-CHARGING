// screens/Home/CompanyInfoScreen.jsx
import Logo from '../../assets/img/logoky.png';
import React, { useEffect, useState, useContext, useCallback } from 'react';
import {
  Image,
  Linking,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
  BackHandler,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles, { PRIMARY } from './CompanyStyles';
import { NotificationContext } from '../../App';

const LANG_KEY = 'app_language';

const STRINGS = {
  vi: {
    headerTitle: 'Thông tin',
    hq: 'Trụ sở',
    hcm: 'Văn phòng HCM',
    hn: 'Văn phòng HN',
    website: 'Website',
    version: 'Phiên bản',
    close: 'Đóng',
    companyNameLine1: 'CÔNG TY CỔ PHẦN CÔNG NGHỆ',
    companyNameLine2: 'TIỆN ÍCH THÔNG MINH',
  },
  en: {
    headerTitle: 'Information',
    hq: 'Headquarters',
    hcm: 'HCM Office',
    hn: 'Hanoi Office',
    website: 'Website',
    version: 'Version',
    close: 'Close',
    companyNameLine1: 'SMART UTILITY',
    companyNameLine2: 'TECHNOLOGY JOINT STOCK COMPANY',
  },
};

const CompanyInfoScreen = ({ navigateToScreen, navigation }) => {
  const [language, setLanguage] = useState('vi');
  const ctx = useContext(NotificationContext) || {};
  const notifications = Array.isArray(ctx.notifications) ? ctx.notifications : [];
  const setNotifications =
    typeof ctx.setNotifications === 'function' ? ctx.setNotifications : () => {};
  const unreadCount = notifications.reduce((acc, n) => acc + (n?.isRead ? 0 : 1), 0);

  const t = (k) => STRINGS[language][k] || k;

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (saved) setLanguage(saved);
      } catch {}
    })();
  }, []);

  const handleNotificationPress = () => {
    setNotifications((prev) => (Array.isArray(prev) ? prev.map((n) => ({ ...n, isRead: true })) : []));
    navigateToScreen && navigateToScreen('notification', { from: 'companyInfo' });
  };

  const openMap = (address) => {
    const query = encodeURIComponent(address);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url).catch(() => {});
  };

  const openWebsite = (url) => {
    Linking.openURL(url).catch(() => {});
  };

  // === BACK HANDLERS ===
  const handleBackPress = useCallback(() => {
    navigateToScreen && navigateToScreen('Information');
    return true;
  }, [navigateToScreen]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => sub.remove();
  }, [handleBackPress]);

  useEffect(() => {
    if (!navigation || typeof navigation.addListener !== 'function') return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      handleBackPress();
    });
    return unsub;
  }, [navigation, handleBackPress]);

  // Row component gọn
  const InfoRow = ({ icon, label, value, onPress, isLink }) => (
    <TouchableOpacity activeOpacity={onPress ? 0.9 : 1} onPress={onPress} style={styles.row}>
      <View style={styles.rowIconBox}>
        <Icon name={icon} size={18} color={PRIMARY} />
      </View>
      <View style={styles.rowTextWrap}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text
          style={[styles.rowValue, isLink && { textDecorationLine: 'underline', color: PRIMARY }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {value}
        </Text>
      </View>
      {onPress ? <Icon name="chevron-right" size={22} color="#98a2b3" /> : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('headerTitle')}</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={handleNotificationPress}>
          <View style={styles.notificationContainer}>
            <Icon name="notifications" size={22} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Body (no scroll, fit 1 màn) */}
      <View style={styles.bodyStatic}>
        {/* Logo + tên công ty */}
        <View style={styles.cardCenter}>
          <Image source={Logo} style={styles.logo} resizeMode="contain" />
          <Text style={styles.companyName}>
            {t('companyNameLine1')}{'\n'}{t('companyNameLine2')}
          </Text>
        </View>

        {/* Details */}
        <View style={styles.cardList}>
          <InfoRow
            icon="business"
            label={t('hq')}
            value="13 Đường số 23A, P. Bình Trị Đông B, Q. Bình Tân, TP HCM"
            onPress={() => openMap('13 Đường số 23A, P. Bình Trị Đông B, Q. Bình Tân, TP HCM')}
          />
          <View style={styles.divider} />
          <InfoRow
            icon="business"
            label={t('hcm')}
            value="38-40 Đường 21A, P. An Lạc, TP. Hồ Chí Minh"
            onPress={() => openMap('38-40 Đường 21A, P. An Lạc, TP. Hồ Chí Minh')}
          />
          <View style={styles.divider} />
          <InfoRow
            icon="business"
            label={t('hn')}
            value="80 Đường Hạ Yên Quyết, P. Yên Hòa, Q. Cầu Giấy, Hà Nội"
            onPress={() => openMap('80 Đường Hạ Yên Quyết, P. Yên Hòa, Q. Cầu Giấy, Hà Nội')}
          />
          <View style={styles.divider} />
          <InfoRow
            icon="language"
            label={t('website')}
            value="https://iky.vn"
            onPress={() => openWebsite('https://iky.vn')}
            isLink
          />
          <View style={styles.divider} />
          <InfoRow icon="info" label={t('version')} value="1.127 Release" />
        </View>

        {/* Close */}
        <TouchableOpacity style={styles.ghostBtn} onPress={handleBackPress} activeOpacity={0.9}>
          <Text style={styles.ghostBtnText}>{t('close')}</Text>
        </TouchableOpacity>

        {/* spacing nhỏ cho safe area */}
        <View style={{ height: Platform.OS === 'ios' ? 4 : 8 }} />
      </View>
    </SafeAreaView>
  );
};

export default CompanyInfoScreen;
