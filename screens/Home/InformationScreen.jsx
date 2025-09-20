// screens/Home/InformationScreen.jsx
import React, { useEffect, useState, useContext } from 'react';
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
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import logoInfo from '../../assets/img/ic_infor_fragment.png';
import { NotificationContext } from '../../App';

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
  const url = `tel:${phone.replace(/\s/g, '')}`;
  Linking.openURL(url).catch(() => {});
};

export default function InformationScreen({ logout, navigateToScreen }) {
  const [language, setLanguage] = useState('vi');
  const { notifications, setNotifications } = useContext(NotificationContext);
  const t = k => STRINGS[language][k] || k;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotificationPress = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
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

  return (
    <SafeAreaView style={styles.wrap}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('headerTitle')}</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={handleNotificationPress}
        >
          <View style={styles.notificationContainer}>
            <Icon name="notifications" size={24} color="#fff" />
            {unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {/* Nội dung chính có thể scroll */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* chèn thêm nội dung khác ở đây nếu có */}
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
          >
            <Icon name="person" size={20} color="#666" />
            <View style={styles.contactText}>
              <Text style={styles.contactLabel}>{t('cs')}</Text>
              <Text style={styles.contactPhone}>0902 806 999</Text>
            </View>
            <Icon name="phone" size={20} color="#1e88e5" />
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity
            style={styles.contactRow}
            onPress={() => openTel('0938 859 085')}
          >
            <Icon name="support-agent" size={20} color="#666" />
            <View style={styles.contactText}>
              <Text style={styles.contactLabel}>{t('tech')}</Text>
              <Text style={styles.contactPhone}>0938 859 085</Text>
            </View>
            <Icon name="phone" size={20} color="#1e88e5" />
          </TouchableOpacity>
        </View>

        {/* Menu */}
        <View style={styles.card}>
          <MenuItem
            icon="account-circle"
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
          <MenuItem icon="logout" text={t('logout')} onPress={logout} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const MenuItem = ({ icon, text, onPress }) => (
  <TouchableOpacity
    style={styles.menuItem}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <View style={styles.menuLeft}>
      <Icon name={icon} size={20} color="#666" />
      <Text style={styles.menuText}>{text}</Text>
    </View>
    <Icon name="chevron-right" size={22} color="#bbb" />
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
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14, // bo góc nhỏ hơn
    borderWidth: 1.2, // viền mảnh hơn
    borderColor: '#90CAF9',
    paddingHorizontal: 10, // padding ít lại
    paddingVertical: 6, // thu gọn chiều cao
    marginBottom: 10, // khoảng cách giữa các card cũng nhỏ lại
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
    paddingVertical: 10, // giảm từ 14 xuống 10
    justifyContent: 'space-between',
  },
  menuLeft: { flexDirection: 'row', alignItems: 'center' },
  menuText: {
    marginLeft: 10,
    fontSize: 15, // giữ nguyên size chữ
    color: '#333',
    fontWeight: '500', // cho chữ đậm hơn chút nhìn cân card nhỏ
  },
});
