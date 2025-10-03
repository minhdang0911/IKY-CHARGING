// components/CustomAlert.js
import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function CustomAlert({ visible, message, onClose }) {
  if (!visible) return null;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.title}>Thông báo</Text>
          <Text style={styles.msg}>{message}</Text>

          <TouchableOpacity style={styles.btn} onPress={onClose}>
            <Text style={styles.btnText}>OK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 10, color: '#111' },
  msg: { fontSize: 14, color: '#444', marginBottom: 20 },
  btn: {
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'center',
    minWidth: 80,
  },
  btnText: { color: '#fff', fontWeight: '600', textAlign: 'center' },
});
