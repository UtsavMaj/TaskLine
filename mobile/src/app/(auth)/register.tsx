import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterData, type RegisterInput } from '@taskline/shared';
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

const FIELDS = ['fullName', 'email', 'password'] as const;

export default function RegisterScreen() {
  const c = useColors();
  const { register } = useAuth();
  const offline = useIsOffline();
  const [formError, setFormError] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const {
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput, unknown, RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  const submit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      await register(data);
    } catch (error) {
      if (error instanceof ApiError) {
        for (const d of error.details) {
          if ((FIELDS as readonly string[]).includes(d.field))
            setError(d.field as (typeof FIELDS)[number], { message: d.message });
        }
      }
      setFormError(errorMessage(error));
    }
  });

  return (
    <AuthScreen title="Create your account" subtitle="It works on the web app too.">
      {offline ? <Banner tone="error">You’re offline. Connect to the internet to create an account.</Banner> : null}
      {formError ? <Banner tone="error">{formError}</Banner> : null}

      <View style={{ gap: space.lg }}>
        <Controller
          control={control}
          name="fullName"
          render={({ field }) => (
            <Field
              label="Full name"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.fullName?.message}
              autoComplete="name"
              textContentType="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
            />
          )}
        />
        <Controller
          control={control}
          name="email"
          render={({ field }) => (
            <Field
              ref={emailRef}
              label="Email"
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={errors.email?.message}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
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
              hint="At least 8 characters, with a letter and a number."
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          )}
        />
        <Button title="Create account" loading={isSubmitting} onPress={submit} />
      </View>

      <Text style={{ color: c.ink2, textAlign: 'center' }}>
        Already have an account?{' '}
        <Link href="/login" replace style={{ color: c.accent, fontWeight: '700' }}>
          Sign in
        </Link>
      </Text>
    </AuthScreen>
  );
}
