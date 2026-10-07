import type { ReactNode } from 'react';

import { Logo } from '@/components/layout/Logo';

import styles from './auth.module.css';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className={styles.wrap}>
      <aside className={styles.aside}>
        <div className={styles.brand}>
          <Logo />
          Taskline
        </div>
        <div className={styles.pitch}>
          <h1>
            Plan it, split it, <em>ship it.</em>
          </h1>
          <p>Projects, tasks and progress in one place, on the web and on your phone with the same account.</p>
        </div>
        <ul className={styles.ledger} aria-hidden>
          <li>
            <span>✓</span> Design login screen
          </li>
          <li>
            <span>✓</span> Wire up the API
          </li>
          <li>
            <span>○</span> Record the demo video
          </li>
        </ul>
      </aside>
      <div className={styles.formSide}>{children}</div>
    </div>
  );
}
