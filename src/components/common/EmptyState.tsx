import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

/**
 * GENERIC COMPONENT: EmptyState
 *
 * This component is in /common/ (not /plants/) because it's reusable.
 * Any page that might have "no data yet" can use it:
 *   - No plants → "Add your first plant!"
 *   - No watering logs → "No watering history yet"
 *   - No settings → "Set up your location"
 *
 * PROPS PATTERN:
 * Instead of hardcoding text, we receive everything via props.
 * This makes the component flexible without duplicating code.
 *
 * ReactNode type:
 * Can be any valid React content: JSX elements, strings, numbers, etc.
 * We use it for `icon` so the parent can pass any Lucide icon.
 */

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  message,
  actionLabel,
  onAction,
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.iconWrapper}>
        {icon}
      </div>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.message}>{message}</p>
      <button
        type="button"
        className={styles.actionButton}
        onClick={onAction}
      >
        {actionLabel}
      </button>
    </div>
  );
};

export default EmptyState;
