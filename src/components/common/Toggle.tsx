import React from 'react';
import styles from './Toggle.module.css';

/**
 * Toggle - Accessible switch component for boolean settings.
 *
 * ACCESSIBILITY:
 * Uses role="switch" and aria-checked to communicate state to screen readers.
 * The button element is keyboard-focusable by default.
 *
 * USAGE:
 * <Toggle
 *   id="notifications"
 *   checked={isEnabled}
 *   onChange={(checked) => setIsEnabled(checked)}
 *   label="Enable notifications"
 *   description="Get reminders to water your plants"
 * />
 */

interface ToggleProps {
  /** Unique ID for accessibility (links label to input) */
  id: string;
  /** Whether the toggle is currently on */
  checked: boolean;
  /** Called when the user clicks the toggle */
  onChange: (checked: boolean) => void;
  /** Whether the toggle is disabled */
  disabled?: boolean;
  /** Accessible label text */
  label: string;
  /** Optional description text below the label */
  description?: string;
}

const Toggle: React.FC<ToggleProps> = ({
  id,
  checked,
  onChange,
  disabled = false,
  label,
  description,
}) => {
  const handleClick = (): void => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <div className={styles.toggleRow}>
      <div className={styles.labelGroup}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {description && (
          <span className={styles.description}>{description}</span>
        )}
      </div>

      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={`${styles.track} ${checked ? styles.trackOn : ''} ${disabled ? styles.disabled : ''}`}
        onClick={handleClick}
      >
        <span className={`${styles.thumb} ${checked ? styles.thumbOn : ''}`} />
      </button>
    </div>
  );
};

export default Toggle;
