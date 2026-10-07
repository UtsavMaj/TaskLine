import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Credentials are kept in expo-secure-store, which is backed by the Android Keystore
 * (and the iOS Keychain). Nothing token-related ever goes to AsyncStorage.
 *
 * The web build (`expo start --web`) is only used for quick UI previews during development;
 * SecureStore doesn't exist there, so values are held in memory and vanish on reload.
 *   - Utsav Majumdar, RA2311056010143
 */

const KEYS = {
  refreshToken: 'taskline.refreshToken',
  user: 'taskline.user',
} as const;

type Key = keyof typeof KEYS;

const memory = new Map<string, string>();
const isNative = Platform.OS !== 'web';

const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const secureStorage = {
  async get(key: Key): Promise<string | null> {
    if (!isNative) return memory.get(KEYS[key]) ?? null;
    try {
      return await SecureStore.getItemAsync(KEYS[key], options);
    } catch {
      // A corrupted entry (e.g. after a backup restore) shouldn't crash the app; treat it as signed out.
      await SecureStore.deleteItemAsync(KEYS[key], options).catch(() => undefined);
      return null;
    }
  },

  async set(key: Key, value: string) {
    if (!isNative) {
      memory.set(KEYS[key], value);
      return;
    }
    await SecureStore.setItemAsync(KEYS[key], value, options);
  },

  async remove(key: Key) {
    if (!isNative) {
      memory.delete(KEYS[key]);
      return;
    }
    await SecureStore.deleteItemAsync(KEYS[key], options);
  },

  async clear() {
    await Promise.all((Object.keys(KEYS) as Key[]).map((key) => this.remove(key)));
  },
};
