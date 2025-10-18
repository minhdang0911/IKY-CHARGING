import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import MonthDropdown from './MonthDropdown';
import { fmtMoney } from '../../utils/format';
import icCompare from '../../assets/img/ic_compare.png';
import icEast from '../../assets/img/ic_east.png';

// NEW MATERIAL ICONS
import icTrendUp from '../../assets/img/ic_trend_upp.png';
import icTrendDown from '../../assets/img/ic_trend_down.png';
import icTrendFlat from '../../assets/img/ic_trend_flat.png';

export default function CompareCard({ L, months, m1, setM1, m2, setM2, a, b }) {
  const diff = (a && b) ? (b.revenue - a.revenue) : 0;
  const pct  = a ? (a.revenue === 0 ? (b?.revenue ? 100 : 0) : (diff / a.revenue) * 100) : 0;
  const status = diff === 0 ? 'equal' : diff > 0 ? 'increase' : 'decrease';

  return (
    <View style={s.card}>
      <View style={s.header}>
        <Image source={icCompare} style={{ width: 18, height: 18, tintColor: '#2563EB' }} />
        <Text style={s.title}>{L.compare}</Text>
      </View>

      <View style={s.row}>
        <MonthDropdown data={months} value={m1} onChange={setM1} placeholder={`${L.selectMonth} 1`} />
        <View style={{ width: 12 }} />
        <MonthDropdown data={months} value={m2} onChange={setM2} placeholder={`${L.selectMonth} 2`} />
      </View>

      {a && b ? (
        <View style={s.resultBox}>
          <Text style={s.resultTitle}>{L.result}</Text>

          <View style={s.resultRow}>
            <View style={s.col}>
              <Text style={s.resultLabel}>{m1}</Text>
              <Text style={s.resultValue}>{fmtMoney(a.revenue)}</Text>
            </View>
            <Image source={icEast} style={{ width: 20, height: 20, tintColor: '#64748B' }} />
            <View style={s.col}>
              <Text style={s.resultLabel}>{m2}</Text>
              <Text style={s.resultValue}>{fmtMoney(b.revenue)}</Text>
            </View>
          </View>

          <View style={s.deltaRow}>
            {status === 'increase' ? (
              <Image source={icTrendUp} style={{ width: 18, height: 18, tintColor: '#16A34A' }} />
            ) : status === 'decrease' ? (
              <Image source={icTrendDown} style={{ width: 18, height: 18, tintColor: '#EF4444' }} />
            ) : (
              <Image source={icTrendFlat} style={{ width: 18, height: 18, tintColor: '#64748B' }} />
            )}
            <Text
              style={[
                s.deltaText,
                status === 'increase' && { color: '#16A34A' },
                status === 'decrease' && { color: '#EF4444' },
              ]}
            >
              {status === 'increase' ? L.increase : status === 'decrease' ? L.decrease : L.equal}
              {'  '}{Math.abs(pct).toFixed(0)}% ({fmtMoney(Math.abs(diff))})
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  title: { fontSize: 14, fontWeight: '800', color: '#111827' },
  row: { flexDirection: 'row', gap: 12 },
  resultBox: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    backgroundColor: '#FAFAFA',
  },
  resultTitle: { fontSize: 12, color: '#64748B', marginBottom: 6, fontWeight: '700' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  col: { alignItems: 'center', flex: 1 },
  resultLabel: { fontSize: 12, color: '#6B7280', marginBottom: 2 },
  resultValue: { fontSize: 16, color: '#111827', fontWeight: '800' },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  deltaText: { fontWeight: '800', color: '#111827' },
});
