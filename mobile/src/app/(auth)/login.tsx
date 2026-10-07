import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginData, type LoginInput } from '@taskline/shared';
import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Text, TextInput, View } from 'react-native';

import { AuthScreen } from '@/components/AuthScreen';
import { useIsOffline } from '@/components/status-views';
import { Banner, Button, Field } from '@/components/ui';
import { ApiError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { space, useColors } from '@/lib/theme';

export default function LoginScreen() {
  const c = useColors();
  const { login, notice, clearNotice } = useAuth();
  const offline = useIsOffline();
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput, unknown, LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const submit = handleSubmit(async (data) => {
    setFormError(null);
    clearNotice();
    try {
      await login(data); // the root layout switches to the app once status changes
    } catch (error) {
      if (error instanceof ApiError) {
        for (const d of error.details) {
          if (d.field === 'email' || d.field === 'password') setError(d.field, { message: d.message });
        }
      }
      setFormError(errorMessage(error));
    }
  });

  return (
    <AuthScreen title="Welcome back" subtitle="Sign in with the same account you use on the web.">
      <View style={{ gap: space.md }}>
        {notice === 'expired' ? <Banner>Your session has expired. Please sign in again.</Banner> : null}
        {offline ? <Banner tone="error">You’re offline. Connect to the internet to sign in.</Banner> : null}
        {formError ? <Banner tone="error">{formError}</Banner> : null}
      </View>

      <View style={{ gap: space.lg }}>
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Field
              label="Email"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field }) => (
            <Field
              ref={passwordRef}
              label="Password"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.password?.message}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          )}
        />
        <Button title="Sign in" loading={isSubmitting} onPress={submit} />
      </View>

      <Text style={{ color: c.ink2, textAlign: 'center' }}>
        New here?{' '}
        <Link href="/register" replace style={{ color: c.accent, fontWeight: '700' }}>
          Create an account
        </Link>
      </Text>
    </AuthScreen>
  );
}
