// components/BottomTabNavigation.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LANG_KEY = 'app_language';
const STRINGS = {
  vi: {
    Monitoring: 'Giám sát',
    Journey: 'Hành trình',
    Device: 'Thiết bị',
    Information: 'Thông tin',
  },
  en: {
    Monitoring: 'Monitoring',
    Journey: 'Journey',
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

  // 👇 Nếu hidden thì không render để khỏi chiếm chỗ
  if (hidden) return null;

  const tabs = [
    { id: 'Monitoring', icon: 'location-on' },
    { id: 'Journey', icon: 'map' },
    { id: 'Device', icon: 'directions-car' },
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
              <Icon name={tab.icon} size={24} color={isActive ? '#00bcd4' : '#999'} />
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
    backgroundColor: '#e3f9fd',
    borderWidth: 2,
    borderColor: '#00bcd4',
  },
  tabTitle: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    fontWeight: '500',
  },
  activeTabTitle: {
    color: '#00bcd4',
    fontWeight: '600',
  },
});

export default BottomTabNavigation;
