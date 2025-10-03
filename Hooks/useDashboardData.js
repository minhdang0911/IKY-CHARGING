import { useEffect, useMemo, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDashboardOverview, getRevenueMonthly } from '../apis/devices';
import { getToken } from '../utils/token';
import { toLabel } from '../utils/format';

const K_DASH_OVERVIEW  = 'ev_cache_dashboard_overview_v1';
const K_DASH_REVENUE   = 'ev_cache_dashboard_revenue_v1';
const K_HISTORY_PREF   = 'EV_HISTORY_PREF';

export default function useDashboardData() {
  const [overview, setOverview] = useState(null);
  const [revenueData, setRevenueData] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  // hydrate cache + background refresh
  useEffect(() => {
    (async () => {
      try {
        const [ovS, revS] = await AsyncStorage.multiGet([K_DASH_OVERVIEW, K_DASH_REVENUE]);
        const cachedOverview = ovS?.[1] ? JSON.parse(ovS[1]) : null;
        const cachedRevenue  = revS?.[1] ? JSON.parse(revS[1]) : null;
        if (cachedOverview) setOverview(cachedOverview);
        if (Array.isArray(cachedRevenue)) setRevenueData(cachedRevenue);
      } catch {}

      try {
        const token = await getToken();
        const [overviewRes, revenueRes] = await Promise.all([
          getDashboardOverview(token),
          getRevenueMonthly(token),
        ]);
        const ov = overviewRes || null;
        const arr = (Array.isArray(revenueRes) ? revenueRes : [])
          .map(r => ({ month: toLabel(r.month), revenue: Number(r.revenue || 0) }));
        setOverview(ov);
        setRevenueData(arr);
        await AsyncStorage.multiSet([
          [K_DASH_OVERVIEW, JSON.stringify(ov || null)],
          [K_DASH_REVENUE, JSON.stringify(arr)],
        ]);
      } catch (e) {
        console.warn('Dashboard refresh error:', e?.message || e);
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const token = await getToken();
      const [overviewRes, revenueRes] = await Promise.all([
        getDashboardOverview(token),
        getRevenueMonthly(token),
      ]);
      const ov = overviewRes || null;
      const arr = (Array.isArray(revenueRes) ? revenueRes : [])
        .map(r => ({ month: toLabel(r.month), revenue: Number(r.revenue || 0) }));
      setOverview(ov);
      setRevenueData(arr);
      await AsyncStorage.multiSet([
        [K_DASH_OVERVIEW, JSON.stringify(ov || null)],
        [K_DASH_REVENUE, JSON.stringify(arr)],
      ]);
    } catch (e) {
      console.warn('Refresh error:', e?.message || e);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const months = useMemo(() => revenueData.map(x => x.month), [revenueData]);

  const goHistoryWithMonth = useCallback(async (navigateToScreen, monthLabel) => {
    try {
      await AsyncStorage.setItem(K_HISTORY_PREF, JSON.stringify({ month: monthLabel, preselectedDeviceId: 'all' }));
    } catch {}
    navigateToScreen && navigateToScreen('historyExtend');
  }, []);

  return { overview, revenueData, months, refreshing, refresh, goHistoryWithMonth };
}
