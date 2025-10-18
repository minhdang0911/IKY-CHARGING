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
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logoInfo from '../../assets/img/background.png';
import { API_URL } from '@env';
import iconscompany from '../../assets/img/company.png';
import iconscskh from '../../assets/img/cskh.png';
import iconsright from '../../assets/img/ic_chevron_right.png';

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

const openTel = (phone) => {
  const url = `tel:${phone.replace(/\s/g, '')}`;
  Linking.openURL(url).catch(() => {});
};

export default function InformationScreen({ logout, navigateToScreen }) {
  const [language, setLanguage] = useState('vi');
  const t = (k) => STRINGS[language][k] || k;

  const { width } = useWindowDimensions();
  const isSmall = width <= 400;
  const isMedium = width <= 480;
  const PH = isSmall ? 12 : isMedium ? 20 : 32;
  const bannerHeight = isSmall ? 180 : isMedium ? 240 : 280;

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (saved) setLanguage(saved);
      } catch {}
    })();
  }, []);

  async function handleLogoutPress() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const [accessToken, refreshToken] = await Promise.all([
        AsyncStorage.getItem('access_token'),
        AsyncStorage.getItem('refresh_token'),
      ]);

      if (accessToken) {
        await fetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ accessToken, refreshToken }),
          signal: controller.signal,
        }).catch(() => {});
      }
    } finally {
      clearTimeout(timeoutId);
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
      <View style={[styles.header, { paddingHorizontal: PH }]}>
        <Text style={styles.headerTitle}>{t('headerTitle')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingHorizontal: PH, alignItems: 'stretch', paddingBottom: 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.bannerCard}>
          <Image
            source={logoInfo}
            style={[styles.bannerImg, { height: bannerHeight }]}
            resizeMode="contain"
          />
          <Text style={styles.bannerText}>
            TRẠM SẠC XANH • TIỆN LỢI • HIỆN ĐẠI
          </Text>
        </View>

        {/* Contact Card */}
        <View style={styles.card}>
          <View style={styles.contactRow}>
            <Image source={iconscskh} style={styles.contactImgLeft} resizeMode="contain" />
            <View style={styles.contactText}>
              <Text style={styles.contactLabel}>{t('cs')}</Text>
              <Text style={styles.contactPhone} onPress={() => openTel('0902 806 999')}>
                0902 806 999
              </Text>
            </View>
            <TouchableOpacity onPress={() => openTel('0902 806 999')}>
              <Icon name="phone" size={22} color="#1e88e5" style={styles.contactIconRight} />
            </TouchableOpacity>
          </View>

          <View style={styles.divider} />

          <View style={styles.contactRow}>
            <Image source={iconscompany} style={styles.contactImgLeft} resizeMode="contain" />
            <View style={styles.contactText}>
              <Text style={styles.contactLabel}>{t('tech')}</Text>
              <Text style={styles.contactPhone} onPress={() => openTel('0938 859 085')}>
                0938 859 085
              </Text>
            </View>
            <TouchableOpacity onPress={() => openTel('0938 859 085')}>
              <Icon name="phone" size={22} color="#1e88e5" style={styles.contactIconRight} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Menu Card */}
        <View style={styles.card}>
          <MenuItem
            icon="info"
            text={t('accountInfo')}
            onPress={() => navigateToScreen('changeInfo')}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="info"
            text={t('manufacturerInfo')}
            onPress={() => navigateToScreen('companyInfo')}
          />
          <View style={styles.divider} />
          <MenuItem
            icon="lock"
            text={t('changePassword')}
            onPress={() => navigateToScreen('changePassword')}
          />
          <View style={styles.divider} />
          <MenuItem icon="logout" text={t('logout')} onPress={handleLogoutPress} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const MenuItem = ({ icon, text, onPress }) => (
  <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.8}>
    <View style={styles.menuLeft}>
      <Icon name={icon} size={22} color="#666" style={styles.menuIcon} />
      <Text style={styles.menuText}>{text}</Text>
    </View>
    {/* ✅ đổi chevron-right sang ảnh */}
    <Image source={iconsright} style={styles.rightImg} resizeMode="contain" />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    backgroundColor: '#1e88e5',
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  scrollContent: {
    paddingVertical: 30,
    alignItems: 'stretch',
  },
  bannerCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: '#90CAF9',
    marginBottom: 30,
    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
  },
  bannerImg: {
    width: '100%',
    alignSelf: 'center',
  },
  bannerText: {
    textAlign: 'center',
    paddingVertical: 14,
    color: '#1e88e5',
    fontSize: 17,
    fontWeight: '600',
    backgroundColor: '#E3F2FD',
  },
  card: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#cfd8dc',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 20,
    boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  contactImgLeft: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  contactIconRight: {
    flexShrink: 0,
    width: 28,
    textAlign: 'center',
    verticalAlign: 'middle',
  },
  contactText: {
    flex: 1,
    marginHorizontal: 12,
    justifyContent: 'center',
    minWidth: 0,
  },
  contactLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  contactPhone: {
    fontSize: 18,
    fontWeight: '700',
    color: '#00bcd4',
  },
  divider: { height: 1, backgroundColor: '#eee', marginVertical: 8 },

  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    justifyContent: 'space-between',
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  menuIcon: {
    width: 24,
    textAlign: 'center',
    marginRight: 10,
    verticalAlign: 'middle',
  },
  menuText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    lineHeight: 22,
  },
  // ✅ ảnh mũi tên phải
  rightImg: {
    width: 18,
    height: 18,
    marginLeft: 8,
    opacity: 0.7,         // giống màu #bbb của icon cũ
  },
  iconFix: { verticalAlign: 'middle' },
});
