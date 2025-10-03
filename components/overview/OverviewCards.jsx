import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

export default function OverviewCards({ L, overview, onOrdersPress, onSessionsPress, icons }) {
  return (
    <View style={s.wrap}>
      <TouchableOpacity activeOpacity={0.8} style={s.card} onPress={onOrdersPress}>
        <Image source={icons.orders} style={s.img} resizeMode="contain" />
        <Text style={s.number}>{overview?.totalOrders || 0}</Text>
        <Text style={s.label}>{L.orders}</Text>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.8} style={s.card} onPress={onSessionsPress}>
        <Image source={icons.sessions} style={s.img} resizeMode="contain" />
        <Text style={s.number}>{overview?.totalSessions || 0}</Text>
        <Text style={s.label}>{L.sessions}</Text>
      </TouchableOpacity>

      <View style={s.card}>
        <Image source={icons.devices} style={s.img} resizeMode="contain" />
        <Text style={s.number}>{overview?.totalDevices || 0}</Text>
        <Text style={s.label}>{L.devices}</Text>
      </View>

      <View style={s.card}>
        <Image source={icons.revenue} style={s.img} resizeMode="contain" />
        <Text style={s.number}>{(overview?.totalRevenue || 0).toLocaleString('vi-VN')}</Text>
        <Text style={s.label}>{L.revenue}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 16 },
  card: {
    width: '48%', backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    alignItems: 'center', gap: 6,
  },
  img: { width: 40, height: 40 },
  number: { fontSize: 18, fontWeight: '700', color: '#111827' },
  label: { fontSize: 12, color: '#6B7280' },
});
