import styles from './SplashScreen.module.css';

/**
 * SplashScreen - Animated loading screen shown while the app initializes.
 *
 * Displays a pulsing plant icon with the app name. This creates a more
 * polished first impression compared to a blank screen or simple spinner.
 *
 * The animation uses CSS keyframes for the pulse effect, which is more
 * performant than JavaScript-based animations.
 */
const SplashScreen: React.FC = () => {
  return (
    <div className={styles.container}>
      <div className={styles.iconWrapper}>
        <span className={styles.icon}>🌱</span>
      </div>
      <h1 className={styles.title}>Plant Care</h1>
      <p className={styles.subtitle}>Cargando...</p>
    </div>
  );
};

export default SplashScreen;
