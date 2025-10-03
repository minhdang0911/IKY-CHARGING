import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function LangSheet({ visible, onClose, t, language, onPick }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.wrap}>
        <View style={s.handle} />
        <Text style={s.title}>{t('choosingLang')}</Text>

        {['vi','en'].map((code) => (
          <TouchableOpacity key={code} style={s.item} onPress={() => onPick(code)}>
            <Text style={[s.itemText, language === code && s.itemActive]}>
              {code === 'vi' ? t('vi') : t('en')}
            </Text>
            {language === code ? <Icon name="check" size={18} color="#1e88e5" /> : null}
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={s.cancel} onPress={onClose}>
          <Text style={s.cancelText}>{t('cancel')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  wrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff',
    borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12,
    elevation: 12, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 14, shadowOffset: { width: 0, height: -4 },
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: 999, backgroundColor: '#e5e7eb', marginBottom: 8 },
  title: { fontSize: 15, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 6 },
  item: {
    paddingVertical: 12, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#eef2f7', marginBottom: 8,
  },
  itemText: { fontSize: 15, color: '#0f172a' },
  itemActive: { color: '#1e88e5', fontWeight: '700' },
  cancel: { marginTop: 6, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6' },
  cancelText: { color: '#111827', fontWeight: '600' },
});
