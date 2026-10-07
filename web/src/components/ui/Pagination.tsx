import type { PageMeta } from '@taskline/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from './Button';
import styles from './ui.module.css';

interface PaginationProps {
  meta: PageMeta;
  onPage: (page: number) => void;
  noun?: string;
}

export function Pagination({ meta, onPage, noun = 'items' }: PaginationProps) {
  if (meta.total === 0) return null;
  const from = (meta.page - 1) * meta.limit + 1;
  const to = Math.min(meta.page * meta.limit, meta.total);

  return (
    <nav className={styles.pagination} aria-label="Pagination">
      <span className="mono">
        {from}–{to} of {meta.total} {noun}
      </span>
      {meta.totalPages > 1 && (
        <div className={styles.pages}>
          <Button
            size="small"
            iconOnly
            aria-label="Previous page"
            disabled={meta.page <= 1}
            onClick={() => onPage(meta.page - 1)}
          >
            <ChevronLeft size={16} />
          </Button>
          <span className="mono" style={{ alignSelf: 'center' }}>
            {meta.page}/{meta.totalPages}
          </span>
          <Button
            size="small"
            iconOnly
            aria-label="Next page"
            disabled={meta.page >= meta.totalPages}
            onClick={() => onPage(meta.page + 1)}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      )}
    </nav>
  );
}
