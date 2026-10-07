import { CircleAlert, Inbox, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';

import { ApiError, errorMessage } from '@/api/client';

import { Button } from './Button';
import styles from './ui.module.css';

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={styles.state}>
      <span className={styles.stateIcon}>
        <Inbox size={20} />
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = error instanceof ApiError && error.isNetworkError;
  return (
    <div className={styles.state} role="alert">
      <span className={`${styles.stateIcon} ${styles.bad}`}>
        {offline ? <WifiOff size={20} /> : <CircleAlert size={20} />}
      </span>
      <h3>{offline ? 'You appear to be offline' : 'Couldn’t load this'}</h3>
      <p>{errorMessage(error)}</p>
      {onRetry && (
        <Button size="small" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Banner({ tone = 'info', children }: { tone?: 'info' | 'error'; children: ReactNode }) {
  return (
    <div
      className={`${styles.banner} ${tone === 'error' ? styles.bannerError : styles.bannerInfo}`}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}
