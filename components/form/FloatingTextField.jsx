import React, { useMemo } from 'react';
import { View, TextInput, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const PRIMARY = '#1e88e5';
const BORDER  = '#e5e7eb';

export default function FloatingTextField({
  value, onChangeText,
  label, icon = 'person',
  focused, onFocus, onBlur,
  animValue, // Animated.Value 0 -> 1
  inputRef, returnKeyType = 'next', onSubmitEditing,
  autoComplete = 'username', secureTextEntry = false, rightSlot,
}) {
  const labelStyle = useMemo(() => ({
    position: 'absolute',
    left: 46,
    top: animValue.interpolate({ inputRange: [0,1], outputRange: [17,-9] }),
    fontSize: animValue.interpolate({ inputRange: [0,1], outputRange: [16,12] }),
    color: animValue.interpolate({ inputRange: [0,1], outputRange: ['#9aa0a6', PRIMARY] }),
    backgroundColor: '#fff',
    paddingHorizontal: 4,
    zIndex: 1,
  }), [animValue]);

  return (
    <View style={[s.inputContainer, focused && s.inputFocused]}>
      <Animated.Text style={labelStyle}>{label}</Animated.Text>
      <Icon name={icon} size={20} color={focused ? PRIMARY : '#9aa0a6'} style={s.inputIcon} />
      <TextInput
        ref={inputRef}
        style={s.input}
        value={value}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        autoCapitalize="none"
        autoComplete={autoComplete}
        secureTextEntry={secureTextEntry}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />
      {rightSlot}
    </View>
  );
}

const s = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 12, marginBottom: 16, paddingHorizontal: 14, height: 56,
    borderWidth: 1, borderColor: BORDER, position: 'relative',
  },
  inputFocused: {
    borderColor: PRIMARY, shadowColor: PRIMARY, shadowOpacity: 0.12, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: 2, backgroundColor: '#fff',
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: '#0f172a', paddingTop: 8 },
});
