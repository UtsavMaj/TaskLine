import { formatDate, formatTimestampDate, type CreateProjectData } from '@taskline/shared';
import { ArrowLeft, CalendarRange, Clock3, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { ApiError, errorMessage } from '@/api/client';
import { ProjectForm } from '@/components/projects/ProjectForm';
import styles from '@/components/projects/projects.module.css';
import { TaskList } from '@/components/tasks/TaskList';
import { ProjectStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog, Modal } from '@/components/ui/Modal';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useDeleteProject, useProject, useUpdateProject } from '@/hooks/queries';

export function ProjectDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const project = useProject(id);
  const updateProject = useUpdateProject(id);
  const deleteProject = useDeleteProject();

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (project.isPending) return <PageLoader label="Loading project…" />;

  if (project.isError) {
    const missing = project.error instanceof ApiError && project.error.status === 404;
    return (
      <div className="page">
        <div className="panel">
          {missing ? (
            <EmptyState
              title="Project not found"
              action={
                <Link to="/projects" className="muted">
                  Back to projects
                </Link>
              }
            >
              It may have been deleted, or the link is wrong.
            </EmptyState>
          ) : (
            <ErrorState error={project.error} onRetry={() => project.refetch()} />
          )}
        </div>
      </div>
    );
  }

  const p = project.data;

  const handleEdit = async (data: CreateProjectData) => {
    await updateProject.mutateAsync(data);
    setEditing(false);
    toast.success('Project updated');
  };

  const handleDelete = async () => {
    try {
      await deleteProject.mutateAsync(p.id);
      toast.success(`Deleted “${p.name}”`);
      navigate('/projects', { replace: true });
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const open = p.taskCounts.total - p.taskCounts.completed;

  return (
    <div className="page">
      <Link
        to="/projects"
        className="muted"
        style={{ display: 'inline-flex', gap: 6, alignItems: 'center', textDecoration: 'none' }}
      >
        <ArrowLeft size={16} /> Projects
      </Link>

      <section className="panel">
        <div style={{ padding: 20 }} className={styles.detailHead}>
          <div style={{ minWidth: 0 }}>
            <h1 style={{ overflowWrap: 'anywhere' }}>{p.name}</h1>
            <div className={styles.meta}>
              <ProjectStatusBadge status={p.status} />
              <span>
                <CalendarRange size={15} />
                {p.startDate || p.endDate
                  ? `${formatDate(p.startDate, 'No start')} → ${formatDate(p.endDate, 'No end')}`
                  : 'No dates set'}
              </span>
              <span>
                <Clock3 size={15} />
                Created {formatTimestampDate(p.createdAt)}
              </span>
            </div>
          </div>
          <div className="toolbar">
            <Button icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          </div>
        </div>

        {p.description && <p className={styles.description}>{p.description}</p>}

        <div className={styles.facts}>
          <div className={styles.fact}>
            <span className="eyebrow">Tasks</span>
            <strong>{p.taskCounts.total}</strong>
          </div>
          <div className={styles.fact}>
            <span className="eyebrow">Done</span>
            <strong>{p.taskCounts.completed}</strong>
          </div>
          <div className={styles.fact}>
            <span className="eyebrow">Open</span>
            <strong>{open}</strong>
          </div>
          <div className={styles.fact}>
            <span className="eyebrow">Progress</span>
            <div style={{ marginTop: 12 }}>
              <ProgressBar value={p.progress} label="Project progress" />
            </div>
          </div>
        </div>
      </section>

      <TaskList projectId={p.id} title="Tasks in this project" />

      <Modal open={editing} title="Edit project" onClose={() => setEditing(false)}>
        <ProjectForm project={p} submitLabel="Save changes" onSubmit={handleEdit} onCancel={() => setEditing(false)} />
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this project?"
        message={
          <>
            “{p.name}” and its {p.taskCounts.total} {p.taskCounts.total === 1 ? 'task' : 'tasks'} will be deleted. This
            can’t be undone.
          </>
        }
        confirmLabel="Delete project"
        busy={deleteProject.isPending}
        onConfirm={handleDelete}
        onClose={() => setConfirmDelete(false)}
      />
    </div>
  );
}
