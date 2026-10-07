import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginData, type LoginInput } from '@taskline/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Banner } from '@/components/ui/States';
import { applyServerErrors } from '@/lib/forms';

import { AuthLayout } from './AuthLayout';
import styles from './auth.module.css';

export function LoginPage() {
  const { login, signedOutReason, bootError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput, unknown, LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      await login(data);
      navigate(from, { replace: true });
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['email', 'password']));
    }
  });

  return (
    <AuthLayout>
      <div className={styles.card}>
        <header>
          <h1>Welcome back</h1>
          <p>Sign in to pick up where you left off.</p>
        </header>

        {signedOutReason === 'expired' && <Banner>Your session expired. Please sign in again.</Banner>}
        {bootError && <Banner tone="error">{bootError}</Banner>}
        {formError && <Banner tone="error">{formError}</Banner>}

        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            autoFocus
            error={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" variant="primary" block loading={isSubmitting}>
            Sign in
          </Button>
        </form>

        <p className={styles.switch}>
          New here? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
