import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PriorityTag, ProjectStatusBadge } from './Badge';
import { Button } from './Button';
import { TextField } from './Field';
import { Pagination } from './Pagination';
import { ProgressBar } from './ProgressBar';

describe('Button', () => {
  it('disables itself and reports busy while loading', () => {
    render(<Button loading>Save</Button>);
    const button = screen.getByRole('button', { name: /save/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
  });
});

describe('TextField', () => {
  it('connects the label and announces the error', () => {
    render(<TextField label="Email" error="Enter a valid email address" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid email address');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByRole('alert').id);
  });
});

describe('badges', () => {
  it('shows human labels for enum values', () => {
    render(
      <>
        <ProjectStatusBadge status="IN_PROGRESS" />
        <PriorityTag priority="HIGH" />
      </>,
    );
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
  });
});

describe('ProgressBar', () => {
  it('clamps and rounds the value', () => {
    render(<ProgressBar value={133.4} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});

describe('Pagination', () => {
  it('shows the range and moves between pages', async () => {
    const onPage = vi.fn();
    render(<Pagination meta={{ page: 2, limit: 10, total: 25, totalPages: 3 }} onPage={onPage} noun="tasks" />);
    expect(screen.getByText('11–20 of 25 tasks')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPage.mock.calls).toEqual([[3], [1]]);
  });

  it('renders nothing for an empty list', () => {
    const { container } = render(
      <Pagination meta={{ page: 1, limit: 10, total: 0, totalPages: 1 }} onPage={() => {}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
