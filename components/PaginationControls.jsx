import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, TextInput } from 'react-native';

export default function PaginationControls({
  page,
  totalPages,
  onPrev,
  onNext,
  onGoTo,
}) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const [value, setValue] = useState(String(page));

  useEffect(() => {
    setValue(String(page || 1));
  }, [page]);

  const clamp = useCallback((n) => {
    if (!Number.isFinite(n)) return 1;
    if (n < 1) return 1;
    const tp = Number(totalPages) || 1;
    return n > tp ? tp : n;
  }, [totalPages]);

  const normalize = useCallback((txt) => {
    const onlyDigits = String(txt || '').replace(/[^\d]/g, '');
    if (!onlyDigits) return '';
    return String(parseInt(onlyDigits, 10));
  }, []);

  const submitGo = useCallback(() => {
    if (!onGoTo) return;
    const norm = normalize(value);
    if (!norm) { setValue(String(page || 1)); return; }
    const next = clamp(parseInt(norm, 10));
    onGoTo(next);
  }, [onGoTo, value, normalize, clamp, page]);

  const goDisabled = useMemo(() => {
    const norm = normalize(value);
    if (!norm) return true;
    const n = clamp(parseInt(norm, 10));
    return n === page;
  }, [value, normalize, clamp, page]);

  return (
    <View style={styles.container}>
      {/* HÀNG 1: Prev | Trang x/y | Next */}
      <View style={styles.topRow}>
        <TouchableOpacity
          style={[styles.button, !canPrev && styles.disabled, { marginRight: 12 }]}
          onPress={onPrev}
          disabled={!canPrev}
          activeOpacity={0.9}
        >
          <Text style={[styles.arrow, !canPrev && styles.textDisabled]}>‹</Text>
          <Text style={[styles.text, !canPrev && styles.textDisabled]}>Trước</Text>
        </TouchableOpacity>

        <Text style={styles.pageInfo}>
          Trang <Text style={styles.bold}>{page}</Text> / {totalPages}
        </Text>

        <TouchableOpacity
          style={[styles.button, !canNext && styles.disabled, { marginLeft: 12 }]}
          onPress={onNext}
          disabled={!canNext}
          activeOpacity={0.9}
        >
          <Text style={[styles.text, !canNext && styles.textDisabled]}>Sau</Text>
          <Text style={[styles.arrow, !canNext && styles.textDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* HÀNG 2: Đến [input] [Go] */}
      <View style={styles.bottomRow}>
        <Text style={styles.goLabel}>Đến</Text>
        <TextInput
          value={value}
          onChangeText={(txt) => setValue(normalize(txt))}
          keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
          inputMode="numeric"
          returnKeyType="go"
          onSubmitEditing={submitGo}
          onBlur={() => { if (!value) setValue(String(page || 1)); }}
          placeholder="số trang"
          placeholderTextColor="#94a3b8"
          style={styles.goInput}
          maxLength={7}
        />
        <TouchableOpacity
          onPress={submitGo}
          style={[styles.goBtn, goDisabled && styles.goBtnDisabled]}
          disabled={goDisabled}
          activeOpacity={0.9}
        >
          <Text style={[styles.goBtnText, goDisabled && styles.goBtnTextDisabled]}>Go</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const BTN_H = 36;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'web' ? 14 : 10,
  },

  // Hàng trên
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // pageInfo nằm giữa hai nút
  },
  pageInfo: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    minWidth: 120,          // đảm bảo cân giữa khi nội dung thay đổi
    marginHorizontal: 8,
  },
  bold: { fontWeight: '900', color: '#111827' },

  // Nút prev/next
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    borderRadius: 999,
    paddingHorizontal: 14,
    height: BTN_H,
  },
  disabled: {
    backgroundColor: '#f1f5f9',
  },
  arrow: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1d4ed8',
    marginRight: 6,
    marginLeft: 2,
  },
  text: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  textDisabled: { color: '#94a3b8' },

  // Hàng dưới
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,          // cách hàng trên
  },
  goLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '700',
    marginRight: 8,
  },
  goInput: {
    width: 72,
    height: BTN_H,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    backgroundColor: '#fff',
    marginRight: 8,
  },
  goBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 14,
    height: BTN_H,
    borderRadius: 10,
    justifyContent: 'center',
  },
  goBtnDisabled: { backgroundColor: '#e2e8f0' },
  goBtnText: { color: '#fff', fontWeight: '900', fontSize: 14 },
  goBtnTextDisabled: { color: '#94a3b8' },
});
