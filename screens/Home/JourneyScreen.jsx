// screens/Home/JourneyScreen.jsx
import React, { useEffect, useMemo, useState, useRef } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  Platform,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
  ToastAndroid,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ViewShot from 'react-native-view-shot';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';

import useLanguage from '../../Hooks/useLanguage';
import useDashboardData from '../../Hooks/useDashboardData';

import SectionHeader from '../../components/SectionHeader';
import OverviewCards from '../../components/overview/OverviewCards';
import KPIStats from '../../components/overview/KPIStats';
import FancyChart from '../../components/overview/FancyChart';
import CompareCard from '../../components/overview/CompareCard';

import iconsOrder from '../../assets/img/iconsOrder.png';
import iconstation from '../../assets/img/iconstation.png';
import iconsDevice from '../../assets/img/iconsDevice.png';
import iconsrevenue from '../../assets/img/iconsrevenue.png';

const LANG_KEY = 'app_language';
const SCREEN_WIDTH = Dimensions.get('window').width;

const STRINGS = {
  vi: {
    header: 'Tổng quan',
    orders: 'Đơn hàng',
    sessions: 'Phiên sạc',
    devices: 'Thiết bị',
    revenue: 'Doanh thu',
    monthlyRevenue: 'Doanh thu hàng tháng',
    empty: 'Chưa có dữ liệu doanh thu.',
    pullToRefresh: 'Kéo để làm mới',
    compare: 'So sánh',
    selectMonth: 'Chọn tháng',
    result: 'Kết quả',
    increase: 'Tăng',
    decrease: 'Giảm',
    equal: 'Không đổi',
    yoy: 'MoM',
    ytd: 'YTD',
    avg: 'TB/Tháng',
    activeMonths: 'Tháng có doanh thu',
    highest: 'Cao nhất',
    lowest: 'Thấp nhất',
    toHistory: 'Xem lịch sử tháng',
    shareReport: 'Chia sẻ báo cáo',
    watermark: 'Báo cáo tự động từ IKY Charging',
    export: 'Xuất CSV',
  },
  en: {
    header: 'Overview',
    orders: 'Orders',
    sessions: 'Sessions',
    devices: 'Devices',
    revenue: 'Revenue',
    monthlyRevenue: 'Monthly revenue',
    empty: 'No revenue data yet.',
    pullToRefresh: 'Pull to refresh',
    compare: 'Compare',
    selectMonth: 'Select month',
    result: 'Result',
    increase: 'Up',
    decrease: 'Down',
    equal: 'No change',
    yoy: 'MoM',
    ytd: 'YTD',
    avg: 'Avg/Month',
    activeMonths: 'Months with revenue',
    highest: 'Highest',
    lowest: 'Lowest',
    toHistory: 'View month history',
    shareReport: 'Share report',
    watermark: 'Auto report from IKY Charging',
    export: 'Export CSV',
  },
};

export default function JourneyScreen({ navigateToScreen }) {
  const { language, setLanguage } = useLanguage('vi');
  const L = useMemo(() => STRINGS[language] || STRINGS.vi, [language]);

  const {
    overview,
    revenueData,
    months,
    refreshing,
    refresh,
    goHistoryWithMonth,
  } = useDashboardData();

  const [chartMode, setChartMode] = useState('bar');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [m1, setM1] = useState('');
  const [m2, setM2] = useState('');

  // Hidden report shot
  const reportRef = useRef(null);

  // Tooltip overlay (iOS/fallback)
  const [tip, setTip] = useState('');
  const [tipVisible, setTipVisible] = useState(false);
  const showTip = (msg) => {
    if (Platform.OS === 'android') {
      try { ToastAndroid.show(msg, ToastAndroid.SHORT); return; } catch {}
    }
    setTip(msg);
    setTipVisible(true);
    setTimeout(() => setTipVisible(false), 1500);
  };

  // boot language from cache
  useEffect(() => {
    (async () => {
      try {
        const s = await AsyncStorage.getItem(LANG_KEY);
        if (s) setLanguage(s);
      } catch {}
    })();
  }, [setLanguage]);

  // init compare defaults
  useEffect(() => {
    if (!months?.length) return;
    if (!m1 || !m2) {
      if (months.length >= 2) {
        setM1(months[months.length - 2]);
        setM2(months[months.length - 1]);
      } else {
        setM1(months[0]);
        setM2(months[0]);
      }
    }
  }, [months]); // eslint-disable-line

  const chartWidth = Math.max(
    SCREEN_WIDTH - 32,
    Math.max(revenueData.length, 1) * 80,
  );

  const maxMin = useMemo(() => {
    if (!revenueData.length) return null;
    let max = { month: '', revenue: -Infinity },
      min = { month: '', revenue: Infinity };
    for (const r of revenueData) {
      if (r.revenue > max.revenue) max = r;
      if (r.revenue < min.revenue) min = r;
    }
    return { max, min };
  }, [revenueData]);

  const a = revenueData.find(x => x.month === m1);
  const b = revenueData.find(x => x.month === m2);

  // ====================== CSV EXPORT (VI chuyên nghiệp) ======================
  function parseMYLoose(s='') {
    const map = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
    const t = String(s).trim();
    let m, y;

    let mm = t.match(/^(\d{1,2})[-/](\d{2,4})$/);
    if (mm) { m=+mm[1]; y=+mm[2]; return { m, y: y<100?2000+y:y }; }

    mm = t.match(/^([A-Za-z]{3})[-/](\d{2})$/);
    if (mm) { m = map[mm[1].toLowerCase()]||1; y = 2000+(+mm[2]); return { m, y }; }

    mm = t.match(/^(\d{4})[-/](\d{1,2})$/);
    if (mm) return { y:+mm[1], m:+mm[2] };

    return { m:1, y:1970 };
  }
  function fmtMYvi({m,y}) {
    const mm = m<10?`0${m}`:String(m);
    return `${mm}-${y}`;
  }
  function getRangeFileNameVi(rows=[]) {
    if (!rows.length) return 'Doanh thu (trống).csv';
    const first = parseMYLoose(rows[0].month);
    const last  = parseMYLoose(rows[rows.length-1].month);
    return `Doanh thu ${fmtMYvi(first)} đến ${fmtMYvi(last)}.csv`;
  }

  function buildRevenueCSV(rows = [], locale = 'vi-VN') {
    const BOM = '\uFEFF';
    const now = new Date();
    const exportedAt = now.toLocaleString(locale);

    const rangeStart = rows[0]?.month || '';
    const rangeEnd   = rows.at(-1)?.month || '';

    const sum = rows.reduce((a,b)=>a+Number(b?.revenue||0),0);
    const monthsCount = rows.length;
    const avg = monthsCount ? Math.round(sum / monthsCount) : 0;
    const monthsPositive = rows
      .filter(x => Number(x?.revenue||0) > 0)
      .map(x => x.month);
    const positiveCount = monthsPositive.length;

    const headerLines = [
      'BÁO CÁO DOANH THU (Đơn vị: VND)',
      `Khoảng thời gian: ${rangeStart} đến ${rangeEnd}`,
      `Thời điểm xuất: ${exportedAt}`,
      '',
      'Tháng,Doanh thu (VND)',
    ];

    const body = rows.map(r => {
      const m = String(r?.month ?? '').replace(/,/g, '');
      const v = Number(r?.revenue || 0);
      // Ép cột tháng thành text để Excel không đổi 11-2025 => Nov-25
      return `"Tháng ${m}",${v}`;

    });

    const monthsList = monthsPositive.length ? monthsPositive.join('; ') : 'Không có';
    const footer = [
      '',
      `Tổng doanh thu (VND),${sum}`,
      `Doanh thu trung bình theo tháng (VND),${avg}`,
      `Giải thích trung bình,"Tổng doanh thu (${sum}) chia cho số tháng trong kỳ (${monthsCount})."`,
   
    ];

    return BOM + [...headerLines, ...body, ...footer].join('\n');
  }

  const onExportCSV = async () => {
    try {
      if (!revenueData?.length) return;
      const csv = buildRevenueCSV(revenueData);

      const dir = Platform.select({
        ios: RNFS.TemporaryDirectoryPath,
        android: RNFS.CachesDirectoryPath,
      });
      const filePath = `${dir}/${getRangeFileNameVi(revenueData)}`;

      await RNFS.writeFile(filePath, csv, 'utf8');

      const url =
        Platform.OS === 'android'
          ? (filePath.startsWith('file://') ? filePath : `file://${filePath}`)
          : filePath;

      await Share.open({
        url,
        type: 'text/csv',
        failOnCancel: false,
        title: 'Xuất CSV',
      });
    } catch (e) {
      console.warn('[ExportCSV] error:', e?.message || e);
    }
  };
  // ==================== END CSV EXPORT ====================

  const onShareReport = async () => {
    try {
      const uri = await reportRef.current?.capture({
        format: 'png',
        quality: 0.98,
        result: 'tmpfile',
      });
      if (!uri) return;
      const url =
        Platform.OS === 'android'
          ? uri.startsWith('file://')
            ? uri
            : `file://${uri}`
          : uri;
      await Share.open({
        url,
        type: 'image/png',
        failOnCancel: false,
        title: L.shareReport,
      });
    } catch (e) {
      console.warn('[ShareReport] error:', e?.message || e);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>{L.header}</Text>
        {/* <TouchableOpacity
          onPress={() => setLanguage(language === 'vi' ? 'en' : 'vi')}
        >
          <Icon name="translate" size={20} color="#fff" />
        </TouchableOpacity> */}
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            title={L.pullToRefresh}
          />
        }
      >
        {/* Overview */}
        <OverviewCards
          L={L}
          overview={overview}
          icons={{
            orders: iconsOrder,
            sessions: iconstation,
            devices: iconsDevice,
            revenue: iconsrevenue,
          }}
          onOrdersPress={async () => {
            try {
              await AsyncStorage.setItem(
                'EV_HISTORY_PREF',
                JSON.stringify({ preselectedDeviceId: 'all' }),
              );
            } catch {}
            navigateToScreen && navigateToScreen('historyExtend');
          }}
          onSessionsPress={() =>
            navigateToScreen && navigateToScreen('chargingSession')
          }
        />

        {/* Chart header + actions */}
        <SectionHeader
          title={L.monthlyRevenue}
          right={
            <View style={s.actions}>
              {/* Xuất CSV */}
              <TouchableOpacity
                style={s.iconBtn}
                onPress={onExportCSV}
                onLongPress={() => showTip('Xuất báo cáo CSV (VND)')}
                accessibilityLabel="Xuất CSV"
              >
                <Icon name="file-download" size={18} color="#64748B" />
              </TouchableOpacity>

              {/* Chia sẻ ảnh báo cáo */}
              <TouchableOpacity
                style={s.iconBtn}
                onPress={onShareReport}
                onLongPress={() => showTip('Chia sẻ báo cáo dạng ảnh')}
                accessibilityLabel="Chia sẻ ảnh báo cáo"
              >
                <Icon name="ios-share" size={18} color="#64748B" />
              </TouchableOpacity>

              {/* Bar */}
              <TouchableOpacity
                style={[s.iconBtn, chartMode === 'bar' && s.iconBtnActive]}
                onPress={() => setChartMode('bar')}
                onLongPress={() => showTip('Chế độ biểu đồ cột')}
                accessibilityLabel="Biểu đồ cột"
              >
                <Icon
                  name="bar-chart"
                  size={18}
                  color={chartMode === 'bar' ? '#2563EB' : '#64748B'}
                />
              </TouchableOpacity>

              {/* Line */}
              <TouchableOpacity
                style={[s.iconBtn, chartMode === 'line' && s.iconBtnActive]}
                onPress={() => setChartMode('line')}
                onLongPress={() => showTip('Chế độ biểu đồ đường')}
                accessibilityLabel="Biểu đồ đường"
              >
                <Icon
                  name="show-chart"
                  size={18}
                  color={chartMode === 'line' ? '#2563EB' : '#64748B'}
                />
              </TouchableOpacity>
            </View>
          }
        />

        {/* Chart */}
        {revenueData.length === 0 ? (
          <View style={[s.chartEmpty]}>
            <Text style={{ color: '#64748B' }}>{L.empty}</Text>
          </View>
        ) : (
          <>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 8 }}
            >
              <FancyChart
                mode={chartMode}
                width={chartWidth}
                height={280}
                labels={revenueData.map(i => i.month)}
                values={revenueData.map(i => i.revenue)}
                accent="#2563EB"
                onBarPress={i => setSelectedMonth(revenueData[i]?.month || '')}
              />
            </ScrollView>

            {selectedMonth ? (
              <View style={{ marginTop: 8, marginBottom: 12 }}>
                <TouchableOpacity
                  onPress={() =>
                    goHistoryWithMonth(navigateToScreen, selectedMonth)
                  }
                  style={s.toHistoryBtn}
                >
                  <Icon name="history" size={18} color="#fff" />
                  <Text style={s.toHistoryText}>
                    {L.toHistory}: {selectedMonth}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}

        {/* Highest / Lowest */}
        {maxMin ? (
          <View style={s.summaryRow}>
            <View style={s.summaryPill}>
              <Icon name="trending-up" size={16} color="#0EA5E9" />
              <Text style={s.summaryText}>
                {STRINGS[language].highest}: {maxMin.max.month} —{' '}
                {(maxMin.max.revenue || 0).toLocaleString('vi-VN')}đ
              </Text>
            </View>
            <View style={s.summaryPill}>
              <Icon name="trending-down" size={16} color="#EF4444" />
              <Text style={s.summaryText}>
                {STRINGS[language].lowest}: {maxMin.min.month} —{' '}
                {(maxMin.min.revenue || 0).toLocaleString('vi-VN')}đ
              </Text>
            </View>
          </View>
        ) : null}

        {/* Compare */}
        <CompareCard
          L={STRINGS[language]}
          months={months}
          m1={m1}
          setM1={setM1}
          m2={m2}
          setM2={setM2}
          a={a}
          b={b}
        />

        {/* Tooltip overlay (iOS/fallback) */}
        {tipVisible ? (
          <View style={s.tipWrap}>
            <Text style={s.tipText}>{tip}</Text>
          </View>
        ) : null}

        {/* ===================== REPORTSHOT (HIDDEN) ===================== */}
        <View
          style={{ position: 'absolute', left: -9999, top: 0 }}
          pointerEvents="none"
        >
          <ViewShot
            ref={reportRef}
            options={{ format: 'png', quality: 0.98 }}
            style={{
              backgroundColor: '#fff',
              width: 1080,
              padding: 32,
              borderRadius: 24,
            }}
          >
            {/* Title + timestamp */}
            <View style={{ marginBottom: 18 }}>
              <Text
                style={{ fontSize: 28, fontWeight: '800', color: '#111827' }}
              >
                {L.header} / {L.monthlyRevenue}
              </Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
                {new Date().toLocaleString('vi-VN')}
              </Text>
            </View>

            {/* KPI (re-use) */}
            <KPIStats L={L} revenueData={revenueData} />

            {/* Chart fixed size (no scroll, no buttons) */}
            <View
              style={{
                marginTop: 10,
                backgroundColor: '#fff',
                borderRadius: 16,
              }}
            >
              <FancyChart
                mode="bar"
                width={1016}
                height={420}
                labels={revenueData.map(i => i.month)}
                values={revenueData.map(i => i.revenue)}
                accent="#2563EB"
                alwaysShowValue={true}
              />
            </View>

            {/* Highest / Lowest (re-use, text only) */}
            {maxMin ? (
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#EAF6FF',
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Icon name="trending-up" size={18} color="#0EA5E9" />
                  <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                    {STRINGS[language].highest}: {maxMin.max.month} —{' '}
                    {(maxMin.max.revenue || 0).toLocaleString('vi-VN')}đ
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: '#FEE2E2',
                    borderRadius: 999,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Icon name="trending-down" size={18} color="#EF4444" />
                  <Text style={{ fontWeight: '700', color: '#0F172A' }}>
                    {STRINGS[language].lowest}: {maxMin.min.month} —{' '}
                    {(maxMin.min.revenue || 0).toLocaleString('vi-VN')}đ
                  </Text>
                </View>
              </View>
            ) : null}

            {/* Watermark */}
            <Text
              style={{
                marginTop: 14,
                color: '#94A3B8',
                fontSize: 12,
                textAlign: 'right',
              }}
            >
              {L.watermark}
            </Text>
          </ViewShot>
        </View>
        {/* =================== END REPORTSHOT (HIDDEN) =================== */}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fb' },

  header: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'ios' ? 16 : 12,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: { color: 'white', fontSize: 18, fontWeight: '600', flex: 1 },

  scroll: { padding: 16, paddingBottom: 40 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconBtn: {
    height: 36,
    width: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    marginLeft: 8,
    alignSelf: 'center',
  },
  iconBtnActive: { borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' },

  chartEmpty: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    marginBottom: 12,
  },

  toHistoryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#1D4ED8',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toHistoryText: { color: '#fff', fontWeight: '800' },

  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EAF6FF',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flex: 1,
  },
  summaryText: { color: '#0F172A', fontSize: 12, fontWeight: '600' },

  tipWrap: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  tipText: {
    backgroundColor: 'rgba(17,24,39,0.92)',
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
});
