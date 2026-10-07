import {
  formatDate,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  type CreateProjectData,
  type ProjectSortField,
  type ProjectStatus,
  type SortOrder,
} from '@taskline/shared';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { ProjectForm } from '@/components/projects/ProjectForm';
import styles from '@/components/projects/projects.module.css';
import { ProjectStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FilterSelect, SearchInput } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Segmented } from '@/components/ui/Segmented';
import { Skeleton } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useCreateProject, useProjects } from '@/hooks/queries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

const SORTS: { value: `${ProjectSortField}:${SortOrder}`; label: string }[] = [
  { value: 'createdAt:desc', label: 'Recently created' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'endDate:asc', label: 'End date' },
  { value: 'startDate:desc', label: 'Start date' },
];

const STATUS_OPTIONS: { value: ProjectStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All' },
  ...PROJECT_STATUSES.map((status) => ({ value: status, label: PROJECT_STATUS_LABELS[status] })),
];

export function ProjectsPage() {
  const toast = useToast();
  const navigate = useNavigate();

  // Filters live in the URL so a filtered view can be bookmarked or survives a reload.
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? 'ALL') as ProjectStatus | 'ALL';
  const sort = (params.get('sort') ?? 'createdAt:desc') as (typeof SORTS)[number]['value'];
  const page = Number(params.get('page') ?? 1) || 1;
  const [search, setSearch] = useState(params.get('q') ?? '');
  const debouncedSearch = useDebouncedValue(search.trim());

  const [creating, setCreating] = useState(params.get('new') === '1');
  const createProject = useCreateProject();

  const update = (next: Record<string, string | null>) => {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        for (const [key, value] of Object.entries(next)) {
          if (value === null || value === '') copy.delete(key);
          else copy.set(key, value);
        }
        return copy;
      },
      { replace: true },
    );
  };

  const [sortBy, order] = sort.split(':') as [ProjectSortField, SortOrder];
  const query = useProjects({
    search: debouncedSearch,
    status: status === 'ALL' ? '' : status,
    sortBy,
    order,
    page,
    limit: 10,
  });

  const handleCreate = async (data: CreateProjectData) => {
    const project = await createProject.mutateAsync(data);
    setCreating(false);
    toast.success(`Project “${project.name}” created`);
    navigate(`/projects/${project.id}`);
  };

  const projects = query.data?.data ?? [];
  const filtered = Boolean(debouncedSearch) || status !== 'ALL';

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="lede">Everything you’re working on, with progress worked out from each project’s tasks.</p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          New project
        </Button>
      </header>

      <div className="toolbar">
        <div className="grow">
          <SearchInput
            label="Search projects by name"
            placeholder="Search projects"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              update({ q: event.target.value, page: null });
            }}
          />
        </div>
        <Segmented
          label="Filter by status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(value) => update({ status: value === 'ALL' ? null : value, page: null })}
        />
        <FilterSelect label="Sort projects" value={sort} onChange={(e) => update({ sort: e.target.value, page: null })}>
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </FilterSelect>
      </div>

      <section className="panel" aria-label="Project list">
        <div className={styles.headRow} aria-hidden>
          <span className="eyebrow">Project</span>
          <span className="eyebrow">Status</span>
          <span className="eyebrow">Progress</span>
          <span className="eyebrow">Timeline</span>
        </div>

        {query.isPending ? (
          <ul className={styles.list}>
            {[0, 1, 2].map((n) => (
              <li key={n} className={styles.row}>
                <Skeleton width="55%" />
                <Skeleton width={80} />
                <Skeleton />
                <Skeleton width={110} />
              </li>
            ))}
          </ul>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : projects.length === 0 ? (
          filtered ? (
            <EmptyState title="No projects match">Try another name or switch the status filter back to All.</EmptyState>
          ) : (
            <EmptyState
              title="No projects yet"
              action={
                <Button variant="primary" size="small" icon={<Plus size={15} />} onClick={() => setCreating(true)}>
                  Create your first project
                </Button>
              }
            >
              A project groups related tasks and tracks how far along they are.
            </EmptyState>
          )
        ) : (
          <ul className={styles.list} style={{ opacity: query.isPlaceholderData ? 0.6 : 1 }}>
            {projects.map((project) => (
              <li key={project.id}>
                <Link to={`/projects/${project.id}`} className={styles.row}>
                  <div className={styles.rowTitle}>
                    <strong>{project.name}</strong>
                    <span>{project.description ?? 'No description'}</span>
                  </div>
                  <div>
                    <ProjectStatusBadge status={project.status} />
                  </div>
                  <div className={styles.progressCell}>
                    <ProgressBar value={project.progress} label={`${project.name} progress`} />
                    <small>
                      {project.taskCounts.completed} of {project.taskCounts.total} tasks done
                    </small>
                  </div>
                  <span className={styles.dates}>
                    {project.startDate || project.endDate
                      ? `${formatDate(project.startDate, '…')} → ${formatDate(project.endDate, '…')}`
                      : 'No dates set'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {query.data && (
          <Pagination meta={query.data.meta} onPage={(next) => update({ page: String(next) })} noun="projects" />
        )}
      </section>

      <Modal
        open={creating}
        title="New project"
        description="You can add tasks right after creating it."
        onClose={() => setCreating(false)}
      >
        <ProjectForm submitLabel="Create project" onSubmit={handleCreate} onCancel={() => setCreating(false)} />
      </Modal>
    </div>
  );
}
