import { useState } from 'react';
import { MapPin, Globe, AlertCircle } from 'lucide-react';
import { useOnboarding } from '@/hooks/useOnboarding';
import styles from './OnboardingPage.module.css';

/**
 * OnboardingPage - First-time setup screen for location.
 *
 * CONDITIONAL RENDERING PATTERN:
 * This page renders different "screens" based on the onboarding step.
 * Instead of using multiple routes (which could be bookmarked or broken
 * by browser refresh), we use a single component with internal state.
 *
 * The `step` variable from useOnboarding determines which screen shows:
 *   'welcome' → greeting + two action buttons
 *   'locating' → spinner while GPS resolves
 *   'manual' → country dropdown
 *   'confirm' → success message + continue button
 *
 * All the logic (API calls, state transitions, error handling) lives
 * in the useOnboarding hook. This page is purely presentational.
 */

/** Countries available for manual selection */
const COUNTRIES: readonly string[] = [
  'España',
  'México',
  'Argentina',
  'Colombia',
  'Chile',
  'Perú',
  'Estados Unidos',
  'Francia',
  'Italia',
  'Alemania',
  'Reino Unido',
  'Brasil',
  'Portugal',
  'Otro',
] as const;

const OnboardingPage: React.FC = () => {
  const {
    step,
    location,
    errorMessage,
    requestAutoLocation,
    goToManualSelection,
    selectCountry,
    completeOnboarding,
  } = useOnboarding();

  // Local state for the country dropdown (only used in 'manual' step)
  const [selectedCountry, setSelectedCountry] = useState<string>('');

  /** Handle manual country selection form submit */
  const handleManualConfirm = (): void => {
    if (selectedCountry) {
      selectCountry(selectedCountry);
    }
  };

  // ─── Welcome Step ───
  if (step === 'welcome') {
    return (
      <div className={styles.page}>
        <div className={styles.stepContainer}>
          <span className={styles.logo}>🌱</span>
          <h1 className={styles.title}>Bienvenido a Plant Care</h1>
          <p className={styles.subtitle}>
            Para darte consejos de riego personalizados, necesitamos saber
            dónde está tu jardín
          </p>

          <div className={styles.buttonGroup}>
            <button
              type="button"
              className={styles.primaryButton}
              onClick={requestAutoLocation}
            >
              <MapPin size={20} />
              Usar mi ubicación
            </button>
            <button
              type="button"
              className={styles.secondaryButton}
              onClick={goToManualSelection}
            >
              <Globe size={20} />
              Elegir manualmente
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Locating Step (spinner) ───
  if (step === 'locating') {
    return (
      <div className={styles.page}>
        <div className={styles.stepContainer}>
          <div className={styles.spinner} />
          <p className={styles.locatingText}>Obteniendo tu ubicación...</p>
        </div>
      </div>
    );
  }

  // ─── Manual Selection Step ───
  if (step === 'manual') {
    return (
      <div className={styles.page}>
        <div className={styles.stepContainer}>
          {/* Show error banner if auto-location failed */}
          {errorMessage && (
            <div className={styles.errorBanner}>
              <AlertCircle size={18} />
              <span>{errorMessage}</span>
            </div>
          )}

          <h2 className={styles.manualTitle}>Selecciona tu país</h2>
          <p className={styles.manualSubtitle}>
            Usaremos esta información para adaptar los consejos de riego
            a tu clima
          </p>

          <select
            className={styles.select}
            value={selectedCountry}
            onChange={(event) => setSelectedCountry(event.target.value)}
          >
            <option value="" disabled>
              Elige un país...
            </option>
            {COUNTRIES.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleManualConfirm}
            disabled={!selectedCountry}
          >
            Confirmar
          </button>
        </div>
      </div>
    );
  }

  // ─── Confirm Step ───
  // Build the location display string
  const locationText: string = location?.city
    ? `${location.city}, ${location.country}`
    : location?.country ?? '';

  return (
    <div className={styles.page}>
      <div className={styles.stepContainer}>
        <span className={styles.successIcon}>✅</span>
        <h2 className={styles.confirmTitle}>Ubicación configurada</h2>

        <div className={styles.locationDisplay}>
          <MapPin size={22} className={styles.locationIcon} />
          <span className={styles.locationText}>{locationText}</span>
        </div>

        <button
          type="button"
          className={styles.primaryButton}
          onClick={completeOnboarding}
        >
          Continuar
        </button>
      </div>
    </div>
  );
};

export default OnboardingPage;
