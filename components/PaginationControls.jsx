// components/PaginationControls.jsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function PaginationControls({ page, totalPages, onPrev, onNext }) {
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, !canPrev && styles.disabled]}
        onPress={onPrev}
        disabled={!canPrev}
      >
        <Icon
          name="chevron-left"
          size={22}
          color={canPrev ? '#1d4ed8' : '#94a3b8'}
        />
        <Text style={[styles.text, !canPrev && styles.textDisabled]}>Trước</Text>
      </TouchableOpacity>

      <Text style={styles.pageInfo}>
        Trang <Text style={styles.bold}>{page}</Text> / {totalPages}
      </Text>

      <TouchableOpacity
        style={[styles.button, !canNext && styles.disabled]}
        onPress={onNext}
        disabled={!canNext}
      >
        <Text style={[styles.text, !canNext && styles.textDisabled]}>Sau</Text>
        <Icon
          name="chevron-right"
          size={22}
          color={canNext ? '#1d4ed8' : '#94a3b8'}
        />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingVertical: Platform.OS === 'web' ? 14 : 10,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e0e7ff',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  disabled: {
    backgroundColor: '#f1f5f9',
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1d4ed8',
  },
  textDisabled: {
    color: '#94a3b8',
  },
  pageInfo: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  bold: {
    fontWeight: '800',
    color: '#111827',
  },
});
