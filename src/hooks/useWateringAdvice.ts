import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/db/database';
import { generateWateringAdvice, getFallbackAdvice } from '@/services/claudeAPI';
import type { AdviceParams } from '@/services/claudeAPI';
import { getCurrentSeason } from '@/utils/seasons';
import type { PlantWateringAdvice, Plant, UserSettings } from '@/types';

/**
 * useWateringAdvice - Hook for fetching, persisting, and displaying watering advice.
 *
 * PART 2 CHANGES (vs Part 1):
 * Before: user had to click "Pedir consejos" → called API → showed result (not saved)
 * Now:    advice auto-fetches on mount if not saved → saves to IndexedDB → persists
 *
 * FLOW:
 *   Component mounts → plant.wateringAdvice exists?
 *     YES → show saved advice immediately (no API call)
 *     NO  → auto-fetch from API
 *       → API works → save to DB → show advice
 *       → API fails → use fallback → save to DB → show advice (with isFallback flag)
 *
 * PERSISTENCE:
 * Advice is stored INSIDE the Plant record in IndexedDB as `wateringAdvice`.
 * This means:
 *   - Opening a plant detail a second time is instant (no API call)
 *   - Advice survives app restarts and browser closures
 *   - The "Regenerar" button lets the user force a new API call
 *
 * WHY useRef FOR hasFetched?
 * React's StrictMode in development runs useEffect twice. Without
 * the hasFetched ref, we'd make two API calls on mount. The ref
 * persists across renders but doesn't trigger re-renders (unlike state).
 */

// ─── Types ───

type AdviceStatus = 'loading' | 'success' | 'error';

export interface UseWateringAdviceResult {
  /** Current state: loading, success, or error */
  status: AdviceStatus;
  /** The persisted advice object (null while loading or on error) */
  advice: PlantWateringAdvice | null;
  /** true if advice came from hardcoded fallback instead of Claude AI */
  isFallback: boolean;
  /** Error message in Spanish (only when status === 'error') */
  errorMessage: string | null;
  /** Force re-generation from API (ignores saved advice) */
  regenerate: () => Promise<void>;
}

// ─── Hook ───

export function useWateringAdvice(
  plant: Plant | undefined,
  settings: UserSettings | undefined,
): UseWateringAdviceResult {
  const [status, setStatus] = useState<AdviceStatus>('loading');
  const [advice, setAdvice] = useState<PlantWateringAdvice | null>(null);
  const [isFallback, setIsFallback] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ref to prevent double-fetch in React StrictMode (dev only)
  const hasFetched = useRef<boolean>(false);

  /**
   * Build the location display string for metadata.
   * Used when saving advice to show "Verano en Valencia, España".
   */
  const getLocationText = useCallback((): string => {
    if (!settings) return '';
    return settings.location.city
      ? `${settings.location.city}, ${settings.location.country}`
      : settings.location.country;
  }, [settings]);

  /**
   * Core function: fetch advice from API, fall back if needed, save to DB.
   *
   * This function is used both for the initial auto-fetch AND for
   * the "Regenerar" button. The isRegeneration flag determines
   * whether we skip the "already has advice" check.
   */
  const fetchAndSave = useCallback(
    async (isRegeneration: boolean): Promise<void> => {
      if (!plant || !settings) return;

      // If the plant already has saved advice and this is NOT a regeneration,
      // just use the saved advice.
      if (!isRegeneration && plant.wateringAdvice) {
        setAdvice(plant.wateringAdvice);
        setIsFallback(plant.wateringAdvice.isFallback === true);
        setStatus('success');
        return;
      }

      setStatus('loading');
      setErrorMessage(null);

      const locationText = getLocationText();
      const season = getCurrentSeason(settings.location.country);
      let usedFallback = false;

      try {
        // Try to get advice from Claude API
        const params: AdviceParams = {
          plantType: plant.type,
          species: plant.species,
          country: settings.location.country,
          city: settings.location.city,
        };

        const result = await generateWateringAdvice(params);

        // Build the persisted advice object with metadata
        const persistedAdvice: PlantWateringAdvice = {
          text: result.advice,
          frequencyDays: result.frequencyDays,
          bestTime: result.bestTime,
          amount: result.amount,
          generatedAt: new Date(),
          season,
          location: locationText,
          isFallback: false,
        };

        // Save to IndexedDB inside the Plant record
        await db.plants.update(plant.id, { wateringAdvice: persistedAdvice });

        setAdvice(persistedAdvice);
        setIsFallback(false);
        setStatus('success');
      } catch (apiError: unknown) {
        // API failed — use hardcoded fallback instead of showing error
        console.error('[useWateringAdvice] API call failed:', apiError);
        usedFallback = true;

        const fallback = getFallbackAdvice(plant.type);

        const fallbackAdvice: PlantWateringAdvice = {
          text: fallback.advice,
          frequencyDays: fallback.frequencyDays,
          bestTime: fallback.bestTime,
          amount: fallback.amount,
          generatedAt: new Date(),
          season,
          location: locationText,
          isFallback: true,
        };

        try {
          await db.plants.update(plant.id, { wateringAdvice: fallbackAdvice });
        } catch (dbError) {
          console.error('Error saving fallback advice:', dbError);
        }

        setAdvice(fallbackAdvice);
        setIsFallback(true);
        setStatus('success');
      }

      // This block is only reached if both API AND fallback save fail
      if (!usedFallback && status === 'error') {
        setErrorMessage('No se pudieron generar consejos. Intenta de nuevo.');
      }
    },
    [plant, settings, getLocationText, status],
  );

  /**
   * Auto-fetch on mount: if the plant has no saved advice, fetch it.
   *
   * useEffect DEPENDENCY ARRAY:
   * We depend on plant?.id (not the entire plant object) because
   * we only want to re-run when we navigate to a DIFFERENT plant.
   * The plant?.wateringAdvice check inside fetchAndSave handles
   * whether the current plant needs new advice.
   */
  useEffect(() => {
    if (!plant || !settings) return;

    // Prevent double-fetch in React StrictMode
    if (hasFetched.current) return;
    hasFetched.current = true;

    fetchAndSave(false);
  }, [plant?.id, settings?.location.country]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Regenerate advice: force a new API call, ignoring saved data.
   * Called when the user clicks the "Regenerar consejos" button.
   */
  const regenerate = useCallback(async (): Promise<void> => {
    hasFetched.current = true; // Prevent useEffect from interfering
    await fetchAndSave(true);
  }, [fetchAndSave]);

  return {
    status,
    advice,
    isFallback,
    errorMessage,
    regenerate,
  };
}
