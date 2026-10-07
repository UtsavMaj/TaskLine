import { formatDate, isOverdue, TASK_STATUS_LABELS, TASK_STATUSES, type Task, type TaskStatus } from '@taskline/shared';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { Link } from 'react-router';

import { OverdueBadge, PriorityTag } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

import styles from './tasks.module.css';

interface TaskRowProps {
  task: Task;
  showProject: boolean;
  busy: boolean;
  onStatusChange: (status: TaskStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function TaskRow({ task, showProject, busy, onStatusChange, onEdit, onDelete }: TaskRowProps) {
  const done = task.status === 'COMPLETED';
  const overdue = isOverdue(task);

  return (
    <li className={styles.row} data-done={done} aria-busy={busy || undefined}>
      <button
        type="button"
        className={styles.check}
        aria-pressed={done}
        aria-label={done ? `Mark "${task.name}" as not done` : `Mark "${task.name}" as done`}
        disabled={busy}
        onClick={() => onStatusChange(done ? 'PENDING' : 'COMPLETED')}
      >
        {done && <Check size={14} strokeWidth={3} />}
      </button>

      <div className={styles.body}>
        <span className={styles.name}>{task.name}</span>
        <span className={styles.sub}>
          {showProject && (
            <Link to={`/projects/${task.projectId}`} className={styles.projectLink}>
              {task.project.name}
            </Link>
          )}
          {task.description && <span className={styles.desc}>{task.description}</span>}
        </span>
      </div>

      <div className={styles.meta}>
        <div className={styles.priorityCell}>
          <PriorityTag priority={task.priority} />
        </div>

        <div className={styles.due} data-overdue={overdue}>
          {overdue ? <OverdueBadge /> : null}
          <span className="mono">{task.dueDate ? formatDate(task.dueDate) : 'No due date'}</span>
        </div>

        <select
          className={styles.statusSelect}
          aria-label={`Status of "${task.name}"`}
          value={task.status}
          disabled={busy}
          data-status={task.status}
          onChange={(event) => onStatusChange(event.target.value as TaskStatus)}
        >
          {TASK_STATUSES.map((status) => (
            <option key={status} value={status}>
              {TASK_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.actions}>
        <Button variant="ghost" size="small" iconOnly aria-label={`Edit "${task.name}"`} onClick={onEdit}>
          <Pencil size={15} />
        </Button>
        <Button variant="ghost" size="small" iconOnly aria-label={`Delete "${task.name}"`} onClick={onDelete}>
          <Trash2 size={15} />
        </Button>
      </div>
    </li>
  );
}
