import { Search } from 'lucide-react';
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

import styles from './ui.module.css';

interface A11yProps {
  id: string;
  'aria-invalid': boolean;
  'aria-describedby'?: string;
}

interface FieldShellProps {
  label: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
  children: (props: A11yProps) => ReactNode;
}

/** Label + control + hint/error, wired up with ids so screen readers announce the error. */
export function FieldShell({ label, error, hint, optional, children }: FieldShellProps) {
  const id = useId();
  const messageId = `${id}-msg`;
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label} {optional && <span className={styles.optional}>(optional)</span>}
      </label>
      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': error || hint ? messageId : undefined })}
      {error ? (
        <span id={messageId} className={styles.error} role="alert">
          {error}
        </span>
      ) : hint ? (
        <span id={messageId} className={styles.hint}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

type Common = { label: string; error?: string; hint?: ReactNode; optional?: boolean };

export const TextField = forwardRef<HTMLInputElement, Common & InputHTMLAttributes<HTMLInputElement>>(
  function TextField({ label, error, hint, optional, className, ...rest }, ref) {
    return (
      <FieldShell label={label} error={error} hint={hint} optional={optional}>
        {(a11y) => (
          <input ref={ref} className={[styles.control, className].filter(Boolean).join(' ')} {...a11y} {...rest} />
        )}
      </FieldShell>
    );
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, Common & TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ label, error, hint, optional, ...rest }, ref) {
    return (
      <FieldShell label={label} error={error} hint={hint} optional={optional}>
        {(a11y) => <textarea ref={ref} className={styles.control} rows={3} {...a11y} {...rest} />}
      </FieldShell>
    );
  },
);

export const SelectField = forwardRef<HTMLSelectElement, Common & SelectHTMLAttributes<HTMLSelectElement>>(
  function SelectField({ label, error, hint, optional, children, ...rest }, ref) {
    return (
      <FieldShell label={label} error={error} hint={hint} optional={optional}>
        {(a11y) => (
          <select ref={ref} className={styles.control} {...a11y} {...rest}>
            {children}
          </select>
        )}
      </FieldShell>
    );
  },
);

/** Bare select for toolbars (filters, sorting), labelled for screen readers only. */
export function FilterSelect({
  label,
  children,
  ...rest
}: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={styles.control} aria-label={label} style={{ width: 'auto', minWidth: 140 }} {...rest}>
      {children}
    </select>
  );
}

export function SearchInput({
  label,
  ...rest
}: { label: string } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <div className={styles.search}>
      <Search size={16} aria-hidden />
      <input type="search" className={styles.control} aria-label={label} {...rest} />
    </div>
  );
}
