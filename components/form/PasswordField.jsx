import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const PRIMARY = '#1e88e5';
const BORDER  = '#e5e7eb';
const MUTED   = '#667085';
const TEXT    = '#0f172a';

export default function PasswordField({
  label,
  placeholder,
  value,
  onChangeText,
  visible,
  onToggleVisible,
  focused,
  onFocus,
  onBlur,
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, focused && styles.inputRowFocus]}>
        <View style={styles.leftIconBox}><Icon name="lock" size={18} color={PRIMARY} /></View>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9aa4b2"
          secureTextEntry={!visible}
          autoCapitalize="none"
          onFocus={onFocus}
          onBlur={onBlur}
        />
        <TouchableOpacity style={styles.eyeBtn} onPress={onToggleVisible}>
          <Icon name={visible ? 'visibility-off' : 'visibility'} size={20} color="#98a2b3" />
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: MUTED, marginTop: 8, marginBottom: 6, fontWeight: '700' },
  inputRow: {
    minHeight: 50, borderRadius: 12, borderWidth: 1.2, borderColor: BORDER,
    backgroundColor: '#fff', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center',
  },
  inputRowFocus: {
    borderColor: PRIMARY, shadowColor: '#1e88e5', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0, shadowRadius: 6, elevation: Platform.OS === 'android' ? 2 : 0,
  },
  leftIconBox: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#eff6ff',
    alignItems: 'center', justifyContent: 'center', marginRight: 8,
  },
  input: { flex: 1, fontSize: 15, color: TEXT, paddingVertical: 0 },
  eyeBtn: { padding: 6, marginLeft: 6 },
});
