import React from 'react';
import { View, Text, StyleSheet, Image, useWindowDimensions } from 'react-native';
import MonthDropdown from './MonthDropdown';
import { fmtMoney } from '../../utils/format';
import iconsup from '../../assets/img/ic_trend_up.png';
import iconsdown from '../../assets/img/ic_trend_down.png';
import iconarrow from '../../assets/img/ic_arrow_right.png';
import iconchart from '../../assets/img/ic_chart_blue.png'; // icon thay cho equalizer

export default function CompareCard({ L, months = [], m1, setM1, m2, setM2, a, b }) {
  const { width } = useWindowDimensions();
  const isNarrow = width < 360;
  const isVeryNarrow = width < 330;

  const aVal = Number(a?.revenue || 0);
  const bVal = Number(b?.revenue || 0);

  const diff = bVal - aVal;
  const pct = aVal > 0 ? Math.round((diff / aVal) * 100) : (bVal > 0 ? 100 : 0);
  const up = diff > 0, down = diff < 0;

  const dirIcon = up ? iconsup : down ? iconsdown : null;
  const dirColor = up ? '#16A34A' : down ? '#EF4444' : '#64748B';

  const titleFS = isVeryNarrow ? 14 : (isNarrow ? 15 : 16);
  const bigFS   = isVeryNarrow ? 16 : (isNarrow ? 18 : 20);

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <View style={s.badge}>
          <Image source={iconchart} style={{ width: 16, height: 16 }} resizeMode="contain" />
        </View>
        <Text style={[s.title, { fontSize: titleFS }]} numberOfLines={1}>{L.compare}</Text>
      </View>

      <View style={[s.controlsRow, isNarrow && { flexDirection: 'column', gap: 8 }]}>
        <View style={s.controlCol}>
          <MonthDropdown data={months} value={m1} onChange={setM1} placeholder={L.selectMonth} />
        </View>
        <View style={[s.controlCol, !isNarrow && { marginLeft: 8 }]}>
          <MonthDropdown data={months} value={m2} onChange={setM2} placeholder={L.selectMonth} />
        </View>
      </View>

      <View style={s.resultWrap}>
        <Text style={s.resultTitle}>{L.result}</Text>

        <View style={[s.resultRow, isNarrow && { flexDirection: 'column', gap: 8 }]}>
          <View style={[s.resultBox, isNarrow && { width: '100%' }]}>
            <Text numberOfLines={1} style={s.monthLabel}>{m1 || '—'}</Text>
            <Text style={[s.money, { fontSize: bigFS }]} numberOfLines={1} adjustsFontSizeToFit>
              {fmtMoney(aVal)}
            </Text>
          </View>

          <View style={s.arrowCol}>
            <Image source={iconarrow} style={{ width: 20, height: 20, opacity: 0.6 }} resizeMode="contain" />
          </View>

          <View style={[s.resultBox, isNarrow && { width: '100%' }]}>
            <Text numberOfLines={1} style={s.monthLabel}>{m2 || '—'}</Text>
            <Text style={[s.money, { fontSize: bigFS }]} numberOfLines={1} adjustsFontSizeToFit>
              {fmtMoney(bVal)}
            </Text>
          </View>
        </View>

        <View style={s.deltaRow}>
          {dirIcon && (
            <Image source={dirIcon} style={{ width: 18, height: 18, tintColor: dirColor }} resizeMode="contain" />
          )}
          <Text style={[s.deltaText, { color: dirColor }]} numberOfLines={1} adjustsFontSizeToFit>
            {up ? L.increase : down ? L.decrease : L.equal}{"  "}
            {Math.abs(pct)}%{"  "}
            ({fmtMoney(Math.abs(diff))})
          </Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 4,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  badge: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  title: { fontWeight: '800', color: '#0F172A' },

  controlsRow: { flexDirection: 'row', marginBottom: 10 },
  controlCol: { flex: 1, minWidth: 0 },

  resultWrap: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  resultTitle: { fontSize: 13, color: '#64748B', fontWeight: '700', marginBottom: 8 },

  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultBox: {
    flex: 1, minWidth: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  monthLabel: { fontSize: 12, color: '#94A3B8', marginBottom: 4, fontWeight: '700' },
  money: { fontWeight: '800', color: '#0F172A' },

  arrowCol: { width: 28, alignItems: 'center', justifyContent: 'center' },

   deltaRow: {
  marginTop: 8,
  flexDirection: 'row',
   alignItems: 'center',
   justifyContent: 'center',  // ✅ căn giữa theo ngang
   gap: 6,
   width: '100%',             // (tuỳ) giúp chiếm full bề ngang để center chuẩn
  },
  deltaText: {
   fontWeight: '800',
   fontSize: 14,
   textAlign: 'center',       // ✅ chữ nằm giữa
 },
});
