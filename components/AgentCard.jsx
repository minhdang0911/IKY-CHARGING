import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function AgentCard({ t, agentInfo }) {
  const Row = ({ k, v }) => (
    <View style={styles.agentRow}>
      <Text style={styles.agentK}>{k}</Text>
      <Text style={styles.agentV}>{v || '—'}</Text>
    </View>
  );

  return (
    <View style={styles.agentCard}>
      <View style={styles.agentHeader}>
        <Icon name="store" size={18} color="#1e88e5" />
        <Text style={styles.agentTitle}>{t('agentBoxTitle')}</Text>
      </View>

      {agentInfo ? (
        <>
          <Row k={t('agentName')}    v={agentInfo.name} />
          <Row k={t('agentPhone')}   v={agentInfo.phone} />
          <Row k={t('agentEmail')}   v={agentInfo.email} />
          <Row k={t('agentAddress')} v={agentInfo.address} />
          <Row k={t('agentProvince')} v={agentInfo.province} />
          {/* <Row k={t('agentCommission')} v={`${Math.round((agentInfo.commission_rate||0)*100)}%`} /> */}
        </>
      ) : (
        <Text style={[styles.agentV, { color: '#6b7280', paddingVertical: 4 }]}>
          {t('agentEmpty')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  agentCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  agentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  agentTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eee',
  },
  agentK: { flex: 1, fontSize: 13, color: '#6b7280' },
  agentV: { fontSize: 13, fontWeight: '700', color: '#111827' },
});
