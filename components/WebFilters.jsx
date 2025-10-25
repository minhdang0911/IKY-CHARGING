// components/WebFilters.jsx
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable, ScrollView,
  useWindowDimensions, Platform
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

// portal (web) để panel không bị che
let createPortal = null;
if (Platform.OS === 'web') {
  try { ({ createPortal } = require('react-dom')); } catch {}
}

/* ===== helper hiển thị tháng ===== */
function monthLabelSlash(key) {
  if (!key || key === 'all') return 'Tất cả (trang hiện tại)';
  if (key === 'custom') return 'Tuỳ chọn'; // <— thêm dòng này

  const [y, m] = String(key).split('-');
  return `${m}/${y}`;
}


/* ====== Dropdown cơ bản dùng portal + anchor theo button ====== */
function useAnchoredPanel() {
  const btnRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 260 });

  const toggle = useCallback(() => {
    if (Platform.OS === 'web' && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect?.() ?? { bottom: 0, left: 0, width: 260 };
      setPos({ top: rect.bottom + 8, left: rect.left, width: Math.max(rect.width ?? 220, 220) });
    }
    setOpen(v => !v);
  }, []);
  const close = useCallback(() => setOpen(false), []);

  return { btnRef, open, pos, toggle, close };
}

/* ===== MonthDropdown ===== */
export function MonthDropdown({ options = [], value = 'all', onChange }) {
  const { btnRef, open, pos, toggle, close } = useAnchoredPanel();

  const Button = (
    <TouchableOpacity ref={btnRef} style={styles.ddButton} onPress={toggle} activeOpacity={0.9}>
      <Text style={styles.ddButtonText}>{monthLabelSlash(value)}</Text>
      <Icon name="expand-more" size={18} color="#2563EB" />
    </TouchableOpacity>
  );

  const Panel = (
    <>
      <Pressable onPress={close} style={styles.backdrop} />
      <View style={[styles.panel, { top: pos.top, left: pos.left, width: Math.max(240, pos.width) }]}>
        <View style={styles.ddHeader}>
          <Text style={styles.ddTitle}>Chọn tháng</Text>
          <TouchableOpacity onPress={close} style={styles.ddClose}><Icon name="close" size={18} color="#6B7280" /></TouchableOpacity>
        </View>
        <ScrollView style={{ maxHeight: 320 }}>
        {['all', ...options.map(o => o.key).filter(k => k && k !== 'all')].map(k => {

            const active = value === k;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => { onChange?.(k); close(); }}
                style={[styles.ddItem, active && styles.ddItemActive]}
                activeOpacity={0.9}
              >
                <Text style={[styles.ddItemText, active && styles.ddItemTextActive]}>
                  {k === 'all' ? 'Tất cả (trang hiện tại)' : monthLabelSlash(k)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </>
  );

  return (
    <View style={styles.ddWrap}>
      {Button}
      {open && (Platform.OS === 'web' && createPortal ? createPortal(Panel, document.body) : Panel)}
    </View>
  );
}

/* ===== PortDropdown ===== */
export function PortDropdown({ options = [], value = 'all', onChange }) {
  const { btnRef, open, pos, toggle, close } = useAnchoredPanel();

  const Button = (
    <TouchableOpacity ref={btnRef} style={styles.ddButton} onPress={toggle} activeOpacity={0.9}>
      <Text style={styles.ddButtonText}>{value === 'all' ? 'Tất cả cổng' : `Cổng ${value}`}</Text>
      <Icon name="expand-more" size={18} color="#2563EB" />
    </TouchableOpacity>
  );

  const Panel = (
    <>
      <Pressable onPress={close} style={styles.backdrop} />
      <View style={[styles.panel, { top: pos.top, left: pos.left, width: Math.max(220, pos.width) }]}>
        <View style={styles.ddHeader}>
          <Text style={styles.ddTitle}>Chọn cổng</Text>
          <TouchableOpacity onPress={close} style={styles.ddClose}><Icon name="close" size={18} color="#6B7280" /></TouchableOpacity>
        </View>
        <ScrollView style={{ maxHeight: 320 }}>
          {['all', ...options].map(k => {
            const active = value === k;
            const label = k === 'all' ? 'Tất cả cổng' : `Cổng ${k}`;
            return (
              <TouchableOpacity
                key={k}
                onPress={() => { onChange?.(k); close(); }}
                style={[styles.ddItem, active && styles.ddItemActive]}
                activeOpacity={0.9}
              >
                <Text style={[styles.ddItemText, active && styles.ddItemTextActive]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </>
  );

  return (
    <View style={styles.ddWrap}>
      {Button}
      {open && (Platform.OS === 'web' && createPortal ? createPortal(Panel, document.body) : Panel)}
    </View>
  );
}

/* ===== DateRangeBar (web input) ===== */
export function DateRangeBar({ fromStr = '', toStr = '', onFromChange, onToChange, onClear }) {
  return (
    <View style={styles.dateRow}>
      <Text style={styles.dateLabel}>Từ</Text>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <input type="datetime-local" value={fromStr} onChange={(e) => onFromChange?.(e.target.value)} style={styles.dateInput} />
      <Text style={styles.dateLabel}>Đến</Text>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <input type="datetime-local" value={toStr} onChange={(e) => onToChange?.(e.target.value)} style={styles.dateInput} />
      <TouchableOpacity onPress={onClear} style={styles.clearBtn} activeOpacity={0.9}>
        <Icon name="close" size={16} color="#2563EB" />
        <Text style={styles.clearText}>Xoá</Text>
      </TouchableOpacity>
    </View>
  );
}

/* ===== WebFilters (hàng control responsive + slot bên phải) ===== */
export function WebFilters({
  monthOptions = [], monthValue = 'all', onMonthChange,
  portOptions = [], portValue = 'all', onPortChange,
  fromStr = '', toStr = '', onFromChange, onToChange, onClearDates,
  rightSlot, // nút Export/Lọc…; tùy page truyền vào
  breakpoint = 768, // md
}) {
  const { width } = useWindowDimensions();
  const isNarrow = width < breakpoint;

  return (
    <View style={[styles.actionRow, isNarrow ? styles.rowNarrow : styles.rowWide]}>
      <View style={[styles.controlItem, isNarrow && styles.full]}>
        <MonthDropdown options={monthOptions} value={monthValue} onChange={onMonthChange} />
      </View>

      <View style={[styles.controlItem, isNarrow && styles.full]}>
        <PortDropdown options={portOptions} value={portValue} onChange={onPortChange} />
      </View>

      <View style={[styles.controlGrow, isNarrow && styles.full]}>
        <DateRangeBar
          fromStr={fromStr}
          toStr={toStr}
          onFromChange={onFromChange}
          onToChange={onToChange}
          onClear={onClearDates}
        />
      </View>

      {rightSlot ? (
        <View style={[styles.controlItem, isNarrow && styles.full]}>
          {rightSlot}
        </View>
      ) : null}
    </View>
  );
}

/* ===== styles ===== */
const styles = StyleSheet.create({
  // row
  actionRow: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 0,
    gap: 10,
    alignItems: 'stretch',
    flexWrap: 'wrap',
    zIndex: 19,
  },
  rowNarrow: { flexDirection: 'column' },
  rowWide:   { flexDirection: 'row', alignItems: 'center' },

  controlItem: { minWidth: 200 },
  controlGrow: { flexGrow: 1, minWidth: 260 },
  full: { flexBasis: '100%' },

  // dropdown
  ddWrap: { position: 'relative', zIndex: 1 },
  ddButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, borderWidth: 1, borderColor: '#2563EB',
    paddingVertical: 8, paddingHorizontal: 12, backgroundColor: '#fff', minHeight: 40,
  },
  ddButtonText: { color: '#2563EB', fontWeight: '800', flex: 1, marginRight: 6, textAlign: 'left' },

  backdrop: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'transparent', zIndex: 998 },
  panel: {
    position: 'fixed', backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden',
    borderWidth: 1, borderColor: '#E5E7EB', boxShadow: '0 12px 30px rgba(0,0,0,0.12)', elevation: 12, zIndex: 999,
  },
  ddHeader: {
    paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFF',
  },
  ddTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  ddClose: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  ddItem: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F1F5F9', backgroundColor: '#fff' },
  ddItemActive: { backgroundColor: '#2563EB' },
  ddItemText: { color: '#111827', fontWeight: '700', textAlign: 'left' },
  ddItemTextActive: { color: '#fff', fontWeight: '800' },

  // date range
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, flexWrap: 'wrap' },
  dateLabel: { fontSize: 12, color: '#374151', fontWeight: '700' },
  // eslint-disable-next-line react-native/no-color-literals
  dateInput: {
    height: 40, minWidth: 160, maxWidth: 200, flex: 1,
    borderWidth: 1, borderColor: '#2563EB', borderRadius: 12,
    paddingLeft: 10, paddingRight: 10, backgroundColor: '#fff',
    fontWeight: 800, color: '#111827', fontSize: 13,
  },
  clearBtn: {
    height: 40, paddingHorizontal: 10, borderWidth: 1, borderColor: '#2563EB',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6, backgroundColor: '#EEF2FF',
  },
  clearText: { color: '#2563EB', fontWeight: '800' },
});

export default WebFilters;
