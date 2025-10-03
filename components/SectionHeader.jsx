import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SectionHeader({ title, right }) {
  return (
    <View style={s.row}>
      <Text style={s.title}>{title}</Text>
      <View style={{flexDirection:'row', alignItems:'center', gap:8}}>{right}</View>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginBottom: 6, marginTop: 4 },
  title: { fontSize: 18, fontWeight: '800', color: '#111827' },
});
