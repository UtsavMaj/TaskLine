import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterData, type RegisterInput } from '@taskline/shared';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';

import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Banner } from '@/components/ui/States';
import { applyServerErrors } from '@/lib/forms';

import { AuthLayout } from './AuthLayout';
import styles from './auth.module.css';

export function RegisterPage() {
  const { register: createAccount } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput, unknown, RegisterData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullName: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      await createAccount(data);
      navigate('/', { replace: true });
    } catch (error) {
      setFormError(applyServerErrors(error, setError, ['fullName', 'email', 'password']));
    }
  });

  return (
    <AuthLayout>
      <div className={styles.card}>
        <header>
          <h1>Create your account</h1>
          <p>One account works here and in the Android app.</p>
        </header>

        {formError && <Banner tone="error">{formError}</Banner>}

        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <TextField
            label="Full name"
            autoComplete="name"
            autoFocus
            error={errors.fullName?.message}
            {...register('fullName')}
          />
          <TextField
            label="Email"
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />
          <TextField
            label="Password"
            type="password"
            autoComplete="new-password"
            hint="At least 8 characters, with a letter and a number."
            error={errors.password?.message}
            {...register('password')}
          />
          <Button type="submit" variant="primary" block loading={isSubmitting}>
            Create account
          </Button>
        </form>

        <p className={styles.switch}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
