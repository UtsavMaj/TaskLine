import type { AuditLogEntry } from '@taskline/shared';
import { useState } from 'react';

import { Pagination } from '@/components/ui/Pagination';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useAuditLogs } from '@/hooks/queries';

import styles from './activity.module.css';

const timeFormat = new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const kind = (action: string) => action.split('_')[0]!.toLowerCase(); // user | project | task

function groupByDay(entries: AuditLogEntry[]) {
  const groups = new Map<string, AuditLogEntry[]>();
  for (const entry of entries) {
    const day = dayFormat.format(new Date(entry.createdAt));
    groups.set(day, [...(groups.get(day) ?? []), entry]);
  }
  return [...groups.entries()];
}

export function ActivityPage() {
  const [page, setPage] = useState(1);
  const logs = useAuditLogs(page);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Activity</h1>
          <p className="lede">
            An audit trail of your account: sign-ins and every change to projects and tasks, from web and mobile.
          </p>
        </div>
      </header>

      <section className="panel">
        {logs.isPending ? (
          <PageLoader />
        ) : logs.isError ? (
          <ErrorState error={logs.error} onRetry={() => logs.refetch()} />
        ) : logs.data.data.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <div className={styles.timeline} style={{ opacity: logs.isPlaceholderData ? 0.6 : 1 }}>
            {groupByDay(logs.data.data).map(([day, entries]) => (
              <div key={day} className={styles.day}>
                <h3 className="eyebrow">{day}</h3>
                <ol>
                  {entries.map((entry) => (
                    <li key={entry.id} data-kind={kind(entry.action)}>
                      <time className="mono" dateTime={entry.createdAt}>
                        {timeFormat.format(new Date(entry.createdAt))}
                      </time>
                      <span>{entry.summary}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
        {logs.data && <Pagination meta={logs.data.meta} onPage={setPage} noun="events" />}
      </section>
    </div>
  );
}
