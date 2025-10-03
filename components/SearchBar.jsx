// components/SearchBar.jsx
import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function SearchBar({ placeholder, value, onChange, onClear, onSubmit }) {
  return (
    <View style={styles.searchWrap}>
      <Icon name="search" size={18} color="#0ea5e9" />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        style={styles.searchInput}
        value={value}
        onChangeText={onChange}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={onClear}>
          <Icon name="close" size={18} color="#94a3b8" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginHorizontal: 8,
    color: '#0f172a',
  },
});
