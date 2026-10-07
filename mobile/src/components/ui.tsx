import Feather from '@expo/vector-icons/Feather';
import {
  PROJECT_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type ProjectStatus,
  type TaskPriority,
  type TaskStatus,
} from '@taskline/shared';
import { forwardRef, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { radius, space, type, useColors, type Colors } from '@/lib/theme';

// ---------- Button ----------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  title: string;
  variant?: ButtonVariant;
  loading?: boolean;
  icon?: ComponentProps<typeof Feather>['name'];
  style?: ViewStyle;
}

export function Button({ title, variant = 'primary', loading, icon, disabled, style, ...rest }: ButtonProps) {
  const c = useColors();
  const palette: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
    primary: { bg: c.accent, fg: c.onAccent, border: c.accent },
    secondary: { bg: c.surface, fg: c.ink, border: c.lineStrong },
    ghost: { bg: 'transparent', fg: c.ink2, border: 'transparent' },
    danger: { bg: c.brickSoft, fg: c.brick, border: c.brickSoft },
  };
  const p = palette[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: p.bg, borderColor: p.border, opacity: inactive ? 0.6 : pressed ? 0.85 : 1 },
        style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} size="small" />
      ) : icon ? (
        <Feather name={icon} size={17} color={p.fg} />
      ) : null}
      <Text style={[styles.buttonText, { color: p.fg }]}>{title}</Text>
    </Pressable>
  );
}

// ---------- Text field ----------

interface FieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, error, hint, style, ...rest }, ref) {
  const c = useColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.ink2 }]}>{label}</Text>
      <TextInput
        ref={ref}
        placeholderTextColor={c.ink3}
        accessibilityLabel={label}
        style={[
          styles.input,
          { backgroundColor: c.surface, borderColor: error ? c.brick : c.lineStrong, color: c.ink },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text style={[styles.help, { color: c.brick }]} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint ? (
        <Text style={[styles.help, { color: c.ink3 }]}>{hint}</Text>
      ) : null}
    </View>
  );
});

export function FieldLabel({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[styles.label, { color: c.ink2 }]}>{children}</Text>;
}

export function FieldError({ message }: { message?: string }) {
  const c = useColors();
  if (!message) return null;
  return <Text style={[styles.help, { color: c.brick }]}>{message}</Text>;
}

// ---------- Search ----------

export function SearchBar(props: TextInputProps) {
  const c = useColors();
  return (
    <View style={[styles.search, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Feather name="search" size={16} color={c.ink3} />
      <TextInput
        placeholderTextColor={c.ink3}
        style={[styles.searchInput, { color: c.ink }]}
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="while-editing"
        {...props}
      />
    </View>
  );
}

// ---------- Chips (filters / pickers) ----------

interface ChipOption<T extends string> {
  value: T;
  label: string;
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
  scroll = true,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  scroll?: boolean;
}) {
  const c = useColors();
  const chips = options.map((option) => {
    const selected = option.value === value;
    return (
      <Pressable
        key={option.value}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${label}: ${option.label}`}
        onPress={() => onChange(option.value)}
        style={[
          styles.chip,
          selected
            ? { backgroundColor: c.ink, borderColor: c.ink }
            : { backgroundColor: c.surface, borderColor: c.line },
        ]}
      >
        <Text style={[styles.chipText, { color: selected ? c.bg : c.ink2 }]}>{option.label}</Text>
      </Pressable>
    );
  });

  if (!scroll) return <View style={styles.chipWrap}>{chips}</View>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
      {chips}
    </ScrollView>
  );
}

// ---------- Badges ----------

function tone(c: Colors, status: ProjectStatus | TaskStatus) {
  if (status === 'COMPLETED') return { bg: c.oliveSoft, fg: c.olive };
  if (status === 'IN_PROGRESS') return { bg: c.ochreSoft, fg: c.ochre };
  return { bg: c.stoneSoft, fg: c.stone };
}

export function StatusBadge({ status }: { status: ProjectStatus | TaskStatus }) {
  const c = useColors();
  const t = tone(c, status);
  const label =
    status in TASK_STATUS_LABELS
      ? TASK_STATUS_LABELS[status as TaskStatus]
      : PROJECT_STATUS_LABELS[status as ProjectStatus];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <View style={[styles.dot, { backgroundColor: t.fg }]} />
      <Text style={[styles.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function OverdueBadge() {
  const c = useColors();
  return (
    <View style={[styles.badge, { backgroundColor: c.brickSoft }]}>
      <Text style={[styles.badgeText, { color: c.brick }]}>Overdue</Text>
    </View>
  );
}

export function PriorityTag({ priority }: { priority: TaskPriority }) {
  const c = useColors();
  const level = { LOW: 1, MEDIUM: 2, HIGH: 3 }[priority];
  const color = { LOW: c.stone, MEDIUM: c.ochre, HIGH: c.brick }[priority];
  return (
    <View style={styles.priority} accessibilityLabel={`${TASK_PRIORITY_LABELS[priority]} priority`}>
      <View style={styles.bars}>
        {[5, 8, 11].map((height, i) => (
          <View
            key={height}
            style={{ width: 3, height, borderRadius: 1, backgroundColor: i < level ? color : c.lineStrong }}
          />
        ))}
      </View>
      <Text style={[styles.priorityText, { color }]}>{TASK_PRIORITY_LABELS[priority]}</Text>
    </View>
  );
}

export function ProgressBar({ value }: { value: number }) {
  const c = useColors();
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <View
      style={styles.progressRow}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View style={[styles.track, { backgroundColor: c.sunk }]}>
        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: c.olive, borderRadius: 3 }} />
      </View>
      <Text style={[styles.pct, { color: c.ink2 }]}>{pct}%</Text>
    </View>
  );
}

// ---------- Cards, banners, states ----------

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, style]}>{children}</View>;
}

export function Banner({ tone: kind = 'info', children }: { tone?: 'info' | 'error'; children: ReactNode }) {
  const c = useColors();
  const colors = kind === 'error' ? { bg: c.brickSoft, fg: c.brick } : { bg: c.ochreSoft, fg: c.ink };
  return (
    <View style={[styles.banner, { backgroundColor: colors.bg }]} accessibilityRole="alert">
      <Feather name={kind === 'error' ? 'alert-circle' : 'info'} size={16} color={colors.fg} />
      <Text style={[styles.bannerText, { color: colors.fg }]}>{children}</Text>
    </View>
  );
}

export function EmptyState({
  icon = 'inbox',
  title,
  message,
  action,
}: {
  icon?: ComponentProps<typeof Feather>['name'];
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  const c = useColors();
  return (
    <View style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: c.sunk }]}>
        <Feather name={icon} size={22} color={c.ink2} />
      </View>
      <Text style={[type.heading, { color: c.ink, textAlign: 'center' }]}>{title}</Text>
      {message ? <Text style={[styles.stateText, { color: c.ink2 }]}>{message}</Text> : null}
      {action}
    </View>
  );
}

export function LoadingView({ label = 'Loading…' }: { label?: string }) {
  const c = useColors();
  return (
    <View style={styles.state}>
      <ActivityIndicator color={c.accent} />
      <Text style={{ color: c.ink2 }}>{label}</Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const c = useColors();
  return <Text style={[type.label, { color: c.ink3, marginBottom: space.sm }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 18,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  buttonText: { fontSize: 15, fontWeight: '600' },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: radius.sm,
    fontSize: 16,
  },
  help: { fontSize: 12.5 },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  chipRow: { gap: 8, paddingRight: 16 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 34, paddingHorizontal: 14, borderRadius: 17, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontSize: 13.5, fontWeight: '600' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  priority: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 11 },
  priorityText: { fontSize: 12.5, fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  pct: { fontSize: 12, fontVariant: ['tabular-nums'], minWidth: 34, textAlign: 'right' },
  card: { borderWidth: 1, borderRadius: radius.md, padding: space.lg },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.sm,
  },
  bannerText: { flex: 1, fontSize: 13.5, fontWeight: '500' },
  state: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
  stateIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  stateText: { textAlign: 'center', fontSize: 14, lineHeight: 20, maxWidth: 300 },
});
