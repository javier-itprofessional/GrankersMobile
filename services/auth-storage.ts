import * as SecureStore from 'expo-secure-store';

export const AuthStorage = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync('access_token');
  },
  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync('refresh_token');
  },
  async setTokens(access: string, refresh: string): Promise<void> {
    await SecureStore.setItemAsync('access_token', access);
    await SecureStore.setItemAsync('refresh_token', refresh);
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
  },
};
