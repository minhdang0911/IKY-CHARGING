// screens/.../DeviceList.jsx
import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  RefreshControl, Platform, useWindowDimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDevices, getExtendHistory } from '../../apis/devices';
import { showMessage } from '../../components/Toast/Toast';
import PortCardSkeleton from '../../components/Skeletons/PortCardSkeleton';

const LANG_KEY = 'app_language';
const K_DEVICES = 'ev_devices_cache_v1';
const K_HISTORY_PREF = 'EV_HISTORY_PREF';

const STRINGS = {
  vi: {
    header: 'Thiết bị sạc',
    searchPH: 'Tìm theo mã / tên / vị trí…',
    filters: { all:'Tất cả', online:'Online', offline:'Offline' },
    ports: 'Số cổng',
    lastHb: 'Hoạt động gần nhất',
    fw: 'FW',
    monitor: 'Giám sát',
    details: 'Chi tiết',
    settings: 'Cài đặt',
    history: 'Lịch sử',
    empty: 'Không có thiết bị nào',
    createOrder: 'Tạo đơn',
    offlineHint: 'Thiết bị đang offline, không thể tạo đơn.',
    deviceCode: 'Mã thiết bị',
    voltage: 'Điện áp',
    temp: 'Nhiệt độ',
  },
  en: {
    header: 'Chargers',
    searchPH: 'Search by code / name / location…',
    filters: { all:'All', online:'Online', offline:'Offline', charging:'Charging', fault:'Fault' },
    ports: 'Ports',
    lastHb: 'Last heartbeat',
    fw: 'FW',
    monitor: 'Monitor',
    details: 'Details',
    settings: 'Settings',
    history: 'History',
    empty: 'No devices',
    createOrder: 'Create order',
    offlineHint: 'Device is offline. Cannot create order.',
    deviceCode: 'Device code',
    voltage: 'Voltage',
    temp: 'Temp',
  },
};

const STATUS_COLOR = {
  online: '#22C55E',
  available: '#22C55E',
  offline: '#EF4444',
  charging: '#3B82F6',
  busy: '#3B82F6',
  fault: '#F59E0B',
  idle: '#64748B',
};

const saneTemp = (t) => {
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  if (n < -40 || n > 125) return null;
  return Math.round(n);
};

export default function DeviceList({ navigateToScreen }) {
  const mounted = useRef(true);
  const { width: winW } = useWindowDimensions();
  const isWide = Platform.OS === 'web' && winW >= 1024;  // ≥1024px: 2 cột
  const [lang, setLang] = useState('vi');
  const t = useCallback((k) => STRINGS[lang]?.[k] || k, [lang]);

  const [raw, setRaw] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Front-end pagination (chỉ áp dụng cho mobile/nhỏ)
  const [page, setPage] = useState(1);
  const limit = isWide ? 99999 : 10; // web rộng: show hết (đã có 2 cột + scroll)

  useEffect(() => () => { mounted.current = false; }, []);
  useEffect(() => { (async()=>{ try{ const s=await AsyncStorage.getItem(LANG_KEY); if(s) setLang(s);}catch{} })(); }, []);

  const loadCache = useCallback(async () => {
    try {
      const s = await AsyncStorage.getItem(K_DEVICES);
      if (!mounted.current) return;
      if (s) {
        const arr = JSON.parse(s);
        if (Array.isArray(arr)) setRaw(arr);
      }
    } catch {}
  }, []);

const fetchList = useCallback(async (toastOnErr = false) => {
  try {
    const token = await AsyncStorage.getItem('access_token');
    if (!token) return;

    const data = await getDevices(token);
    const list = Array.isArray(data?.data)
      ? data.data
      : (Array.isArray(data) ? data : []);

     
    list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    if (!mounted.current) return;
    setRaw(list);
    await AsyncStorage.setItem(K_DEVICES, JSON.stringify(list));
  } catch (e) {
    if (toastOnErr) showMessage(e?.message || 'Không tải được danh sách');
  }
}, []);


  useEffect(() => {
    (async()=>{
      setLoading(true);
      await loadCache();
      await fetchList(false);
      if (mounted.current) setLoading(false);
    })();
  }, [loadCache, fetchList]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchList(true);
    setRefreshing(false);
  }, [fetchList]);

  const items = useMemo(() => {
    const locale = lang === 'en' ? 'en-US' : 'vi-VN';
    return (raw || []).map((d) => {
      const ports = Array.isArray(d?.ports) ? d.ports : [];
      const lastHb = d?.lastHeartbeat ? new Date(d.lastHeartbeat) : null;
      const _id = d?._id || d?.id || d?.device_id || d?.device_code;

      return {
        _id,
        id: _id,
        code: d?.device_code || '—',
        name: d?.name || '—',
        location: d?.location || '',
        status: (d?.status || '').toLowerCase(),
        fw: d?.fw_version || '—',
        ports: ports.map(p => ({ n: p.portNumber, status: (p.status||'').toLowerCase() })),
        portsCount: ports.length,
        lastHbStr: (lastHb && !isNaN(lastHb)) ? lastHb.toLocaleString(locale) : '—',
        voltage: d?.voltage,
        temp: saneTemp(d?.temperature),
        createdAt: d?.createdAt ? new Date(d.createdAt) : null,
        raw: d,
      };
    }).sort((a, b) => {
      const ta = a.createdAt ? a.createdAt.getTime() : 0;
  const tb = b.createdAt ? b.createdAt.getTime() : 0;
  return ta - tb; // cũ → mới (1 → 8)
    });
  }, [raw, lang]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      const hitQ = !q || [it.code, it.name, it.location, it.status, it.fw, it.lastHbStr].join(' ').toLowerCase().includes(q);
      const hitF = filter === 'all'
        ? true
        : (it.status === filter || it.ports.some(p => p.status === filter));
      return hitQ && hitF;
    });
  }, [items, query, filter]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / limit)), [filtered.length, limit]);
  const pagedData = useMemo(() => {
    const start = (page - 1) * limit;
    return filtered.slice(start, start + limit);
  }, [filtered, page, limit]);

  const goExtend   = (d) => navigateToScreen('extend', { device: d });
  const goSettings = async (d) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      const hist = await getExtendHistory({ accessToken: token, deviceId: d?._id || d?.id });
      navigateToScreen('historyExtend', { device: d, prefetched: hist });
    } catch { navigateToScreen('historyExtend', { device: d }); }
  };

  const goHistory = async (d) => {
    try {
      const minimalList = items.map(x => ({
        id: x._id,
        code: String(x.code || x.raw?.device_code || ''),
        name: (x.name || '').trim(),
      }));
      await AsyncStorage.setItem(K_HISTORY_PREF, JSON.stringify({
        preselectedDeviceCode: String(d?.device_code || d?.code || '').trim() || 'all',
        devices: minimalList,
      }));
    } catch {}
    navigateToScreen('historyExtend', {});
  };

  const FilterChip = ({ val, label, icon }) => {
    const active = filter === val;
    return (
      <TouchableOpacity
        onPress={() => { setFilter(val); setPage(1); }}
        style={[styles.chip, active && styles.chipActive]}
        activeOpacity={0.9}
      >
        {!!icon && (
          <Icon
  name={icon}
  size={16}
  color={active ? '#fff' : '#3478F6'}
  style={{ marginRight: 6, marginTop: Platform.OS === 'web' ? 1 : 0 }}
/>

        )}
        <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const StatusDot = ({ s }) => (
    <View style={[styles.dot, { backgroundColor: STATUS_COLOR[s] || '#94A3B8' }]} />
  );

  const PortBadge = ({ n, status }) => (
    <View style={[styles.portBadge, { borderColor: STATUS_COLOR[status] || '#CBD5E1' }]}>
      <StatusDot s={status} />
      <Text style={styles.portText}>P{n} · {status || '—'}</Text>
    </View>
  );

  const isDeviceOffline = (it) => {
    const s = (it?.status || '').toLowerCase();
    return s === 'offline' || s === 'unavailable';
  };

  const handleCreateOrderPress = (it) => {
    if (isDeviceOffline(it)) {
      showMessage(t('offlineHint'));
      return;
    }
    goExtend(it.raw);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('header')}</Text>
      </View>

      {/* Sticky tool row */}
      <View style={[styles.toolsSticky, Platform.OS === 'web' && styles.toolsStickyWeb]}>
        {/* Search */}
        <View style={styles.searchBox}>
          <Icon name="search" size={20} color="#9DB7E8" />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={(text) => { setQuery(text); setPage(1); }}
            placeholder={t('searchPH')}
            placeholderTextColor="#9DB7E8"
            returnKeyType="search"
          />
          {!!query && (
            <TouchableOpacity onPress={() => { setQuery(''); setPage(1); }}>
              <Icon name="close" size={18} color="#9DB7E8" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filters */}
        <View style={styles.filterWrap}>
          <FilterChip val="all"      label={STRINGS[lang].filters.all} />
          <FilterChip val="online"   label={STRINGS[lang].filters.online} />
          <FilterChip val="offline"  label={STRINGS[lang].filters.offline} />
        </View>
      </View>

      {/* List */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Platform.OS === 'web' ? 110 : 22 }, // chừa chỗ cho nav fixed
          isWide && styles.listContentWide,
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator
      >
        {loading && Array.from({ length: isWide ? 10 : 8 }).map((_, i) => (
          <View key={`sk-${i}`} style={[styles.card, isWide && styles.cardWide]}>
            <PortCardSkeleton />
          </View>
        ))}

        {!loading && pagedData.map((it) => {
          const offline = isDeviceOffline(it);
          return (
            <View key={it.id} style={[styles.card, isWide && styles.cardWide]}>
              <View style={styles.cardHead}>
                {/* LEFT */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection:'row', alignItems:'center' }}>
                    <StatusDot s={it.status} />
                    <Text style={[styles.name, { marginLeft: 6 }]} numberOfLines={1}>{it.name}</Text>
                  </View>
                  <Text style={[styles.meta, { flexWrap:'wrap' }]}>
                    {t('deviceCode')}: <Text style={styles.bold}>{it.code}</Text>
                  </Text>
                  {!!it.location && (
                    <Text style={[styles.meta, { color:'#475569' }]} numberOfLines={1}>
                      {it.location}
                    </Text>
                  )}
                </View>

                {/* RIGHT */}
                <View style={styles.rightInfo}>
                  <Text style={styles.metaRight}>{t('ports')}: <Text style={styles.bold}>{it.portsCount}</Text></Text>
                  <Text style={styles.metaRight}>{t('fw')}: <Text style={styles.bold}>{it.fw}</Text></Text>
                  <Text style={styles.metaRight}>{t('voltage')}: <Text style={styles.bold}>{it.voltage != null ? `${it.voltage}` : '—'}</Text></Text>
                  <Text style={styles.metaRight}>{t('temp')}: <Text style={styles.bold}>{it.raw?.temperature} °C</Text></Text>
                </View>
              </View>

              {!!it.ports?.length && (
                <View style={styles.portRow}>
                  {it.ports.map(p => (
                    <PortBadge key={`${it.id}-${p.n}`} n={p.n} status={p.status} />
                  ))}
                </View>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, offline && styles.actionBtnDisabled]}
                  disabled={offline}
                  onPress={() => handleCreateOrderPress(it)}
                >
                  <Icon name="bolt" size={18} color={offline ? '#9CA3AF' : '#4A90E2'} />
                  <Text style={[styles.actionText, offline && styles.actionTextDisabled]}>{t('createOrder')}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => navigateToScreen('phoneUser')}>
                  <Icon name="tune" size={18} color="#4A90E2" />
                  <Text style={styles.actionText}>{t('settings')}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.actionBtn} onPress={() => goHistory(it.raw)}>
                  <Icon name="history" size={18} color="#4A90E2" />
                  <Text style={styles.actionText}>{t('history')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}

        {!loading && filtered.length === 0 && (
          <Text style={{ textAlign:'center', color:'#64748B', marginTop: 28 }}>{t('empty')}</Text>
        )}

        {!isWide && !loading && filtered.length > limit && (
          <View style={styles.pagination}>
            <TouchableOpacity disabled={page <= 1} onPress={() => setPage(p => Math.max(1, p - 1))}>
              <Text style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}>Trước</Text>
            </TouchableOpacity>
            <Text style={styles.pageInfo}>{page} / {totalPages}</Text>
            <TouchableOpacity disabled={page >= totalPages} onPress={() => setPage(p => Math.min(totalPages, p + 1))}>
              <Text style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}>Sau</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, backgroundColor:'#F6F7FB' },

  header: {
    backgroundColor:'#4A90E2',
    paddingHorizontal:20, paddingTop: 12, paddingBottom:12,
  },
  headerTitle: { color:'#fff', fontSize:20, fontWeight:'800' },

  /* sticky tool row cho web */
  toolsSticky: { paddingHorizontal:14, paddingTop:10, paddingBottom:8, gap:8, backgroundColor:'#F6F7FB' },
  toolsStickyWeb: {
    position: 'sticky',
    top: 0,
    zIndex: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#E6EEF9',
  },

  searchBox: {
    flexDirection:'row', alignItems:'center',
    backgroundColor:'#E9F2FF', borderRadius:12, paddingHorizontal:12, height:44,
    borderWidth:1, borderColor:'#CDE1FF',
  },
  searchInput: { flex:1, fontSize:15, color:'#0F172A' },

  filterWrap: {
    flexDirection:'row', flexWrap:'wrap', columnGap:8, rowGap:8,
  },
 chip: {
  height: 36,
  paddingHorizontal: 12,
  borderRadius: 10,
  borderWidth: 1,
  borderColor: '#CFE0FF',
  backgroundColor: '#F3F7FF',
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center',        // ✅ canh icon + text giữa đều
  gap: 6,                          // ✅ khoảng cách đồng nhất icon–text
},
chipActive: { backgroundColor: '#4A90E2', borderColor: '#4A90E2' },
chipText: {
  color: '#3478F6',
  fontWeight: '700',
  fontSize: 13,
  lineHeight: 16,                  // ✅ để text không bị lệch
  position: 'relative',
  top: Platform.OS === 'web' ? 1 : 0, // ✅ đẩy text nhẹ xuống trên web
},
chipTextActive: { color: '#fff' },


  /* list grid */
  listContent: { paddingHorizontal:14, paddingTop:12, gap:12 },
  listContentWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 12,
    rowGap: 12,
    alignItems: 'stretch',
  },

  card: {
    backgroundColor:'#fff', borderRadius:16, padding:14, borderWidth:1, borderColor:'#E6EEF9',
    boxShadow: '0 4px 12px rgba(0,0,0,0.04)',
  },
  cardWide: {
    width: 'calc(50% - 6px)', // RN Web hiểu calc trong inline style
  },

  cardHead: { flexDirection:'row', gap:12 },
  rightInfo: { minWidth: 160, alignItems:'flex-end' },

  name: { fontSize:16, fontWeight:'800', color:'#0F172A', minWidth: 0, flexShrink: 1 },
  meta: { fontSize:12, color:'#6B7280', marginTop:2 },
  metaRight: { fontSize:12, color:'#6B7280' },
  bold: { color:'#0F172A', fontWeight:'800' },
  dot: { width:10, height:10, borderRadius:5 },

  portRow: { flexDirection:'row', flexWrap:'wrap', gap:8, marginTop:10 },
  portBadge: {
    borderWidth:1, borderRadius:999, paddingVertical:6, paddingHorizontal:10,
    flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'#fff',
  },
  portText: { fontSize:12, color:'#0F172A', fontWeight:'700' },

  actionRow: { flexDirection:'row', gap:10, marginTop:12 },
  actionBtn: {
    flex:1, height:40, borderRadius:12, borderWidth:1.2, borderColor:'#CDE1FF',
    backgroundColor:'#F7FAFF', alignItems:'center', justifyContent:'center', flexDirection:'row', gap:8,
  },
  actionText: { color:'#2563EB', fontWeight:'800' },

  actionBtnDisabled: { opacity: 0.45, borderColor: '#E5E7EB', backgroundColor: '#F3F4F6' },
  actionTextDisabled: { color: '#9CA3AF' },

  pagination: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    marginTop: 12, gap: 14
  },
  pageBtn: { padding: 8, fontWeight: '800', color: '#2563EB' },
  pageBtnDisabled: { color: '#94A3B8' },
  pageInfo: { fontWeight: '700', color: '#0F172A' }
});
