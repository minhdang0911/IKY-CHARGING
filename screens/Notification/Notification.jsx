// screens/Home/Notification.jsx
import React, { useContext, useMemo, useEffect, useCallback, useState } from 'react';
import {
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  BackHandler,
  RefreshControl,
  View
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { NotificationContext } from '../../App';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';

const VI_DATE = (d) =>
  d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
const VI_TIME = (d) =>
  d.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

const relTime = (date) => {
  const now = Date.now();
  const diff = Math.max(0, now - date.getTime());
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s trước`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}p trước`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}g trước`;
  const d = Math.floor(h / 24);
  return `${d} ngày trước`;
};

const Notification = ({ navigateToScreen, screenData, navigation }) => {
  const fromScreen = screenData?.from || 'Information';
  const device = screenData?.device || null;
  const { notifications, setNotifications } = useContext(NotificationContext);

  const [filter, setFilter] = useState('all'); // 'all' | 'unread'
  const [refreshing, setRefreshing] = useState(false);

  // Chuẩn hoá dữ liệu
  const normalized = useMemo(() => {
    return (notifications || []).map((it, idx) => ({
      ...it,
      _key: it.id ? String(it.id) : `noti_${idx}_${it?.createdAt ?? ''}`,
      createdAt: it?.createdAt instanceof Date ? it.createdAt : new Date(it?.createdAt),
      isRead: !!it?.isRead,
    }));
  }, [notifications]);

  // Lọc theo tab
  const filtered = useMemo(() => {
    return filter === 'unread' ? normalized.filter((n) => !n.isRead) : normalized;
  }, [normalized, filter]);

  // Gom nhóm theo ngày
  const sections = useMemo(() => {
    const byDay = filtered.reduce((acc, it) => {
      const dayKey = VI_DATE(it.createdAt);
      if (!acc[dayKey]) acc[dayKey] = [];
      acc[dayKey].push(it);
      return acc;
    }, {});
    Object.keys(byDay).forEach((k) =>
      byDay[k].sort((a, b) => b.createdAt - a.createdAt),
    );
    return Object.keys(byDay)
      .sort((a, b) => {
        const [da, ma, ya] = a.split('/').map(Number);
        const [db, mb, yb] = b.split('/').map(Number);
        return new Date(yb, mb - 1, db) - new Date(ya, ma - 1, da);
      })
      .map((day) => ({ title: day, data: byDay[day] }));
  }, [filtered]);

  const unreadCount = useMemo(
    () => normalized.filter((n) => !n.isRead).length,
    [normalized],
  );

  /* ===== actions ===== */
  const goBackToSource = useCallback(() => {
    navigateToScreen && navigateToScreen(fromScreen, device ? { device } : {});
  }, [navigateToScreen, fromScreen, device]);

  const onHardwareBack = useCallback(() => {
    goBackToSource();
    return true;
  }, [goBackToSource]);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, [setNotifications]);

  const toggleRead = useCallback(
    (id) => {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: !n.isRead } : n)),
      );
    },
    [setNotifications],
  );

  const removeOne = useCallback(
    (id) => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    },
    [setNotifications],
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // Android hardware back
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', onHardwareBack);
    return () => sub.remove();
  }, [onHardwareBack]);

  // iOS back gesture
  useEffect(() => {
    if (!navigation || typeof navigation.addListener !== 'function') return;
    const unsub = navigation.addListener('beforeRemove', (e) => {
      e.preventDefault();
      goBackToSource();
    });
    return unsub;
  }, [navigation, goBackToSource]);

  /* ===== swipe UI ===== */
  const RightActions = ({ item }) => (
    <TouchableOpacity
      onPress={() => toggleRead(item.id)}
      style={[styles.swipeAction, { backgroundColor: '#4A90E2', alignItems: 'flex-end' }]}
      activeOpacity={0.8}
    >
      <Icon
        name={item.isRead ? 'mark-email-unread' : 'done'}
        size={20}
        color="#fff"
      />
      <Text style={styles.swipeText}>
        {item.isRead ? 'Chưa đọc' : 'Đã đọc'}
      </Text>
    </TouchableOpacity>
  );

  const LeftActions = ({ item }) => (
    <TouchableOpacity
      onPress={() => removeOne(item.id)}
      style={[styles.swipeAction, { backgroundColor: '#d9534f', alignItems: 'flex-start' }]}
      activeOpacity={0.8}
    >
      <Icon name="delete-outline" size={20} color="#fff" />
      <Text style={styles.swipeText}>Xoá</Text>
    </TouchableOpacity>
  );

  const renderItem = ({ item }) => {
    const unread = !item.isRead;
    return (
      <Swipeable
        renderRightActions={() => <RightActions item={item} />}
        renderLeftActions={() => <LeftActions item={item} />}
        overshootRight={false}
        overshootLeft={false}
      >
        <TouchableOpacity
          onPress={() => toggleRead(item.id)}
          activeOpacity={0.85}
          style={[styles.card, unread && styles.cardUnread]}
        >
          <View style={styles.cardHeader}>
            <Text
              style={[styles.cardTitle, unread && styles.cardTitleUnread]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {unread && <View style={styles.dot} />}
          </View>
          {!!item.message && (
            <Text style={styles.cardMsg} numberOfLines={4}>
              {item.message}
            </Text>
          )}
          <Text style={styles.itemDatetime}>
            {relTime(item.createdAt)} · {VI_TIME(item.createdAt)}
          </Text>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  const renderSectionHeader = ({ section: { title } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Header giữ như cũ, thêm nút "Đánh dấu tất cả đã đọc" */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goBackToSource} style={styles.backBtn}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Thông báo</Text>
        <TouchableOpacity onPress={markAllRead} style={styles.headerAction}>
          <Icon name="done-all" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Tabs filter */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, filter === 'all' && styles.tabActive]}
          onPress={() => setFilter('all')}
          activeOpacity={0.9}
        >
          <Text
            style={[styles.tabText, filter === 'all' && styles.tabTextActive]}
          >
            Tất cả
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, filter === 'unread' && styles.tabActive]}
          onPress={() => setFilter('unread')}
          activeOpacity={0.9}
        >
          <Text
            style={[styles.tabText, filter === 'unread' && styles.tabTextActive]}
          >
            Chưa đọc{unreadCount > 0 ? ` (${unreadCount})` : ''}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Icon name="notifications-none" size={48} color="#9aa8b6" />
          <Text style={styles.emptyTitle}>
            {filter === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo'}
          </Text>
          <Text style={styles.emptyDesc}>
            Khi có cập nhật mới, thông báo sẽ xuất hiện tại đây.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item._key}
          renderItem={renderItem}
          renderSectionHeader={renderSectionHeader}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#4A90E2"
            />
          }
        />
      )}
    </GestureHandlerRootView>
  );
};

export default Notification;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },

  /* Header */
  header: {
    backgroundColor: '#4A90E2',
    paddingTop: 15,
    paddingBottom: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { padding: 8 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '600', flex: 1, marginLeft: 4 },
  headerAction: { padding: 8 },

  /* Tabs */
  tabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#eef3f7',
  },
  tabActive: {
    backgroundColor: '#dfeaf6',
    borderWidth: 1,
    borderColor: '#cad9eb',
  },
  tabText: { color: '#425466', fontSize: 13, fontWeight: '500' },
  tabTextActive: { color: '#2b3a55' },

  /* Section */
  sectionHeader: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { color: '#8a99a8', fontSize: 12, fontWeight: '600', letterSpacing: 0.2 },

  /* Card item */
  listContent: { paddingBottom: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e6e8eb',
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  cardUnread: {
    borderColor: '#cfe1ff',
    backgroundColor: '#f9fbff',
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1 },
  cardTitleUnread: { color: '#0a1b3a' },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8, backgroundColor: '#1e88e5' },
  cardMsg: { fontSize: 14, color: '#1f2937', lineHeight: 20, marginTop: 6 },
  itemDatetime: { color: '#8a99a8', fontSize: 12, marginTop: 8 },

  /* Swipe */
  swipeAction: {
    justifyContent: 'center',
    paddingHorizontal: 16,
    width: 100,
  },
  swipeText: { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 4 },

  /* Empty */
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: '700', color: '#2b3a55' },
  emptyDesc: { marginTop: 6, fontSize: 13, color: '#6b7a90', textAlign: 'center' },
});
