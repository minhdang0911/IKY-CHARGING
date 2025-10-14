// screens/Home/CompanyInfoScreen.jsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  Image,
  Linking,
  SafeAreaView,
  Text,
  TouchableOpacity,
  View,
  BackHandler,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Logo from '../../assets/img/logoky.png';

const PRIMARY = '#2563eb';
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
    contact: 'Liên hệ nhanh',
    call: 'Gọi CSKH',
    mail: 'Gửi email',
    openSite: 'Mở website',
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
    companyNameLine2: 'TECHNOLOGY JSC',
    contact: 'Quick contact',
    call: 'Call support',
    mail: 'Send email',
    openSite: 'Open website',
  },
};

const CompanyInfoScreen = ({ navigateToScreen, navigation }) => {
  const [language, setLanguage] = useState('vi');
  const t = (k) => STRINGS[language][k] || k;
  const { height, width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (saved) setLanguage(saved);
      } catch {}
    })();
  }, []);

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

  const openMap = (address) => {
    const query = encodeURIComponent(address);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url).catch(() => {});
  };

  const openWebsite = (url) => {
    Linking.openURL(url).catch(() => {});
  };

  const openTel = (tel) => Linking.openURL(`tel:${tel}`).catch(() => {});
  const openMail = (to) => Linking.openURL(`mailto:${to}`).catch(() => {});

  const InfoRow = ({ icon, label, value, onPress, isLink }) => (
    <TouchableOpacity
      activeOpacity={onPress ? 0.9 : 1}
      onPress={onPress}
      style={s.row}
    >
      <View style={s.rowIconBox}>
        <Icon name={icon} size={20} color={PRIMARY} />
      </View>
      <View style={s.rowTextWrap}>
        <Text style={s.rowLabel}>{label}</Text>
        <Text
          style={[s.rowValue, isLink && { textDecorationLine: 'underline', color: PRIMARY }]}
          numberOfLines={2}
          ellipsizeMode="tail"
        >
          {value}
        </Text>
      </View>
      {onPress ? <Icon name="chevron-right" size={22} color="#a3aec2" /> : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.container}>
      {/* Header minimal */}
      <View style={s.header}>
        <TouchableOpacity onPress={handleBackPress} style={s.backBtn}>
          <Text style={{ fontSize: 28, color: 'white' }}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('headerTitle')}</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Content */}
      <View style={[s.page, { minHeight: height - 72 }]}>
        <View style={[s.grid, isDesktop && s.gridDesktop]}>
          {/* Brand card */}
          <View style={s.brandCard}>
            <Image source={Logo} style={s.logo} resizeMode="contain" />
            <Text style={s.companyName}>
              {t('companyNameLine1')}
              {'\n'}
              {t('companyNameLine2')}
            </Text>

            <View style={s.stats}>
              <View style={s.statItem}>
                <Text style={s.statVal}>99.99%</Text>
                <Text style={s.statLbl}>uptime</Text>
              </View>
              <View style={s.sep} />
              <View style={s.statItem}>
                <Text style={s.statVal}>24/7</Text>
                <Text style={s.statLbl}>support</Text>
              </View>
              <View style={s.sep} />
              <View style={s.statItem}>
                <Text style={s.statVal}>1.127</Text>
                <Text style={s.statLbl}>{t('version')}</Text>
              </View>
            </View>
          </View>

          {/* Info + actions */}
          <View style={s.infoCard}>
            <InfoRow
              icon="business"
              label={t('hq')}
              value="13 Đường số 23A, P. Bình Trị Đông B, Q. Bình Tân, TP HCM"
              onPress={() => openMap('13 Đường số 23A, P. Bình Trị Đông B, Q. Bình Tân, TP HCM')}
            />
            <View style={s.divider} />
            <InfoRow
              icon="business"
              label={t('hcm')}
              value="38-40 Đường 21A, P. An Lạc, TP. Hồ Chí Minh"
              onPress={() => openMap('38-40 Đường 21A, P. An Lạc, TP. Hồ Chí Minh')}
            />
            <View style={s.divider} />
            <InfoRow
              icon="business"
              label={t('hn')}
              value="80 Đường Hạ Yên Quyết, P. Yên Hòa, Q. Cầu Giấy, Hà Nội"
              onPress={() => openMap('80 Đường Hạ Yên Quyết, P. Yên Hòa, Q. Cầu Giấy, Hà Nội')}
            />
            <View style={s.divider} />
            <InfoRow
              icon="language"
              label={t('website')}
              value="https://iky.vn"
              onPress={() => openWebsite('https://iky.vn')}
              isLink
            />
            <View style={s.divider} />
            <InfoRow icon="info" label={t('version')} value="1.127 Release" />

            {/* Quick actions */}
            <Text style={s.sectionTitle}>{t('contact')}</Text>
            <View style={s.actions}>
              <TouchableOpacity style={s.actionBtn} onPress={() => openTel('0902806999')} activeOpacity={0.9}>
                <Icon name="call" size={18} color="#fff" />
                <Text style={s.actionText}>{t('call')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtnGhost} onPress={() => openMail('support@iky.vn')} activeOpacity={0.9}>
                <Icon name="mail" size={18} color={PRIMARY} />
                <Text style={s.actionTextGhost}>{t('mail')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionBtnGhost} onPress={() => openWebsite('https://iky.vn')} activeOpacity={0.9}>
                 
                <Text style={s.actionTextGhost}>{t('openSite')}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.closeGhost} onPress={handleBackPress} activeOpacity={0.9}>
              <Text style={s.closeGhostText}>{t('close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default CompanyInfoScreen;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#4A90E2',
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' ,color: 'white'},
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '800', color: 'white' },

  page: { flex: 1, paddingHorizontal: 16, paddingVertical: 16 },
  grid: { width: '100%', maxWidth: 1100, alignSelf: 'center' },
  gridDesktop: { flexDirection: 'row', gap: 20 },

  brandCard: {
    flex: 1,
    backgroundColor: '#eef2ff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e0e7ff',
    marginBottom: 16,
  },
  logo: { width: 86, height: 86, marginBottom: 10 },
  companyName: { fontSize: 18, fontWeight: '800', color: '#0f172a' },

  stats: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1, borderColor: '#e5e7eb',
  },
  statItem: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  statVal: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  statLbl: { fontSize: 12, color: '#64748b' },
  sep: { width: 1, height: 28, backgroundColor: '#e5e7eb', marginHorizontal: 8 },

  infoCard: {
    flex: 1.2,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1, borderColor: '#e5e7eb',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 },
  },

row: {
  flexDirection: 'row',
  alignItems: 'flex-start', // 🟢 fix chữ không bị dọc
  flexWrap: 'wrap',         // 🟢 cho phép xuống dòng khi nhỏ
  paddingVertical: 10,
},

  rowIconBox: {
  width: 36, height: 36, borderRadius: 8,
  backgroundColor: '#eff6ff',
  alignItems: 'center', justifyContent: 'center',
  marginRight: 10,
  borderWidth: 1, borderColor: '#e0f2fe',
  alignSelf: 'flex-start', // 🟢 giữ icon top align
},

  rowTextWrap: { flex: 1 },
  rowLabel: { fontSize: 12, color: '#64748b' },
  rowValue: { fontSize: 14.5, color: '#0f172a', fontWeight: '600', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#eef2f7' },

  sectionTitle: { marginTop: 14, marginBottom: 8, fontSize: 13, fontWeight: '800', color: '#334155' },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
  },
  actionText: { color: '#fff', fontWeight: '800' },
  actionBtnGhost: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#eef2ff', borderColor: '#dbeafe', borderWidth: 1,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14,
  },
  actionTextGhost: { color: PRIMARY, fontWeight: '800' },

  closeGhost: {
    marginTop: 12, alignSelf: 'flex-start',
    paddingVertical: 8, paddingHorizontal: 10,
  },
  closeGhostText: { color: '#64748b', textDecorationLine: 'underline', fontWeight: '600' },
});
