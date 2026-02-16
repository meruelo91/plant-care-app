import { useEffect, useState } from 'react';
import styles from './SuccessAnimation.module.css';

/**
 * SuccessAnimation - Full-screen celebration animation.
 *
 * Shows a checkmark with confetti-like particles when the user
 * completes an action (like watering a plant). This creates a
 * satisfying feedback loop that encourages continued use.
 *
 * The animation auto-dismisses after 1.5 seconds.
 */

interface SuccessAnimationProps {
  onComplete?: () => void;
}

const SuccessAnimation: React.FC<SuccessAnimationProps> = ({ onComplete }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 1500);

    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.content}>
        {/* Animated checkmark */}
        <div className={styles.checkmark}>
          <svg viewBox="0 0 52 52" className={styles.checkmarkSvg}>
            <circle className={styles.checkmarkCircle} cx="26" cy="26" r="25" fill="none" />
            <path className={styles.checkmarkCheck} fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
          </svg>
        </div>

        {/* Water drops animation */}
        <div className={styles.drops}>
          <span className={styles.drop}>💧</span>
          <span className={styles.drop}>💧</span>
          <span className={styles.drop}>💧</span>
          <span className={styles.drop}>💧</span>
          <span className={styles.drop}>💧</span>
        </div>

        <p className={styles.text}>¡Regada!</p>
      </div>
    </div>
  );
};

export default SuccessAnimation;
