import Feather from '@expo/vector-icons/Feather';
import { Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/lib/theme';

/** Floating "add" button, bottom-right, above the tab bar and gesture area. */
export function Fab({ onPress, label }: { onPress: () => void; label: string }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: c.accent, bottom: 20 + Math.max(insets.bottom - 20, 0), opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <Feather name="plus" size={26} color={c.onAccent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.22)',
  },
});
