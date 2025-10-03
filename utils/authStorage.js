import AsyncStorage from '@react-native-async-storage/async-storage';

export const saveTokens = async ({ accessToken, refreshToken }) => {
  await AsyncStorage.multiSet([
    ['access_token', accessToken || ''],
    ['refresh_token', refreshToken || ''],
  ]);
};

export const saveUserInfo = async (user = {}, username = '') => {
  const pairs = [
    ['username', username || ''],
    ['user_id', user?.id || ''],
    ['user_role', user?.role || ''],
    ['agent_id', user?.agent_id || ''],
  ].filter((x) => x[1] !== '');
  if (pairs.length) await AsyncStorage.multiSet(pairs);
};

export const getRememberFlag = async () => (await AsyncStorage.getItem('remember_login')) !== '0';
export const setRememberFlag  = async (remember) =>
  AsyncStorage.setItem('remember_login', remember ? '1' : '0');
