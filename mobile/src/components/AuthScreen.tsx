import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, space, useColors } from '@/lib/theme';

/** Dark brand block on top, form below. Shared by login and register. */
export function AuthScreen({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  const c = useColors();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.hero, { paddingTop: insets.top + space.xl }]}>
          <View style={styles.brand}>
            <View style={styles.logo}>
              {[22, 14, 9].map((w) => (
                <View key={w} style={{ width: w, height: 3, borderRadius: 2, backgroundColor: '#F4F1EA' }} />
              ))}
              <View style={styles.logoDot} />
            </View>
            <Text style={styles.brandText}>Taskline</Text>
          </View>
          <Text style={styles.tagline}>
            Plan it, split it, <Text style={{ color: '#E7774A' }}>ship it.</Text>
          </Text>
        </View>

        <View style={[styles.body, { paddingBottom: insets.bottom + space.xl }]}>
          <View style={{ gap: 6 }}>
            <Text style={[styles.title, { color: c.ink }]}>{title}</Text>
            <Text style={{ color: c.ink2, fontSize: 15 }}>{subtitle}</Text>
          </View>
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: '#1E1C18', paddingHorizontal: space.xl, paddingBottom: space.xxl, gap: space.xl },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logo: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4A463E',
    padding: 7,
    gap: 3.5,
    justifyContent: 'center',
  },
  logoDot: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#C8552B',
  },
  brandText: { color: '#F4F1EA', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  tagline: { color: '#F4F1EA', fontSize: 32, fontWeight: '800', letterSpacing: -1, lineHeight: 36 },
  body: { flex: 1, padding: space.xl, gap: space.xl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
});
