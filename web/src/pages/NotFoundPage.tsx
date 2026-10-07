import { Link } from 'react-router';

import { EmptyState } from '@/components/ui/States';

export function NotFoundPage() {
  return (
    <div className="page">
      <div className="panel">
        <EmptyState
          title="This page doesn’t exist"
          action={
            <Link to="/" style={{ color: 'var(--accent)', fontWeight: 500 }}>
              Back to the overview
            </Link>
          }
        >
          The link may be broken or the page was moved.
        </EmptyState>
      </div>
    </div>
  );
}
