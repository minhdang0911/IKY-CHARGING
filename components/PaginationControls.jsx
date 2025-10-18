import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, TextInput, Platform, ToastAndroid, Alert } from 'react-native';

import icPrev from '../assets/img/ic_chevron_left.png';
import icNext from '../assets/img/ic_chevron_right.png';

export default function PaginationControls({
  page,
  totalPages,
  onPrev,
  onNext,
  onJump,
  showGoto = true,
}) {
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const [goto, setGoto] = useState('');

  const submitGoto = () => {
    if (!showGoto || !onJump) return;
    const n = Number(goto);
    const safe = Number.isFinite(n) ? Math.max(1, Math.min(totalPages, Math.trunc(n))) : NaN;
    if (!Number.isFinite(safe)) {
      Platform.OS === 'android'
        ? ToastAndroid.show('Trang không hợp lệ', ToastAndroid.SHORT)
        : Alert.alert('Lỗi', 'Trang không hợp lệ');
      return;
    }
    if (safe !== page) onJump(safe);
    setGoto('');
  };

  return (
    <View style={s.wrap}>
      {/* ==== HÀNG 1: Prev / Info / Next ==== */}
      <View style={s.row}>
        <TouchableOpacity
          style={[s.btn, !canPrev && s.btnDis]}
          disabled={!canPrev}
          onPress={onPrev}
        >
          <Image source={icPrev} style={[s.icon, { tintColor: canPrev ? '#2563EB' : '#94a3b8' }]} />
          <Text style={[s.btnText, { color: canPrev ? '#2563EB' : '#94a3b8' }]}>Trước</Text>
        </TouchableOpacity>

        <Text style={s.info}>
          Trang <Text style={s.bold}>{page}</Text> / {totalPages}
        </Text>

        <TouchableOpacity
          style={[s.btn, !canNext && s.btnDis]}
          disabled={!canNext}
          onPress={onNext}
        >
          <Text style={[s.btnText, { color: canNext ? '#2563EB' : '#94a3b8' }]}>Sau</Text>
          <Image source={icNext} style={[s.icon, { tintColor: canNext ? '#2563EB' : '#94a3b8' }]} />
        </TouchableOpacity>
      </View>

      {/* ==== HÀNG 2: Go To ==== */}
      {showGoto && totalPages > 1 && (
        <View style={s.gotoRow}>
          <Text style={s.gotoLabel}>Go to</Text>
          <TextInput
            value={goto}
            onChangeText={setGoto}
            keyboardType="number-pad"
            returnKeyType="go"
            onSubmitEditing={submitGoto}
            style={s.input}
            placeholder="--"
            placeholderTextColor="#9CA3AF"
          />
          <Text style={s.gotoSuffix}>/ {totalPages}</Text>
          <TouchableOpacity style={s.goBtn} onPress={submitGoto}>
            <Text style={s.goText}>Go</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const H = 40;

const s = StyleSheet.create({
  wrap: {
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  btn: {
    height: H,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnDis: { backgroundColor: '#F1F5F9' },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    includeFontPadding: false,
    textAlignVertical: 'center',
    lineHeight: Platform.OS === 'android' ? 18 : undefined,
  },
  icon: { width: 18, height: 18 },
  info: {
    fontSize: 14,
    color: '#334155',
    fontWeight: '600',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  bold: { fontWeight: '800', color: '#111827' },

  // ==== dòng 2 ====
  gotoRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  gotoLabel: { fontSize: 13, fontWeight: '700', color: '#334155' },
  input: {
    height: H,
    width: 70,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    color: '#0F172A',
    fontWeight: '800',
    textAlign: 'center',
  },
  gotoSuffix: { fontSize: 13, fontWeight: '700', color: '#334155' },
  goBtn: {
    height: H,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  goText: { color: '#fff', fontWeight: '800' },
});
