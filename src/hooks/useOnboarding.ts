import { useState, useCallback } from 'react';
import { db } from '@/db/database';
import { getFullLocation } from '@/utils/geolocation';
import type { GeoError } from '@/utils/geolocation';
import type { UserSettings, UserLocation } from '@/types';

/**
 * useOnboarding - Hook that manages the entire onboarding flow.
 *
 * STATE MACHINE PATTERN:
 * The onboarding has multiple "screens" but it's a single React component.
 * Instead of using routes (which could be bookmarked or refreshed), we
 * use a state variable called `step` that determines which screen to show.
 *
 * The flow:
 *   'welcome' → user sees two buttons (auto/manual)
 *       ↓ clicks "Usar mi ubicación"
 *   'locating' → spinner while GPS + Nominatim resolve
 *       ↓ success
 *   'confirm' → shows the detected location + "Continuar" button
 *       ↓ error (GPS denied, API failed, etc.)
 *   'manual' → dropdown to pick a country
 *       ↓ picks country
 *   'confirm' → shows the selected country + "Continuar" button
 *       ↓ clicks "Continuar"
 *   saves to IndexedDB → onboarding complete → App re-renders
 *
 * WHY A HOOK AND NOT INLINE STATE?
 * The OnboardingPage would become huge (200+ lines) with all the
 * state management, API calls, and DB writes mixed with the JSX.
 * This hook keeps the page focused on presentation only.
 */

// ─── Types ───

/** The possible screens in the onboarding flow */
export type OnboardingStep = 'welcome' | 'locating' | 'manual' | 'confirm';

/** The location data collected during onboarding (before saving to DB) */
interface CollectedLocation {
  type: 'auto' | 'manual';
  country: string;
  city?: string;
  coords?: { lat: number; lon: number };
}

export interface UseOnboardingResult {
  /** Current screen in the onboarding flow */
  step: OnboardingStep;
  /** The location data once obtained (auto or manual) */
  location: CollectedLocation | null;
  /** Error message to display (e.g., "Permiso denegado") */
  errorMessage: string | null;
  /** Start automatic geolocation (GPS + reverse geocoding) */
  requestAutoLocation: () => Promise<void>;
  /** Switch to manual country selection mode */
  goToManualSelection: () => void;
  /** Save the manually selected country */
  selectCountry: (country: string) => void;
  /** Write settings to IndexedDB and complete onboarding */
  completeOnboarding: () => Promise<void>;
}

// ─── Hook ───

export function useOnboarding(): UseOnboardingResult {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [location, setLocation] = useState<CollectedLocation | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Request automatic location via GPS + Nominatim.
   *
   * ASYNC FLOW:
   * 1. Show the "locating" spinner
   * 2. Ask the browser for GPS coordinates (user sees permission popup)
   * 3. Send coordinates to Nominatim for reverse geocoding
   * 4. If everything works → go to "confirm" screen
   * 5. If anything fails → show error and offer manual selection
   */
  const requestAutoLocation = useCallback(async (): Promise<void> => {
    setStep('locating');
    setErrorMessage(null);

    try {
      const result = await getFullLocation();

      setLocation({
        type: 'auto',
        country: result.country,
        city: result.city,
        coords: result.coords,
      });
      setStep('confirm');
    } catch (error: unknown) {
      // Check if it's our typed GeoError
      const geoError = error as GeoError;
      const message =
        geoError.message ?? 'No se pudo obtener tu ubicación';

      setErrorMessage(message);
      // Fall back to manual selection so the user isn't stuck
      setStep('manual');
    }
  }, []);

  /**
   * Switch to manual country selection.
   * Called when the user clicks "Elegir manualmente" on the welcome screen.
   */
  const goToManualSelection = useCallback((): void => {
    setErrorMessage(null);
    setStep('manual');
  }, []);

  /**
   * Save the manually selected country and proceed to confirmation.
   */
  const selectCountry = useCallback((country: string): void => {
    setLocation({
      type: 'manual',
      country,
    });
    setStep('confirm');
  }, []);

  /**
   * Save settings to IndexedDB and complete the onboarding.
   *
   * db.userSettings.put() either creates or updates the record.
   * We use 'put' instead of 'add' because 'add' would throw an error
   * if the record already exists (unlikely but defensive coding).
   *
   * Once this write completes, the useUserSettings hook in App.tsx
   * automatically detects the change (via useLiveQuery's reactivity)
   * and re-renders, showing the main app instead of the onboarding.
   */
  const completeOnboarding = useCallback(async (): Promise<void> => {
    if (!location) return;

    const userLocation: UserLocation = {
      type: location.type,
      country: location.country,
      city: location.city,
      coords: location.coords,
    };

    const settings: UserSettings = {
      id: 'user-settings',
      location: userLocation,
      onboardingCompleted: true,
      notificationsEnabled: false,
      notificationTime: '09:00',
      notificationPermission: 'default',
    };

    try {
      await db.userSettings.put(settings);
      // No need to navigate — the useUserSettings hook in App.tsx
      // will reactively detect the new settings and switch to the main app.
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  }, [location]);

  return {
    step,
    location,
    errorMessage,
    requestAutoLocation,
    goToManualSelection,
    selectCountry,
    completeOnboarding,
  };
}
