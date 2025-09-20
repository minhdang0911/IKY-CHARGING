import AsyncStorage from '@react-native-async-storage/async-storage';

export const TOKEN_KEY = 'auth_tokens';

export async function saveTokens(tokens) {
  // tokens = { access_token, refresh_token, token_type, expires_in, ... }
  await AsyncStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export async function loadTokens() {
  const raw = await AsyncStorage.getItem(TOKEN_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearTokens() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}
