import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function MonthDropdown({ data = [], value, onChange, placeholder = 'Chọn' }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.wrap}>
      <Pressable style={s.input} onPress={() => setOpen(true)}>
        <Text style={[s.inputText, !value && { color: '#9CA3AF' }]}>{value || placeholder}</Text>
        <Icon name="arrow-drop-down" size={22} color="#4A90E2" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={s.overlay} onPress={() => setOpen(false)}><View /></Pressable>
        <View style={s.menu}>
          <View style={s.menuHeader}>
            <Text style={s.menuTitle}>{placeholder}</Text>
            <TouchableOpacity onPress={() => setOpen(false)} style={s.closeBtn}>
              <Icon name="close" color="#111827" size={20} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 320 }}>
            {data.map((m) => {
              const active = value === m;
              return (
                <Pressable key={m} style={[s.item, active && s.itemActive]}
                  onPress={() => { onChange?.(m); setOpen(false); }}>
                  <Text style={[s.itemText, active && s.itemTextActive]}>{m}</Text>
                  {active ? <Icon name="check" size={18} color="#2563EB" /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1 },
  input: { height: 44, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB',
    paddingHorizontal: 12, backgroundColor: '#fff', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between' },
  inputText: { color: '#111827', fontSize: 14, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.15)' },
  menu: { position: 'absolute', left: 16, right: 16, top: 120, backgroundColor: '#fff',
    borderRadius: 14, overflow: 'hidden', elevation: 6, shadowColor: '#000',
    shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 6 } },
  menuHeader: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    flexDirection: 'row', alignItems: 'center' },
  menuTitle: { fontWeight: '800', fontSize: 14, color: '#111827', flex: 1 },
  closeBtn: { padding: 6 },
  item: { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemActive: { backgroundColor: '#EFF6FF' },
  itemText: { color: '#111827', fontSize: 14, fontWeight: '600' },
  itemTextActive: { color: '#2563EB' },
});
