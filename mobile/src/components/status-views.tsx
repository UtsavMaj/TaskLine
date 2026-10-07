import { useNetInfo } from '@react-native-community/netinfo';
import { View } from 'react-native';

import { ApiError, errorMessage } from '@/lib/api';
import { space } from '@/lib/theme';

import { Banner, Button, EmptyState } from './ui';

/** True only when we *know* there is no connection (null while NetInfo is still checking). */
export function useIsOffline() {
  const net = useNetInfo();
  return net.isConnected === false || net.isInternetReachable === false;
}

/** Thin strip shown at the top of screens while the phone has no connection. */
export function OfflineBanner({ hasData }: { hasData: boolean }) {
  const offline = useIsOffline();
  if (!offline) return null;
  return (
    <View style={{ marginBottom: space.md }}>
      <Banner tone="error">
        {hasData
          ? 'You’re offline. Showing what was last loaded on this phone.'
          : 'You’re offline. Connect to the internet to load your data.'}
      </Banner>
    </View>
  );
}

/** Full-screen error with a retry button. Network failures get their own wording. */
export function ErrorView({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const offline = error instanceof ApiError && error.isNetworkError;
  return (
    <EmptyState
      icon={offline ? 'wifi-off' : 'alert-triangle'}
      title={offline ? 'Can’t connect' : 'Couldn’t load this'}
      message={
        offline
          ? 'Check your Wi-Fi or mobile data, then try again. If you are online, the server may be waking up.'
          : errorMessage(error)
      }
      action={<Button title="Try again" variant="secondary" icon="refresh-cw" onPress={onRetry} />}
    />
  );
}
