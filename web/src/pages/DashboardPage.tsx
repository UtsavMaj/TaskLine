import {
  formatDate,
  isOverdue,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type DashboardStats,
} from '@taskline/shared';
import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router';

import { useAuth } from '@/auth/AuthProvider';
import { OverdueBadge, PriorityTag } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useDashboard } from '@/hooks/queries';

import styles from './dashboard.module.css';

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

const todayLabel = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }).format(
  new Date(),
);

export function DashboardPage() {
  const { user } = useAuth();
  const dashboard = useDashboard();
  const firstName = user?.fullName.split(' ')[0] ?? '';

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">{todayLabel}</span>
          <h1 style={{ marginTop: 6 }}>
            {greeting()}, {firstName}
          </h1>
        </div>
        <Link to="/projects" className={styles.headerLink}>
          Go to projects <ArrowUpRight size={16} />
        </Link>
      </header>

      {dashboard.isPending ? (
        <StatsSkeleton />
      ) : dashboard.isError ? (
        <div className="panel">
          <ErrorState error={dashboard.error} onRetry={() => dashboard.refetch()} />
        </div>
      ) : (
        <DashboardBody stats={dashboard.data} />
      )}
    </div>
  );
}

function DashboardBody({ stats }: { stats: DashboardStats }) {
  const tiles = [
    { label: 'Total projects', value: stats.totalProjects },
    { label: 'Projects in progress', value: stats.projectsInProgress },
    { label: 'Total tasks', value: stats.totalTasks },
    { label: 'Completed tasks', value: stats.completedTasks, tone: 'olive' },
    { label: 'Pending tasks', value: stats.pendingTasks, tone: 'accent' },
  ];

  return (
    <>
      <section className={styles.tiles} aria-label="Summary">
        {tiles.map((tile) => (
          <div key={tile.label} className={styles.tile} data-tone={tile.tone}>
            <span className="eyebrow">{tile.label}</span>
            <strong>{tile.value}</strong>
          </div>
        ))}
      </section>

      <div className={styles.columns}>
        <section className="panel" aria-labelledby="due-next">
          <div className="panel-head">
            <h2 id="due-next">Due next</h2>
            <Link to="/tasks" className={styles.smallLink}>
              All tasks
            </Link>
          </div>
          {stats.upcomingTasks.length === 0 ? (
            <EmptyState title="Nothing scheduled">Open tasks with a due date will line up here.</EmptyState>
          ) : (
            <ol className={styles.upcoming}>
              {stats.upcomingTasks.map((task) => (
                <li key={task.id}>
                  <div className={styles.dateChip} data-overdue={isOverdue(task)}>
                    {formatDate(task.dueDate).split(' ').slice(0, 2).join(' ')}
                  </div>
                  <div className={styles.upcomingBody}>
                    <strong>{task.name}</strong>
                    <Link to={`/projects/${task.projectId}`}>{task.project.name}</Link>
                  </div>
                  <div className={styles.upcomingMeta}>
                    {isOverdue(task) && <OverdueBadge />}
                    <PriorityTag priority={task.priority} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="panel" aria-labelledby="breakdown">
          <div className="panel-head">
            <h2 id="breakdown">Breakdown</h2>
          </div>
          <div className={styles.breakdown}>
            <div className={styles.rate}>
              <strong>{stats.completionRate}%</strong>
              <span className="muted">of all tasks are done</span>
            </div>

            <StackedBar
              label="Tasks by status"
              parts={[
                { key: 'Completed', value: stats.completedTasks, color: 'var(--olive)' },
                { key: 'In progress', value: stats.inProgressTasks, color: 'var(--ochre)' },
                { key: 'Pending', value: stats.pendingTasks, color: 'var(--line-strong)' },
              ]}
            />

            {stats.overdueTasks > 0 && (
              <p className={styles.overdueNote}>
                {stats.overdueTasks} open {stats.overdueTasks === 1 ? 'task is' : 'tasks are'} past the due date.
              </p>
            )}

            <dl className={styles.dl}>
              <div>
                <dt className="eyebrow">Projects</dt>
                {PROJECT_STATUSES.map((status) => (
                  <dd key={status}>
                    <span>{PROJECT_STATUS_LABELS[status]}</span>
                    <span className="mono">{stats.projectsByStatus[status]}</span>
                  </dd>
                ))}
              </div>
              <div>
                <dt className="eyebrow">Task priority</dt>
                {[...TASK_PRIORITIES].reverse().map((priority) => (
                  <dd key={priority}>
                    <span>{TASK_PRIORITY_LABELS[priority]}</span>
                    <span className="mono">{stats.tasksByPriority[priority]}</span>
                  </dd>
                ))}
              </div>
            </dl>
          </div>
        </section>
      </div>
    </>
  );
}

function StackedBar({ label, parts }: { label: string; parts: { key: string; value: number; color: string }[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  return (
    <figure className={styles.stack} aria-label={label}>
      <div className={styles.stackBar}>
        {total === 0 ? (
          <span style={{ flex: 1, background: 'var(--surface-sunk)' }} />
        ) : (
          parts
            .filter((part) => part.value > 0)
            .map((part) => (
              <span
                key={part.key}
                style={{ flex: part.value, background: part.color }}
                title={`${part.key}: ${part.value}`}
              />
            ))
        )}
      </div>
      <figcaption className={styles.legend}>
        {parts.map((part) => (
          <span key={part.key}>
            <i style={{ background: part.color }} />
            {part.key} <b className="mono">{part.value}</b>
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

function StatsSkeleton() {
  return (
    <section className={styles.tiles} aria-label="Loading summary">
      {[0, 1, 2, 3, 4].map((n) => (
        <div key={n} className={styles.tile}>
          <Skeleton width="60%" height={10} />
          <Skeleton width={48} height={30} />
        </div>
      ))}
    </section>
  );
}
