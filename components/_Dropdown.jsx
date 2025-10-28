// screens/Home/_Dropdown.jsx
import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  Text,
  Modal,
  Pressable,
  Image,
  StyleSheet,
} from 'react-native';

import icExpandMore from '../assets/img/ic_expand_more.png';
import icCheck from '../assets/img/ic_check.png';

export default function Dropdown({
  label,
  value,
  options,
  onChange,
  minWidth = 160,
}) {
  const [open, setOpen] = useState(false);

  const selected = options.find((o) => o.value === value);

  return (
    <View>
      <TouchableOpacity
        style={[styles.dropdownBtn, { minWidth }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.dropdownText}>
          {label}:{' '}
          <Text style={{ fontWeight: '800', color: '#0f172a' }}>
            {selected?.label}
          </Text>
        </Text>

        <Image
          source={icExpandMore}
          style={{ width: 18, height: 18, tintColor: '#0ea5e9' }}
        />
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setOpen(false)}
        >
          <View style={styles.modalSheet}>
            {options.map((opt, idx) => {
              const active = opt.value === value;
              return (
                <TouchableOpacity
                  key={`${String(opt.value)}-${idx}`}
                  style={[
                    styles.optionRow,
                    active && { backgroundColor: '#e0f2fe' },
                  ]}
                  activeOpacity={0.7}
                  onPress={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.optionText,
                      active && {
                        color: '#0369a1',
                        fontWeight: '800',
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>

                  {active && (
                    <Image
                      source={icCheck}
                      style={{
                        width: 18,
                        height: 18,
                        tintColor: '#0369a1',
                      }}
                    />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  dropdownBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'space-between',
  },
  dropdownText: { color: '#0369a1', fontWeight: '600' },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    padding: 20,
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
  },
  optionRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e5e7eb',
  },
  optionText: { color: '#0f172a', fontSize: 14 },
});
