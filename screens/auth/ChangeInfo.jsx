import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  BackHandler,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import useLanguage from '../../Hooks/useLanguage';
import useAgentInfo from '../../Hooks/useAgentInfo';
import { STRINGS } from '../../i18n/strings';
import FancyLoading from '../../components/skeleton/FancyLoading';
import AgentCard from '../../components/AgentCard';

const ChangeInfo = ({ navigateToScreen, navigation }) => {
  const { language } = useLanguage('vi');
  const t = k =>
    (STRINGS[language] && STRINGS[language][k]) ??
    STRINGS.vi?.[k] ??
    STRINGS.en?.[k] ??
    k;

  const { agentInfo, loading, loadErr } = useAgentInfo([language]);

  const goInformation = useCallback(() => {
    navigateToScreen && navigateToScreen('Information');
  }, [navigateToScreen]);

  const handleBackPress = useCallback(() => {
    goInformation();
    return true;
  }, [goInformation]);

  useEffect(() => {
    const sub = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );
    return () => sub.remove();
  }, [handleBackPress]);

  useEffect(() => {
    if (!navigation?.addListener) return;
    const unsub = navigation.addListener('beforeRemove', e => {
      e.preventDefault();
      goInformation();
    });
    return unsub;
  }, [navigation, goInformation]);

  const handleNotificationPress = () => {
    navigateToScreen &&
      navigateToScreen('notification', { from: 'changeInfo' });
  };

  if (loading) return <FancyLoading t={t} />;

  if (loadErr) {
    return (
      <View
        style={[styles.container, { justifyContent: 'center', padding: 20 }]}
      >
        <Text style={{ color: '#d32f2f', textAlign: 'center' }}>
          {loadErr === 'notLogged' ? t('notLogged') : String(loadErr)}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
           <Text style={{fontSize: 30, color: '#fff'}}>{'‹'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {t('headerTitle')}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.notificationButton}
          onPress={handleNotificationPress}
        />
      </View>

      {/* Body */}
      <ScrollView
        contentContainerStyle={styles.scrollInner}
        keyboardShouldPersistTaps="handled"
      >
        <AgentCard t={t} agentInfo={agentInfo} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },

  header: {
    backgroundColor: '#1e88e5',
    paddingHorizontal: 20,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 45 : 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  backButton: { padding: 4 },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: '500',
    marginLeft: 8,
  },

  notificationButton: { padding: 4 },

  scrollInner: { padding: 16, paddingBottom: 28 },
});

export default ChangeInfo;
