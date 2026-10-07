import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Feather from '@expo/vector-icons/Feather';
import { formatDate, todayLocal } from '@taskline/shared';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { radius, useColors } from '@/lib/theme';

import { FieldError, FieldLabel } from './ui';

interface DateFieldProps {
  label: string;
  /** YYYY-MM-DD or '' for "no date" */
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

function toDate(value: string) {
  if (!value) return new Date();
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

/** Native date picker on Android/iOS, plain YYYY-MM-DD input in the web preview. */
export function DateField({ label, value, onChange, error }: DateFieldProps) {
  const c = useColors();
  const border = { borderColor: error ? c.brick : c.lineStrong, backgroundColor: c.surface };

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrap}>
        <FieldLabel>{label}</FieldLabel>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={c.ink3}
          style={[styles.box, border, { color: c.ink }]}
        />
        <FieldError message={error} />
      </View>
    );
  }

  const openAndroid = () =>
    DateTimePickerAndroid.open({
      value: toDate(value),
      mode: 'date',
      onChange: (event, date) => {
        if (event.type === 'set' && date) onChange(todayLocal(date));
      },
    });

  return (
    <View style={styles.wrap}>
      <FieldLabel>{label}</FieldLabel>
      <View style={styles.row}>
        {Platform.OS === 'android' ? (
          <Pressable
            onPress={openAndroid}
            accessibilityRole="button"
            accessibilityLabel={`${label}: ${value ? formatDate(value) : 'not set'}. Tap to choose.`}
            style={[styles.box, border, styles.pressable]}
          >
            <Feather name="calendar" size={16} color={c.ink2} />
            <Text style={{ color: value ? c.ink : c.ink3, fontSize: 16 }}>
              {value ? formatDate(value) : 'No due date'}
            </Text>
          </Pressable>
        ) : (
          <DateTimePicker
            value={toDate(value)}
            mode="date"
            onChange={(_e, date) => date && onChange(todayLocal(date))}
          />
        )}
        {value ? (
          <Pressable
            onPress={() => onChange('')}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Clear date"
          >
            <Text style={{ color: c.accent, fontWeight: '600' }}>Clear</Text>
          </Pressable>
        ) : null}
      </View>
      <FieldError message={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  box: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 14,
    justifyContent: 'center',
    fontSize: 16,
  },
  pressable: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
});
