import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Where the API lives.
 *  1. EXPO_PUBLIC_API_URL (mobile/.env or EAS env) always wins, e.g. https://taskline-api.onrender.com
 *  2. In development, fall back to the computer running Metro on port 4000, so a phone on
 *     the same Wi-Fi reaches the local backend without any setup.
 *  3. Last resort: the Android emulator's alias for the host machine.
 */
function resolveApiUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  // Browser preview (`expo start --web`): the API runs next to the page.
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `http://${window.location.hostname}:4000`;

  const hostUri = Constants.expoConfig?.hostUri; // "192.168.1.20:8081" when running from Metro
  if (__DEV__ && hostUri) return `http://${hostUri.split(':')[0]}:4000`;

  return 'http://10.0.2.2:4000';
}

export const API_URL = resolveApiUrl();
export const API_BASE = `${API_URL}/api`;

/** Long enough for a free-tier server to wake up, short enough that the app never hangs forever. */
export const REQUEST_TIMEOUT_MS = 30_000;
