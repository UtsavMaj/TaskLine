import {
  PROJECT_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type ProjectStatus,
  type TaskPriority,
  type TaskStatus,
} from '@taskline/shared';

import styles from './ui.module.css';

const toneByStatus: Record<ProjectStatus | TaskStatus, string> = {
  NOT_STARTED: 'tone-stone',
  PENDING: 'tone-stone',
  IN_PROGRESS: 'tone-ochre',
  COMPLETED: 'tone-olive',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`${styles.badge} ${styles[toneByStatus[status]]}`}>{PROJECT_STATUS_LABELS[status]}</span>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`${styles.badge} ${styles[toneByStatus[status]]}`}>{TASK_STATUS_LABELS[status]}</span>;
}

export function OverdueBadge() {
  return <span className={`${styles.badge} ${styles['tone-brick']}`}>Overdue</span>;
}

const priorityLevel: Record<TaskPriority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const priorityColor: Record<TaskPriority, string> = {
  LOW: 'var(--stone)',
  MEDIUM: 'var(--ochre)',
  HIGH: 'var(--brick)',
};

/** Signal-strength style bars: quicker to scan in a list than another coloured pill. */
export function PriorityTag({ priority }: { priority: TaskPriority }) {
  const level = priorityLevel[priority];
  return (
    <span className={styles.priority} style={{ color: priorityColor[priority] }}>
      <span className={styles.bars} aria-hidden>
        {[1, 2, 3].map((n) => (
          <span key={n} style={n <= level ? { background: 'currentColor' } : undefined} />
        ))}
      </span>
      {TASK_PRIORITY_LABELS[priority]}
    </span>
  );
}
