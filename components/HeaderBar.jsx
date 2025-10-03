// components/HeaderBar.jsx
import React from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function HeaderBar({
  title,          
  onToggleLanguage,  
  right,            
}) {
  return (
    <View style={s.header}>
      <Text style={s.headerTitle}>{title}</Text>
      {right}
      {onToggleLanguage ? (
        <TouchableOpacity onPress={onToggleLanguage} style={{ marginLeft: 8 }}>
          <Icon name="translate" size={20} color="#fff" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 16 : 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '600', flex: 1 },
});
