import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function SimpleHeader({ title, onBack, rightSlot, color = '#1e88e5' }) {
  return (
    <View style={[styles.header, { backgroundColor: color }]}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn}>
        <Icon name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
      <View style={{ width: 32 }}>{rightSlot}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 25 : 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { padding: 6, marginRight: 6 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 },
});
