import styles from './ui.module.css';

export function Spinner({ size = 16, label }: { size?: number; label?: string }) {
  return (
    <span
      className={styles.spinner}
      style={{ width: size, height: size }}
      role={label ? 'status' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className={styles.centered} role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ width = '100%', height = 14 }: { width?: number | string; height?: number }) {
  return <span className={styles.skeleton} style={{ width, height }} aria-hidden />;
}
