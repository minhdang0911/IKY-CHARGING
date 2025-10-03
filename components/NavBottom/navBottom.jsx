// components/BottomTabNavigation.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet,Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import icOverview from '../../assets/img/ic_overview.png';
import icOverviewActive from '../../assets/img/ic_overview_active.png';


const LANG_KEY = 'app_language';
const ACTIVE_COLOR = '#4A90E2';
const INACTIVE_COLOR = '#999';

const STRINGS = {
  vi: {
    Monitoring: 'Giám sát',
    Journey: 'Tổng quan',
    Device: 'Thiết bị',
    Information: 'Thông tin',
  },
  en: {
    Monitoring: 'Monitoring',
    Journey: 'Overview',
    Device: 'Devices',
    Information: 'Info',
  },
};

const BottomTabNavigation = ({ currentScreen, navigateToScreen, hidden = false }) => {
  const [lang, setLang] = useState('vi');
  const L = useMemo(() => STRINGS[lang] || STRINGS.vi, [lang]);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(LANG_KEY);
        if (saved) setLang(saved);
      } catch {}
    })();
  }, []);

  if (hidden) return null;

  // 👇 Icons mới phù hợp với app trạm sạc
   
 const tabs = [
  { id: 'Monitoring', icon: 'ev-station' },
  { id: 'Journey', icon: icOverview, activeIcon: icOverviewActive },  
  { id: 'Device', icon: 'router' },
  { id: 'Information', icon: 'info' },
];

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = currentScreen === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={styles.tabItem}
            onPress={() => navigateToScreen(tab.id)}
            accessibilityRole="button"
            accessibilityLabel={L[tab.id]}
          >
           <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
  {typeof tab.icon === 'string' ? (
    <Icon name={tab.icon} size={24} color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR} />
  ) : (
    <Image source={isActive ? tab.activeIcon : tab.icon} style={{ width: 28, height: 28, resizeMode: 'contain' }} />
  )}
</View>

            <Text style={[styles.tabTitle, isActive && styles.activeTabTitle]}>
              {L[tab.id]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 10,
    paddingHorizontal: 5,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    marginBottom: 4,
  },
  activeIconContainer: {
    backgroundColor: '#eaf3fe',
    borderWidth: 2,
    borderColor: ACTIVE_COLOR,
  },
  tabTitle: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontWeight: '500',
  },
  activeTabTitle: {
    color: ACTIVE_COLOR,
    fontWeight: '600',
  },
});

export default BottomTabNavigation;
