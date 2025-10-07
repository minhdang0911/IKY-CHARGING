// components/BottomTabNavigation.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

  // Hai tab đầu chuyển sang dạng text badge: GS / TQ
  const tabs = [
    { id: 'Monitoring', type: 'text', text: 'GS' },
    { id: 'Journey', type: 'text', text: 'TQ' },
    { id: 'Device', type: 'icon', icon: 'router' },
    { id: 'Information', type: 'icon', icon: 'info' },
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
              {tab.type === 'text' ? (
                <View style={[styles.textBadge, isActive && styles.textBadgeActive]}>
                  <Text style={[styles.textBadgeLabel, isActive && styles.textBadgeLabelActive]}>
                    {tab.text}
                  </Text>
                </View>
              ) : (
                <Icon name={tab.icon} size={24} color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR} />
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

    // ✅ Cố định đáy màn hình (hiệu quả trên web)
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    zIndex: 99,
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

  // Badge chữ cho GS / TQ
  textBadge: {
    minWidth: 36,
    height: 24,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: INACTIVE_COLOR,
  },
  textBadgeActive: {
    borderColor: ACTIVE_COLOR,
    backgroundColor: 'rgba(74,144,226,0.08)',
  },
  textBadgeLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: INACTIVE_COLOR,
    letterSpacing: 0.5,
  },
  textBadgeLabelActive: {
    color: ACTIVE_COLOR,
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
