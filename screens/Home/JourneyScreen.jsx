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
  Alert,
  useWindowDimensions,
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
const isWeb = Platform.OS === 'web';

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
  const { width: winW } = useWindowDimensions();
  const isNarrow = winW < 360;

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

  const reportRef = useRef(null);
  const chartRef = useRef(null);

  const [tip, setTip] = useState('');
  const [tipVisible, setTipVisible] = useState(false);
  const notify = (msg) => {
    if (Platform.OS === 'android') ToastAndroid.show(msg, ToastAndroid.SHORT);
    else Alert.alert('', msg);
  };
  const showTip = (msg) => {
    if (Platform.OS === 'android') {
      try { ToastAndroid.show(msg, ToastAndroid.SHORT); return; } catch {}
    }
    setTip(msg); setTipVisible(true); setTimeout(() => setTipVisible(false), 1500);
  };

  useEffect(() => { (async () => {
    try { const s = await AsyncStorage.getItem(LANG_KEY); if (s) setLanguage(s); } catch {}
  })(); }, [setLanguage]);

  useEffect(() => {
    if (!months?.length) return;
    if (!m1 || !m2) {
      if (months.length >= 2) { setM1(months[months.length-2]); setM2(months[months.length-1]); }
      else { setM1(months[0]); setM2(months[0]); }
    }
  }, [months]);

  const chartWidth = Math.max(SCREEN_WIDTH - 32, Math.max(revenueData.length, 1) * 80);

  const maxMin = useMemo(() => {
    if (!revenueData.length) return null;
    let max = { month: '', revenue: -Infinity }, min = { month: '', revenue: Infinity };
    for (const r of revenueData) { if (r.revenue > max.revenue) max = r; if (r.revenue < min.revenue) min = r; }
    return { max, min };
  }, [revenueData]);

  const a = revenueData.find(x => x.month === m1);
  const b = revenueData.find(x => x.month === m2);

  // ===== CSV helpers =====
  function parseMYLoose(s=''){const map={jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};const t=String(s).trim();let m,y;let mm=t.match(/^(\d{1,2})[-/](\d{2,4})$/);if(mm){m=+mm[1];y=+mm[2];return{m,y:y<100?2000+y:y}}mm=t.match(/^([A-Za-z]{3})[-/](\d{2})$/);if(mm){m=map[mm[1].toLowerCase()]||1;y=2000+(+mm[2]);return{m,y}}mm=t.match(/^(\d{4})[-/](\d{1,2})$/);if(mm)return{y:+mm[1],m:+mm[2]};return{m:1,y:1970}}
  function fmtMYvi({m,y}){const mm=m<10?`0${m}`:String(m);return `${mm}-${y}`}
  function getRangeFileNameVi(rows=[]){if(!rows.length)return'Doanh thu (trống).csv';const first=parseMYLoose(rows[0].month);const last=parseMYLoose(rows[rows.length-1].month);return`Doanh thu ${fmtMYvi(first)} đến ${fmtMYvi(last)}.csv`}
  function buildRevenueCSV(rows=[],locale='vi-VN'){const BOM='\uFEFF';const now=new Date();const exportedAt=now.toLocaleString(locale);const rangeStart=rows[0]?.month||'';const rangeEnd=rows.at(-1)?.month||'';const sum=rows.reduce((a,b)=>a+Number(b?.revenue||0),0);const monthsCount=rows.length;const avg=monthsCount?Math.round(sum/monthsCount):0;const headerLines=['BÁO CÁO DOANH THU (Đơn vị: VND)',`Khoảng thời gian: ${rangeStart} đến ${rangeEnd}`,`Thời điểm xuất: ${exportedAt}`,'','Tháng,Doanh thu (VND)'];const body=rows.map(r=>{const m=String(r?.month??'').replace(/,/g,'');const v=Number(r?.revenue||0);return`"Tháng ${m}",${v}`});const footer=['',`Tổng doanh thu (VND),${sum}`,`Doanh thu trung bình theo tháng (VND),${avg}`,`Giải thích trung bình,"Tổng doanh thu (${sum}) chia cho số tháng trong kỳ (${monthsCount})."`];return BOM+[...headerLines,...body,...footer].join('\n')}
  const exportCSVWeb=(csv,filename)=>{const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});const link=document.createElement('a');const url=URL.createObjectURL(blob);link.href=url;link.download=filename;document.body.appendChild(link);link.click();document.body.removeChild(link);URL.revokeObjectURL(url)}
  const exportCSVMobile=async(csv,filename)=>{const dir=Platform.select({ios:RNFS.TemporaryDirectoryPath,android:RNFS.CachesDirectoryPath});const filePath=`${dir}/${filename}`;await RNFS.writeFile(filePath,csv,'utf8');const url=Platform.OS==='android'?(filePath.startsWith('file://')?filePath:`file://${filePath}`):filePath;await Share.open({url,type:'text/csv',failOnCancel:false,title:'Xuất CSV'})}
  const exportCSV=async()=>{try{if(!revenueData?.length){notify('Không có dữ liệu để xuất');return}const csv=buildRevenueCSV(revenueData);const filename=getRangeFileNameVi(revenueData);if(isWeb){exportCSVWeb(csv,filename);notify('Đã tải CSV thành công')}else{await exportCSVMobile(csv,filename)}}catch(e){console.warn('[ExportCSV] error:',e?.message||e);notify('Xuất CSV thất bại')}}

  // ===== Share image =====
  const shareChartAsImageWeb = async () => {
    try {
      const html2canvas = (await import('html2canvas')).default;
      if (!chartRef.current) { notify('Không tìm thấy biểu đồ'); return; }
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#ffffff', scale: 2 });
      canvas.toBlob((blob) => {
        if (!blob) { notify('Chụp ảnh thất bại'); return; }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a'); link.href = url; link.download = `chart_${Date.now()}.png`;
        document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
        notify('Đã tải ảnh thành công');
      });
    } catch (e) { console.warn('[ShareImageWeb] error:', e?.message || e); notify('Chia sẻ ảnh thất bại'); }
  };
  const shareChartAsImageMobile = async () => {
    try {
      if (!reportRef.current) { notify('Không tìm thấy vùng chụp ảnh'); return; }
      const uri = await reportRef.current.capture();
      if (!uri) { notify('Chụp ảnh thất bại'); return; }
      await Share.open({ url: uri.startsWith('file://') ? uri : `file://${uri}`, type: 'image/png', failOnCancel: false });
    } catch (e) { console.warn('[ShareImageMobile] error:', e?.message || e); notify('Chia sẻ ảnh thất bại'); }
  };
  const shareChartAsImage = async () => { if (isWeb) await shareChartAsImageWeb(); else await shareChartAsImageMobile(); };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>{L.header}</Text>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} title={L.pullToRefresh} />}
      >
        <OverviewCards
          L={L}
          overview={overview}
          icons={{ orders: iconsOrder, sessions: iconstation, devices: iconsDevice, revenue: iconsrevenue }}
          onOrdersPress={async () => {
            try { await AsyncStorage.setItem('EV_HISTORY_PREF', JSON.stringify({ preselectedDeviceId: 'all' })); } catch {}
            navigateToScreen && navigateToScreen('historyExtend');
          }}
          onSessionsPress={() => navigateToScreen && navigateToScreen('chargingSession')}
        />

        <SectionHeader
          title={L.monthlyRevenue}
          right={
            <View style={s.smallTabRow}>
              <TouchableOpacity style={s.smallTabBtn} onPress={exportCSV} activeOpacity={0.85}>
                <Text style={s.smallTabText}>Tải CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.smallTabBtn, !revenueData.length && s.smallTabBtnDisabled]}
                onPress={shareChartAsImage}
                activeOpacity={0.85}
                disabled={!revenueData.length}
              >
                <Text style={[s.smallTabText, !revenueData.length && s.smallTabTextDisabled]}>Chia sẻ ảnh</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.smallTabBtn, chartMode === 'bar' && s.smallTabBtnActive]}
                onPress={() => setChartMode('bar')}
                activeOpacity={0.85}
              >
                <Text style={[s.smallTabText, chartMode === 'bar' && s.smallTabTextActive]}>Bar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.smallTabBtn, chartMode === 'line' && s.smallTabBtnActive]}
                onPress={() => setChartMode('line')}
                activeOpacity={0.85}
              >
                <Text style={[s.smallTabText, chartMode === 'line' && s.smallTabTextActive]}>Line</Text>
              </TouchableOpacity>
            </View>
          }
        />

        {revenueData.length === 0 ? (
          <View style={[s.chartEmpty]}><Text style={{ color: '#64748B' }}>{L.empty}</Text></View>
        ) : (
          <>
            <View ref={chartRef} style={{ backgroundColor: '#fff', padding: 16, borderRadius: 12 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 8 }}>
               <FancyChart
                mode={chartMode}
                width={chartWidth}
                height={280}
                labels={revenueData.map(i => i.month)}
                values={revenueData.map(i => i.revenue)}
                accent="#2563EB"
                onBarPress={i => setSelectedMonth(revenueData[i]?.month || '')}
                tooltipMode="press"      // 👈 chỉ bấm mới hiện
                alwaysShowValue={false}  // 👈 không in số trên đỉnh
              />

              </ScrollView>
            </View>

            {selectedMonth ? (
              <View style={{ marginTop: 8, marginBottom: 12 }}>
                <TouchableOpacity onPress={() => goHistoryWithMonth(navigateToScreen, selectedMonth)} style={s.toHistoryBtn}>
                  <Icon name="history" size={18} color="#fff" />
                  <Text style={s.toHistoryText}>{L.toHistory}: {selectedMonth}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </>
        )}

        {/* ==== HIGH / LOW summary — 3 dòng, không bể trên iPhone ==== */}
        {maxMin ? (
          <View style={[s.hiloRow, isNarrow && { flexWrap: 'wrap' }]}>
            {/* High */}
            <View style={[s.hiloBox, isNarrow ? { flexBasis:'100%' } : { flexBasis:'48%' }]}>
              <View style={s.hiloIcon}><Icon name="trending-up" size={16} color="#0EA5E9" /></View>
              <View style={{ flex:1, minWidth:0 }}>
                <Text style={s.hiloTitle}>{L.highest}</Text>
                <Text style={s.hiloMonth} numberOfLines={1}>{maxMin.max.month || '—'}</Text>
                <Text style={s.hiloValue}>
                  {(maxMin.max.revenue || 0).toLocaleString('vi-VN')}đ
                </Text>
              </View>
            </View>
            {/* Low */}
            <View style={[s.hiloBox, isNarrow ? { flexBasis:'100%' } : { flexBasis:'48%' }]}>
              <View style={[s.hiloIcon, { backgroundColor:'#FFE4E6' }]}>
                <Icon name="trending-down" size={16} color="#EF4444" />
              </View>
              <View style={{ flex:1, minWidth:0 }}>
                <Text style={s.hiloTitle}>{L.lowest}</Text>
                <Text style={s.hiloMonth} numberOfLines={1}>{maxMin.min.month || '—'}</Text>
                <Text style={[s.hiloValue, { color:'#EF4444' }]}>
                  {(maxMin.min.revenue || 0).toLocaleString('vi-VN')}đ
                </Text>
              </View>
            </View>
          </View>
        ) : null}

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

        {tipVisible ? (
          <View style={s.tipWrap}><Text style={s.tipText}>{tip}</Text></View>
        ) : null}

        {/* Hidden ViewShot cho Mobile */}
        {!isWeb && (
          <View style={{ position: 'absolute', left: -9999, top: 0 }} pointerEvents="none">
            <ViewShot
              ref={reportRef}
              options={{ format: 'png', quality: 0.98 }}
              style={{ backgroundColor: '#fff', width: 1080, padding: 32, borderRadius: 24 }}
            >
              <View style={{ marginBottom: 18 }}>
                <Text style={{ fontSize: 28, fontWeight: '800', color: '#111827' }}>
                  {L.header} / {L.monthlyRevenue}
                </Text>
                <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 6 }}>
                  {new Date().toLocaleString('vi-VN')}
                </Text>
              </View>

              <KPIStats L={L} revenueData={revenueData} />

              <View style={{ marginTop: 10, backgroundColor: '#fff', borderRadius: 16 }}>
                <FancyChart
                  mode="bar"
                  width={1016}
                  height={420}
                  labels={revenueData.map(i => i.month)}
                  values={revenueData.map(i => i.revenue)}
                  accent="#2563EB"
                  alwaysShowValue={true}
                  tooltipMode="always"
                />
              </View>

              {maxMin ? (
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <View style={{
                    flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#EAF6FF',
                    borderRadius:999,paddingHorizontal:12,paddingVertical:8,
                  }}>
                    <Icon name="trending-up" size={18} color="#0EA5E9" />
                    <Text style={{ fontWeight:'700', color:'#0F172A' }}>
                      {L.highest}: {maxMin.max.month} — {(maxMin.max.revenue || 0).toLocaleString('vi-VN')}đ
                    </Text>
                  </View>
                  <View style={{
                    flexDirection:'row',alignItems:'center',gap:6,backgroundColor:'#FEE2E2',
                    borderRadius:999,paddingHorizontal:12,paddingVertical:8,
                  }}>
                    <Icon name="trending-down" size={18} color="#EF4444" />
                    <Text style={{ fontWeight:'700', color:'#0F172A' }}>
                      {L.lowest}: {maxMin.min.month} — {(maxMin.min.revenue || 0).toLocaleString('vi-VN')}đ
                    </Text>
                  </View>
                </View>
              ) : null}

              <Text style={{ marginTop: 14, color: '#94A3B8', fontSize: 12, textAlign: 'right' }}>
                {L.watermark}
              </Text>
            </ViewShot>
          </View>
        )}
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
  scroll: { padding: 16, paddingBottom: Platform.OS === 'web' ? 120 : 80 },

  smallTabRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAFC', borderRadius: 10, overflow: 'hidden',
  },
  smallTabBtn: {
    paddingVertical: 6, paddingHorizontal: 10,
    backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0',
    marginHorizontal: 3, borderRadius: 8,
  },
  smallTabBtnActive: { backgroundColor: '#EEF2FF', borderColor: '#2563EB' },
  smallTabBtnDisabled: { opacity: 0.5 },
  smallTabText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  smallTabTextActive: { color: '#2563EB', fontWeight: '700' },
  smallTabTextDisabled: { color: '#94A3B8' },

  chartEmpty: {
    backgroundColor: '#fff', borderRadius: 16, paddingVertical: 24, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 3,
    marginBottom: 12,
  },
  toHistoryBtn: {
    alignSelf:'flex-start', backgroundColor:'#1D4ED8', paddingVertical:10, paddingHorizontal:14,
    borderRadius:12, flexDirection:'row', alignItems:'center', gap:8,
  },
  toHistoryText: { color:'#fff', fontWeight:'800' },

  // ==== Hi/Lo boxes ====
  hiloRow: { flexDirection:'row', justifyContent:'space-between', gap:8, marginBottom:12 },
  hiloBox: {
    flexDirection:'row', alignItems:'center', gap:10,
    backgroundColor:'#F8FAFC', borderRadius:14, borderWidth:1, borderColor:'#E5E7EB',
    paddingVertical:10, paddingHorizontal:12, minWidth:0,
  },
  hiloIcon: {
    width:28, height:28, borderRadius:999, backgroundColor:'#EAF6FF',
    alignItems:'center', justifyContent:'center',
  },
  hiloTitle: { fontSize:12, color:'#64748B', fontWeight:'700' },
  hiloMonth: { fontSize:12, color:'#0F172A', fontWeight:'700' },
  hiloValue: { fontSize:16, color:'#0F172A', fontWeight:'800', marginTop:2 },

  tipWrap: {
    position: 'absolute', bottom: 100, alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8,
  },
  tipText: { color: '#fff', fontSize: 14 },
});
  