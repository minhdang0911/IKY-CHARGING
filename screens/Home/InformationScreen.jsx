// screens/Home/InformationScreen.jsx (PNG icons, no MaterialIcons)
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  SafeAreaView,
  ScrollView,
  Linking,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logoInfo from '../../assets/img/background.png';
import { API_URL } from '@env';

// PNG icons
import icPerson from '../../assets/img/cskh.png';
import icPhone from '../../assets/img/ic_phone.png';
import icSupport from '../../assets/img/ic_support.png';
import icAccount from '../../assets/img/ic_account.png';
import icInfo from '../../assets/img/company.png';
import icLock from '../../assets/img/ic_lock.png';
import icLogout from '../../assets/img/ic_logout.png';
import icChevronRight from '../../assets/img/ic_chevron_right.png';
import icBell from '../../assets/img/ic_bell.png';

const LANG_KEY = 'app_language';

const STRINGS = {
  vi: {
    headerTitle: 'Thông tin',
    cs: 'Chăm sóc khách hàng',
    tech: 'Hỗ trợ kỹ thuật',
    accountInfo: 'Thông tin tài khoản',
    manufacturerInfo: 'Thông tin nhà sản xuất',
    changePassword: 'Đổi mật khẩu',
    logout: 'Đăng xuất',
  },
  en: {
    headerTitle: 'Information',
    cs: 'Customer Support',
    tech: 'Technical Support',
    accountInfo: 'Account information',
    manufacturerInfo: 'Manufacturer information',
    changePassword: 'Change password',
    logout: 'Log out',
  },
};

const openTel = phone => {
  const url = `tel:${phone.replace(/\\s/g, '')}`;
  Linking.openURL(url).catch(() => {});
};

export default function InformationScreen({ logout, navigateToScreen }) {
  const [language, setLanguage] = useState('vi');
  const t = k => STRINGS[language][k] || k;

  // 🔕 Không còn context → badge = 0, chỉ điều hướng sang màn notification
  const unreadCount = 0;
  const handleNotificationPress = () => {
    navigateToScreen('notification', { from: 'Information' });
  };

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (saved) setLanguage(saved);
      } catch {}
    })();
  }, []);

  async function handleLogoutPress() {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (token) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    } finally {
      await AsyncStorage.multiRemove([
        'access_token',
        'refresh_token',
        'expires_at',
        'user_oid',
        'username',
      ]);
      logout && logout();
    }
  }

  return (
    <SafeAreaView style={styles.wrap}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('headerTitle')}</Text>

        {/* Nếu cần bật lại notification button */}
        {/*
        <TouchableOpacity style={styles.headerBtn} onPress={handleNotificationPress}>
          <View style={styles.notificationContainer}>
            <Image source={icBell} style={{ width: 24, height: 24, tintColor: '#fff' }} />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
        */}
      </View>

      {/* Nội dung chính có thể scroll */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* để trống — sau chèn thêm gì thì chèn */}
      </ScrollView>

      {/* Khung tính năng luôn nằm ngay trên nav */}
      <View style={styles.featureWrap}>
        {/* Banner */}
        <View style={styles.bannerCard}>
          <Image source={logoInfo} style={styles.bannerImg} />
        </View>

        {/* Contact */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => openTel('0902 806 999')}
            activeOpacity={0.9}
          >
            <Image source={icPerson} style={{ width: 20, height: 20, tintColor: '#666' }} />
            <View style={styles.contactText}>
              <Text style={styles.contactLabel}>{t('cs')}</Text>
              <Text style={styles.contactPhone}>0902 806 999</Text>
            </View>
            <Image source={icPhone} style={{ width: 20, height: 20, tintColor: '#1e88e5' }} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => openTel('0938 859 085')}
            activeOpacity={0.9}
          >
            <Image source={icSupport} style={{ width: 20, height: 20, tintColor: '#666' }} />
            <View style={styles.contactText}>
              <Text style={styles.contactLabel}>{t('tech')}</Text>
              <Text style={styles.contactPhone}>0938 859 085</Text>
            </View>
            <Image source={icPhone} style={{ width: 20, height: 20, tintColor: '#1e88e5' }} />
          </TouchableOpacity>
        </View>

        {/* Menu */}
        <View style={styles.card}>
          <MenuItem
            icon={icAccount}
            text={t('accountInfo')}
            onPress={() => navigateToScreen('changeInfo')}
          />
          <View style={styles.divider} />
          <MenuItem
            icon={icInfo}
            text={t('manufacturerInfo')}
            onPress={() => navigateToScreen('companyInfo')}
          />
          <View style={styles.divider} />
          <MenuItem
            icon={icLock}
            text={t('changePassword')}
            onPress={() => navigateToScreen('changePassword')}
          />
          <View style={styles.divider} />
          <MenuItem icon={icLogout} text={t('logout')} onPress={handleLogoutPress} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const MenuItem = ({ icon, text, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.menuLeft}>
      <Image source={icon} style={{ width: 20, height: 20, tintColor: '#666' }} />
      <Text style={styles.menuText}>{text}</Text>
    </View>
    <Image source={icChevronRight} style={{ width: 18, height: 18, tintColor: '#bbb' }} />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f5f5f5' },

  header: {
    backgroundColor: '#1e88e5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 16 : 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600', flex: 1 },
  headerBtn: { padding: 6 },

  notificationContainer: { position: 'relative' },
  badge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ff4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  scrollContent: {
    padding: 14,
    paddingBottom: 20,
  },

  featureWrap: {
    padding: 14,
    backgroundColor: '#f5f5f5',
  },

  bannerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#90CAF9',
    marginBottom: 14,
  },
  bannerImg: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
    marginTop:10
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#90CAF9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  contactText: { flex: 1, marginLeft: 12 },
  contactLabel: { fontSize: 13, color: '#666', marginBottom: 2 },
  contactPhone: { fontSize: 16, fontWeight: '700', color: '#00bcd4' },
  divider: { height: 1, backgroundColor: '#eee' },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
});
