import { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import styles from './Toast.module.css';

/**
 * Toast - Temporary notification that appears at the bottom of the screen.
 *
 * TOAST PATTERN:
 * Toasts are non-blocking notifications that auto-dismiss after a few seconds.
 * They're used for confirmations ("Plant added!") and non-critical errors.
 * Unlike modals, users don't need to interact with them.
 *
 * VARIANTS:
 *   - success: Green checkmark, for positive actions
 *   - error: Red alert, for failures
 *   - info: Blue info icon, for neutral messages
 */

export type ToastType = 'success' | 'error' | 'info';

export interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number; // ms before auto-dismiss
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}) => {
  // Auto-dismiss after duration
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const Icon = type === 'success' ? CheckCircle : type === 'error' ? AlertCircle : Info;

  return (
    <div className={`${styles.toast} ${styles[type]}`} role="alert">
      <Icon size={20} className={styles.icon} />
      <span className={styles.message}>{message}</span>
      <button
        type="button"
        className={styles.closeButton}
        onClick={onClose}
        aria-label="Cerrar"
      >
        <X size={18} />
      </button>
    </div>
  );
};

export default Toast;
