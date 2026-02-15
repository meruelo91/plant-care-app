import { useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import styles from './ConfirmModal.module.css';

/**
 * ConfirmModal - Generic confirmation dialog.
 *
 * WHY A CUSTOM MODAL instead of window.confirm()?
 *   - window.confirm() can't be styled and looks different in every browser
 *   - In installed PWAs, native dialogs can behave unexpectedly
 *   - A custom modal follows the app's design language
 *
 * ACCESSIBILITY:
 *   - role="dialog" tells screen readers this is a dialog
 *   - aria-modal="true" tells screen readers to ignore content behind it
 *   - Focus is moved to the cancel button when the modal opens
 *   - Pressing Escape closes the modal (same as clicking cancel)
 *   - Clicking the dark overlay behind the modal also cancels
 *
 * PORTAL PATTERN:
 * Ideally modals are rendered via React Portal (createPortal) at the
 * document body level. For simplicity in this MVP, we render it inline
 * and use position:fixed to cover the screen. This works fine for our use.
 */

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancelar',
  variant = 'default',
  onConfirm,
  onCancel,
}) => {
  // Ref to the cancel button so we can focus it when the modal opens
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus the cancel button when the modal opens.
  // This is an accessibility best practice: the user can immediately
  // press Enter to cancel (the "safe" action) or Tab to confirm.
  useEffect(() => {
    if (isOpen) {
      cancelButtonRef.current?.focus();
    }
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onCancel();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    // Cleanup: remove the listener when the modal closes or unmounts
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  // Don't render anything if the modal is closed
  if (!isOpen) return null;

  return (
    // Overlay: dark semi-transparent background
    <div
      className={styles.overlay}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      {/* Modal card: stop click propagation so clicking inside
          doesn't trigger the overlay's onClick (which cancels) */}
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.iconWrapper}>
          <AlertTriangle
            size={32}
            className={variant === 'danger' ? styles.iconDanger : styles.iconDefault}
          />
        </div>

        <h2 id="confirm-modal-title" className={styles.title}>
          {title}
        </h2>
        <p className={styles.message}>{message}</p>

        <div className={styles.actions}>
          <button
            ref={cancelButtonRef}
            type="button"
            className={styles.cancelButton}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={
              variant === 'danger' ? styles.dangerButton : styles.confirmButton
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
