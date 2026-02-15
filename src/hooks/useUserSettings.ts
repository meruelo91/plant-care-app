import { useState, useEffect, useRef, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { UserSettings } from '@/types';

/**
 * useUserSettings - Reactive hook that reads UserSettings from IndexedDB.
 *
 * WHY THIS HOOK EXISTS:
 * Multiple parts of the app need to know the user's settings:
 *   - App.tsx checks if onboarding is completed
 *   - SettingsPage displays the current location
 *   - (Future) AI tips need location for weather-based advice
 *
 * By centralizing this in a hook, we avoid duplicating the query logic.
 *
 * LOADING vs NOT-FOUND TRICK:
 * Same pattern as usePlantDetail: useLiveQuery returns undefined both
 * when loading AND when no record exists. We wrap the query to return
 * null for "not found", so:
 *   - undefined → still loading (show spinner)
 *   - null → no settings saved yet (show onboarding)
 *   - UserSettings → settings exist (check onboardingCompleted)
 *
 * TIMEOUT SAFETY NET (for Safari/iPhone):
 * IndexedDB can fail silently on Safari, especially after a Dexie version
 * bump. When this happens, useLiveQuery never resolves and the app shows
 * the loading spinner forever. To prevent this, we start a 3-second timer.
 * If the query hasn't resolved by then, we assume the DB is stuck and
 * stop loading — the app falls through to the onboarding screen, which
 * is a much better UX than an infinite spinner.
 *
 * REACTIVE:
 * Thanks to useLiveQuery, when the onboarding flow saves settings to
 * IndexedDB, this hook automatically re-renders all components using it.
 * No manual refresh or state syncing needed — Dexie handles it.
 */

/** How long to wait (ms) before giving up on IndexedDB */
const LOADING_TIMEOUT_MS = 3000;

interface UseUserSettingsResult {
  /** The settings object, or undefined if loading or not found */
  settings: UserSettings | undefined;
  /** true while the first database read is in progress */
  isLoading: boolean;
  /** true if settings exist AND onboarding has been completed */
  isOnboardingCompleted: boolean;
  /** true if the loading timed out (IndexedDB probably broken) */
  didTimeout: boolean;
  /** Update settings (partial update, id cannot be changed) */
  updateSettings: (updates: Partial<Omit<UserSettings, 'id'>>) => Promise<void>;
}

export function useUserSettings(): UseUserSettingsResult {
  // ─── Timeout safety net ───
  // Tracks whether the initial load took too long (Safari/iPhone issue).
  const [didTimeout, setDidTimeout] = useState<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Query the singleton settings record.
  // .then(s => s ?? null) converts "not found" (undefined) to null,
  // so we can distinguish it from the loading state (also undefined).
  const rawResult = useLiveQuery(
    () => db.userSettings.get('user-settings').then((s) => s ?? null),
  );

  // rawResult is:
  //   undefined → still loading
  //   null → no settings saved yet
  //   UserSettings → settings exist
  const queryResolved: boolean = rawResult !== undefined;

  // Start a timeout when the hook mounts. If the query resolves before
  // the timer fires, we clear the timer. If not, we set didTimeout = true
  // so the app stops showing the loading spinner.
  useEffect(() => {
    if (queryResolved) {
      // Query resolved — cancel any pending timeout
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Only start the timer once
    if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        console.warn(
          '[useUserSettings] IndexedDB query timed out after ' +
          `${LOADING_TIMEOUT_MS}ms — falling through to onboarding.`
        );
        setDidTimeout(true);
      }, LOADING_TIMEOUT_MS);
    }

    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [queryResolved]);

  // If the query timed out, stop showing loading and let the app continue
  const isLoading: boolean = !queryResolved && !didTimeout;
  const settings: UserSettings | undefined = rawResult ?? undefined;
  const isOnboardingCompleted: boolean = settings?.onboardingCompleted === true;

  /**
   * Update settings with a partial object.
   * Uses Dexie's put() which overwrites the entire record.
   * The id field cannot be changed (excluded from the type).
   */
  const updateSettings = useCallback(
    async (updates: Partial<Omit<UserSettings, 'id'>>): Promise<void> => {
      if (!settings) {
        console.warn('[useUserSettings] Cannot update: no settings exist yet.');
        return;
      }

      const updated: UserSettings = {
        ...settings,
        ...updates,
      };

      try {
        await db.userSettings.put(updated);
        // No manual state update needed — useLiveQuery handles reactivity
      } catch (error) {
        console.error('[useUserSettings] Error updating settings:', error);
        throw error; // Re-throw so callers can handle UI feedback
      }
    },
    [settings]
  );

  return {
    settings,
    isLoading,
    isOnboardingCompleted,
    didTimeout,
    updateSettings,
  };
}
