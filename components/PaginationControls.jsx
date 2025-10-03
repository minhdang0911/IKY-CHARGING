// components/PaginationControls.jsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function PaginationControls({ page, totalPages, onPrev, onNext }) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <View style={styles.pager}>
      <TouchableOpacity
        style={[styles.pagerBtn, !canPrev && styles.pagerBtnDisabled]}
        disabled={!canPrev}
        onPress={onPrev}
      >
        <Icon name="chevron-left" size={22} color={canPrev ? '#2563EB' : '#94a3b8'} />
        <Text style={[styles.pagerText, { color: canPrev ? '#2563EB' : '#94a3b8' }]}>
          Trước
        </Text>
      </TouchableOpacity>

      <Text style={styles.pagerInfo}>
        Trang <Text style={styles.bold}>{page}</Text> / {totalPages}
      </Text>

      <TouchableOpacity
        style={[styles.pagerBtn, !canNext && styles.pagerBtnDisabled]}
        disabled={!canNext}
        onPress={onNext}
      >
        <Text style={[styles.pagerText, { color: canNext ? '#2563EB' : '#94a3b8' }]}>
          Sau
        </Text>
        <Icon name="chevron-right" size={22} color={canNext ? '#2563EB' : '#94a3b8'} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
    backgroundColor: '#fff',
  },
  pagerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#EEF2FF',
  },
  pagerBtnDisabled: { backgroundColor: '#f1f5f9' },
  pagerText: { fontSize: 14, fontWeight: '700' },
  pagerInfo: { fontSize: 14, color: '#334155', fontWeight: '600' },
  bold: { fontWeight: '800', color: '#111827' },
});
