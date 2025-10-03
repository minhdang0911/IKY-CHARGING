import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { fmtMoney, parseMY, YEAR_NOW } from '../../utils/format';

export default function KPIStats({ L, revenueData }) {
  const last = revenueData.at(-1)?.revenue || 0;
  const prev = revenueData.at(-2)?.revenue || 0;
  const mom  = prev ? Math.round(Math.abs(((last - prev) / prev) * 100)) : 0;
  const momUp = last > prev, momDown = last < prev;

  const ytd = useMemo(() => {
    let sum = 0;
    for (const it of revenueData) {
      const { y } = parseMY(it.month);
      if (y === YEAR_NOW) sum += Number(it.revenue || 0);
    }
    return sum;
  }, [revenueData]);

  const avg = useMemo(() => {
    if (!revenueData.length) return 0;
    const sum = revenueData.reduce((a, b) => a + Number(b.revenue || 0), 0);
    return Math.round(sum / revenueData.length);
  }, [revenueData]);

  const activeMonths = useMemo(() => {
    const cnt = revenueData.filter((x) => Number(x.revenue) > 0).length;
    return `${cnt}/${revenueData.length}`;
  }, [revenueData]);

  return (
    <View style={s.row}>
      <View style={s.item}>
        <Text style={s.label}>{L.yoy}</Text>
        <View style={s.valRow}>
          <Icon name={momUp ? 'trending-up' : momDown ? 'trending-down' : 'horizontal-rule'}
                size={16} color={momUp ? '#16A34A' : momDown ? '#EF4444' : '#64748B'} />
          <Text style={[s.value, momUp && {color:'#16A34A'}, momDown && {color:'#EF4444'}]}>{mom}%</Text>
        </View>
      </View>
      <View style={s.item}><Text style={s.label}>{L.ytd}</Text><Text style={s.value}>{fmtMoney(ytd)}</Text></View>
      <View style={s.item}><Text style={s.label}>{L.avg}</Text><Text style={s.value}>{fmtMoney(avg)}</Text></View>
      <View style={s.item}><Text style={s.label}>{L.activeMonths}</Text><Text style={s.value}>{activeMonths}</Text></View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  item: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: '#EEF2F7' },
  label: { fontSize: 11, color: '#6B7280', fontWeight: '700', marginBottom: 4 },
  valRow: { flexDirection:'row', alignItems:'center', gap:6 },
  value: { fontSize: 16, color: '#111827', fontWeight: '800' },
});
