// screens/Home/CompanyInfoScreen.jsx
import Logo from '../../assets/img/logoky.png';
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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import styles, { PRIMARY } from './CompanyStyles';

// PNG icons (style tòa nhà iKY + website + chevron)
import icBack from '../../assets/img/ic_back.png';
import icHQ from '../../assets/img/IKY_white.png';                 
import icOfficeHCM from '../../assets/img/IKY_HCM_white.png';  
import icOfficeHN from '../../assets/img/IKY_HN_white.png';   
import icWebsite from '../../assets/img/ic_website.png';     
import icInfo from '../../assets/img/ic_infoo.png';         
import icChevronRight from '../../assets/img/ic_chevron_rightttt.png';

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
  const t = (k) => STRINGS[language][k] || k;

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (saved) setLanguage(saved);
      } catch {}
    })();
  }, []);

  const openMap = (address) => {
    const query = encodeURIComponent(address);
    const url = `https://www.google.com/maps/search/?api=1&query=${query}`;
    Linking.openURL(url).catch(() => {});
  };

  const openWebsite = (url) => {
    Linking.openURL(url).catch(() => {});
  };

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

  // === ROW ===
  const InfoRow = ({ iconSrc, label, value, onPress, isLink }) => (
    <TouchableOpacity activeOpacity={onPress ? 0.9 : 1} onPress={onPress} style={styles.row}>
      <View style={styles.rowIconBox}>
        <Image source={iconSrc} style={{ width: 18, height: 18, tintColor: PRIMARY }} />
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
      {onPress ? (
        <Image source={icChevronRight} style={{ width: 20, height: 20, tintColor: '#98a2b3' }} />
      ) : null}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
          <Image source={icBack} style={{ width: 24, height: 24, tintColor: '#fff' }} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('headerTitle')}</Text>
      </View>

      {/* Body */}
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
            iconSrc={icHQ}
            label={t('hq')}
            value="13 Đường số 23A, P. Bình Trị Đông B, Q. Bình Tân, TP HCM"
            onPress={() => openMap('13 Đường số 23A, P. Bình Trị Đông B, Q. Bình Tân, TP HCM')}
          />
          <View style={styles.divider} />
          <InfoRow
            iconSrc={icOfficeHCM}
            label={t('hcm')}
            value="38-40 Đường 21A, P. An Lạc, TP. Hồ Chí Minh"
            onPress={() => openMap('38-40 Đường 21A, P. An Lạc, TP. Hồ Chí Minh')}
          />
          <View style={styles.divider} />
          <InfoRow
            iconSrc={icOfficeHN}
            label={t('hn')}
            value="80 Đường Hạ Yên Quyết, P. Yên Hòa, Q. Cầu Giấy, Hà Nội"
            onPress={() => openMap('80 Đường Hạ Yên Quyết, P. Yên Hòa, Q. Cầu Giấy, Hà Nội')}
          />
          <View style={styles.divider} />
          <InfoRow
            iconSrc={icWebsite}
            label={t('website')}
            value="https://iky.vn"
            onPress={() => openWebsite('https://iky.vn')}
            isLink
          />
          <View style={styles.divider} />
          <InfoRow iconSrc={icInfo} label={t('version')} value="1.127 Release" />
        </View>

        {/* Close */}
        <TouchableOpacity style={styles.ghostBtn} onPress={handleBackPress} activeOpacity={0.9}>
          <Text style={styles.ghostBtnText}>{t('close')}</Text>
        </TouchableOpacity>

        <View style={{ height: Platform.OS === 'ios' ? 4 : 8 }} />
      </View>
    </SafeAreaView>
  );
};

export default CompanyInfoScreen;
