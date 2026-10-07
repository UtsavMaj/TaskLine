import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { Button } from './Button';
import styles from './ui.module.css';

interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Built on the native <dialog> element: showModal() gives focus trapping, Escape to close
 * and an inert background for free, which is hard to get right by hand.
 */
export function Modal({ open, title, description, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault(); // let React state decide, keeps open/closed in sync
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose(); // click on the backdrop
      }}
    >
      {open && (
        <>
          <div className={styles.dialogHead}>
            <div>
              <h2 id={titleId}>{title}</h2>
              {description && <p className={styles.dialogDescription}>{description}</p>}
            </div>
            <Button variant="ghost" size="small" iconOnly aria-label="Close" onClick={onClose}>
              <X size={16} />
            </Button>
          </div>
          <div className={styles.dialogBody}>{children}</div>
        </>
      )}
    </dialog>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  busy,
  onConfirm,
  onClose,
}: ConfirmProps) {
  return (
    <Modal open={open} title={title} onClose={onClose}>
      <p className="muted">{message}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 22 }}>
        <Button variant="ghost" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button variant="danger" onClick={onConfirm} loading={busy}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
