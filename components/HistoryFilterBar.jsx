// screens/Home/HistoryFilterBar.jsx
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import SearchBar from './SearchBar';
import Dropdown from './_Dropdown';  
import icCalendarMonth from '../assets/img/ic_calendar_month (2).png';
import icExpandMore from '../assets/img/ic_expand_more (2).png';

export default function HistoryFilterBar({
  q,
  setQ,
  onSubmitSearch,

  deviceCode,
  setDeviceCode,
  deviceOptions,

  status,
  setStatus,

  range,
  setRange,

  selectedMonth,
  mode,
  fetchAllNoParams,

  portFilter,
  setPortFilter,
  portOptions,

  rangeLabelText,
  openRangeEditor,
}) {
  return (
    <View style={styles.wrapper}>
      {selectedMonth ? (
        <View style={styles.monthChipRow}>
          <TouchableOpacity
            style={[styles.monthChip, mode === 'frontend' && { backgroundColor: '#c7d2fe' }]}
            onPress={async () => {
              if (selectedMonth) {
                await fetchAllNoParams({ showSpinner: true });
              }
            }}
          >
            <Image
              source={icCalendarMonth}
              style={{ width: 16, height: 16, tintColor: '#1d4ed8', marginRight: 6 }}
            />
            <Text style={styles.monthChipText}>
              {mode === 'frontend'
                ? `Đang lọc: ${selectedMonth}`
                : `Chỉ xem tháng: ${selectedMonth}`}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <SearchBar
        placeholder="Tìm theo mã đơn (VD: 2509200001)"
        value={q}
        onChange={(text) => { setQ(text); }}
        onClear={() => { setQ(''); }}
        onSubmit={onSubmitSearch}
      />

      {/* hàng 1 */}
      <View style={styles.filterRow}>
        <Dropdown
          label="Thiết bị"
          value={deviceCode}
          onChange={setDeviceCode}
          options={deviceOptions}
          minWidth={200}
        />

        <Dropdown
          label="Trạng thái"
          value={status}
          onChange={setStatus}
          options={[
            { label: 'Tất cả', value: 'all' },
            { label: 'Đang xử lý', value: 'pending' },
            { label: 'Hoàn thành', value: 'paid' },
            { label: 'Hoàn tất', value: 'completed' },
            { label: 'Đã hủy', value: 'canceled' },
            { label: 'Thất bại', value: 'failed' },
          ]}
        />

        <Dropdown
          label="Khoảng thời gian"
          value={range}
          onChange={setRange}
          options={[
            { label: 'Tất cả', value: 'all' },
            { label: '7 ngày', value: '7d' },
            { label: '30 ngày', value: '30d' },
          ]}
        />
      </View>

      {/* hàng 2 */}
      <View style={[styles.filterRow, { marginTop: 10 }]}>
        <Dropdown
          label="Cổng sạc"
          value={portFilter}
          onChange={setPortFilter}
          options={portOptions}
          minWidth={140}
        />

        <TouchableOpacity
          style={[styles.dropdownBtn, { minWidth: 200 }]}
          onPress={openRangeEditor}
        >
          <Text style={styles.dropdownText}>
            Khoảng giờ:
            <Text style={{ fontWeight: '800', color: '#0f172a' }}>
              {' '}{rangeLabelText}
            </Text>
          </Text>
          <Image
            source={icExpandMore}
            style={{ width: 18, height: 18, tintColor: '#0ea5e9' }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 0 },

  monthChipRow: { marginBottom: 8 },
  monthChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: '#e0e7ff',
    borderWidth: 1,
    borderColor: '#c7d2fe',
  },
  monthChipText: { color: '#1d4ed8', fontWeight: '800' },

  filterRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
    flexWrap: 'wrap',
  },

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
});
