import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Spinner } from './Spinner';
import styles from './ui.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'normal' | 'small';
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
  /** Square button with only an icon; pass `aria-label`. */
  iconOnly?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'normal',
  loading = false,
  icon,
  block,
  iconOnly,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    styles.button,
    styles[variant],
    size === 'small' && styles.small,
    iconOnly && styles.iconOnly,
    block && styles.block,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Spinner size={14} /> : icon}
      {children}
    </button>
  );
}
