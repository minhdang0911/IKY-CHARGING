// components/form/FloatingTextField.jsx
import React, { useRef, useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, Animated, Platform, Pressable } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const PRIMARY = '#2563eb';
const BORDER = '#e5e7eb';
const isWeb = Platform.OS === 'web';

export default function FloatingTextField({
  value,
  onChangeText,
  label,
  icon = 'person',
  inputRef,
  returnKeyType = 'next',
  onSubmitEditing,
  autoComplete = 'username',
  secureTextEntry = false,
  rightSlot,
}) {
  const [focused, setFocused] = useState(false);
  const localRef = useRef(null);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: focused || (value && value.length > 0) ? 1 : 0,
      duration: 160,
      useNativeDriver: false,
    }).start();
  }, [focused, value, anim]);

  // ✅ Web: tránh type=password (browser autofill/reveal làm lệch)
  const webMaskStyle = isWeb && secureTextEntry 
    ? { 
        WebkitTextSecurity: 'disc',
        textSecurity: 'disc', // fallback
      } 
    : null;

  // ✅ Web: secureTextEntry=false để RNW không set type=password
  const effectiveSecure = isWeb ? false : secureTextEntry;

  const labelStyle = {
    position: 'absolute',
    left: 46,
    top: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [17, -9],
    }),
    fontSize: anim.interpolate({
      inputRange: [0, 1],
      outputRange: [16, 12],
    }),
    color: anim.interpolate({
      inputRange: [0, 1],
      outputRange: ['#9aa0a6', PRIMARY],
    }),
    backgroundColor: '#fff',
    paddingHorizontal: 4,
    zIndex: 1,
  };

  const hasRight = !!rightSlot;

  return (
    <Pressable
      style={[s.inputContainer, focused && s.inputFocused]}
      onPress={() => localRef.current?.focus()}
    >
      {/* Label */}
      <Animated.Text style={labelStyle} pointerEvents="none">
        {label}
      </Animated.Text>

      {/* Icon trái */}
      <Icon
        name={icon}
        size={20}
        color={focused ? PRIMARY : '#9aa0a6'}
        style={s.inputIcon}
        pointerEvents="none"
      />

      {/* Text Input */}
      <TextInput
        ref={(r) => {
          localRef.current = r;
          if (inputRef) {
            if (typeof inputRef === 'function') {
              inputRef(r);
            } else {
              inputRef.current = r;
            }
          }
        }}
        style={[
          s.input,
          isWeb && s.webInputReset,
          isWeb && secureTextEntry && {
            WebkitTextSecurity: 'disc',
            textSecurity: 'disc',
          },
        ]}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoCapitalize="none"
        autoComplete={autoComplete}
        secureTextEntry={effectiveSecure}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
      />

      {/* Right slot - ALWAYS render để 2 field có width giống nhau */}
      <View style={s.rightSlot} pointerEvents="box-none">
        {rightSlot}
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    paddingLeft: 14,
    paddingRight: 12,
    height: 56,
    borderWidth: 1,
    borderColor: BORDER,
    position: 'relative',
  },

  inputFocused: {
    borderColor: PRIMARY,
    shadowColor: PRIMARY,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  inputIcon: { 
    marginRight: 10 
  },

  input: {
    flex: 1,
    fontSize: 16,
    color: '#0f172a',
    paddingTop: 8,
    paddingRight: 8,
    borderWidth: 0,
  },

  // ✅ Right slot cố định width để layout không nhảy
  rightSlot: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  webInputReset: {
    outlineStyle: 'none',
    outlineWidth: 0,
    borderWidth: 0,
    boxShadow: 'none',
    backgroundColor: 'transparent',
    WebkitAppearance: 'none',
  },
});