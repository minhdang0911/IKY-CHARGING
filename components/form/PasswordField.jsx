import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';

 
import icLock from '../../assets/img/ic_lock_24.png';
import icEyeOpen from '../../assets/img/ic_eye_open.png';
import icEyeClosed from '../../assets/img/ic_eye_closed.png';

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
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputRow, focused && styles.inputRowFocus]}>
        {/* LEFT ICON */}
        <View style={styles.leftIconBox}>
          <Image source={icLock} style={styles.iconLock} />
        </View>

        {/* INPUT */}
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

        {/* EYE TOGGLE */}
        <TouchableOpacity style={styles.eyeBtn} onPress={onToggleVisible} activeOpacity={0.8}>
          <Image
            source={visible ? icEyeOpen : icEyeClosed}
            style={styles.iconEye}
          />
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 12,
    color: MUTED,
    marginTop: 8,
    marginBottom: 6,
    fontWeight: '700',
  },
  inputRow: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: BORDER,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputRowFocus: {
    borderColor: PRIMARY,
    shadowColor: '#1e88e5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.OS === 'ios' ? 0.18 : 0,
    shadowRadius: 6,
    elevation: Platform.OS === 'android' ? 2 : 0,
  },
  leftIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  iconLock: { width: 18, height: 18, tintColor: PRIMARY },
  iconEye: { width: 22, height: 22, tintColor: '#98a2b3' },
  input: {
    flex: 1,
    fontSize: 15,
    color: TEXT,
    paddingVertical: 0,
  },
  eyeBtn: {
    padding: 6,
    marginLeft: 6,
  },
});
