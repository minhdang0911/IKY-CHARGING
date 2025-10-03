import AsyncStorage from '@react-native-async-storage/async-storage';
export async function getToken() {
  return (await AsyncStorage.getItem('access_token')) ||
         (await AsyncStorage.getItem('accessToken')) ||
         (await AsyncStorage.getItem('ACCESS_TOKEN')) || null;
}
