// screens/Home/DateTimeRangePickerModal.jsx
import React, { useMemo } from 'react';
import {
  Modal, Pressable, View, Text, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2,'0');
    const mi = String(d.getMinutes()).padStart(2,'0');
    return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
  } catch { return '—'; }
}

export default function DateTimeRangePickerModal({
  visible,
  onClose,

  tmpFromTs,
  tmpToTs,
  setTmpFromTs,
  setTmpToTs,

  iosPickerTarget,
  setIosPickerTarget,
  iosPickerValue,
  setIosPickerValue,

  applyTmpRange,
  clearRange,
  setShowRangeModal,
}) {

  const tmpFromLabel = tmpFromTs != null
    ? fmtDate(new Date(tmpFromTs).toISOString())
    : 'Chọn thời điểm bắt đầu';

  const tmpToLabel = tmpToTs != null
    ? fmtDate(new Date(tmpToTs).toISOString())
    : 'Chọn thời điểm kết thúc';

  // android 2-phase
  function openPicker(target) {
    const baseDate =
      target === 'from'
        ? (tmpFromTs != null ? new Date(tmpFromTs) : new Date())
        : (tmpToTs   != null ? new Date(tmpToTs)   : new Date());

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: baseDate,
        mode: 'date',
        onChange: (event, datePickedDay) => {
          if (event.type === 'dismissed' || !datePickedDay) return;
          DateTimePickerAndroid.open({
            value: datePickedDay,
            mode: 'time',
            is24Hour: true,
            onChange: (event2, datePickedTime) => {
              if (event2.type === 'dismissed' || !datePickedTime) return;
              const ts = datePickedTime.getTime();
              if (target === 'from') setTmpFromTs(ts);
              else setTmpToTs(ts);
            },
          });
        },
      });
    } else {
      // iOS spinner inline
      setIosPickerTarget(target);
      setIosPickerValue(baseDate);
    }
  }

  const pickFrom = () => openPicker('from');
  const pickTo   = () => openPicker('to');

  // iOS spinner onChange
  const onIOSPickerChange = (event, date) => {
    if (!date) return;
    const ts = date.getTime();
    if (iosPickerTarget === 'from') {
      setTmpFromTs(ts);
    } else if (iosPickerTarget === 'to') {
      setTmpToTs(ts);
    }
    setIosPickerValue(date); // giữ spinner mở cho user chỉnh tiếp
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.modalBackdrop}
        onPress={onClose}
      >
        <View style={styles.rangeSheet}>
          <Text style={styles.rangeTitle}>Chọn khoảng thời gian tuỳ chọn</Text>
          <Text style={styles.rangeHint}>Dùng để lọc theo giờ/phút cụ thể</Text>

          {/* FROM */}
          <View style={{ marginTop: 12 }}>
            <Text style={styles.rangeLabel}>Từ (From)</Text>
            <TouchableOpacity
              style={styles.rangeInputBtn}
              onPress={pickFrom}
            >
              <Text style={styles.rangeInputText}>{tmpFromLabel}</Text>
            </TouchableOpacity>
          </View>

          {/* TO */}
          <View style={{ marginTop: 12 }}>
            <Text style={styles.rangeLabel}>Đến (To)</Text>
            <TouchableOpacity
              style={styles.rangeInputBtn}
              onPress={pickTo}
            >
              <Text style={styles.rangeInputText}>{tmpToLabel}</Text>
            </TouchableOpacity>
          </View>

          {/* iOS spinner */}
          {iosPickerTarget && Platform.OS === 'ios' && (
            <View
              style={styles.iosPickerWrap}
            >
              <DateTimePicker
                value={iosPickerValue}
                mode="datetime"
                display="spinner"
                is24Hour={true}
                onChange={onIOSPickerChange}
              />
            </View>
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.rangeBtn, { backgroundColor: '#e2e8f0' }]}
              onPress={() => {
                clearRange();
              }}
            >
              <Text style={[styles.rangeBtnText, { color: '#0f172a' }]}>
                Xóa
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.rangeBtn, { backgroundColor: '#4A90E2' }]}
              onPress={() => {
                applyTmpRange();
              }}
            >
              <Text style={[styles.rangeBtnText, { color: '#fff' }]}>
                Áp dụng
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.25)',
    justifyContent: 'center',
    padding: 20,
  },
  rangeSheet: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
  },
  rangeTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  rangeHint: { fontSize: 12, color: '#64748b', marginTop: 4 },

  rangeLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 4,
  },

  rangeInputBtn: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  rangeInputText: {
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '600',
  },

  iosPickerWrap: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 8,
    backgroundColor: '#fff',
  },

  btnRow: {
    flexDirection: 'row',
    marginTop: 20,
    justifyContent: 'flex-end',
    gap: 12,
  },
  rangeBtn: {
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  rangeBtnText: { fontSize: 14, fontWeight: '700' },
});
