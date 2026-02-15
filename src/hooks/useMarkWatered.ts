import { useState, useCallback, useRef, useEffect } from 'react';
import { isToday } from 'date-fns';
import { db } from '@/db/database';
import { generateId } from '@/utils/generateId';

/**
 * useMarkWatered - Hook for marking a plant as watered.
 *
 * WHAT IT DOES:
 * Provides a single action (markAsWatered) that atomically:
 *   1. Creates a WateringLog entry (historical record)
 *   2. Updates plant.lastWatered to now
 *
 * WHY A SEPARATE HOOK?
 * Following the existing pattern: each hook has one domain.
 *   - usePlantDetail → read + delete
 *   - useWateringAdvice → AI advice
 *   - useMarkWatered → watering action
 * This keeps each hook focused and testable.
 *
 * REACTIVITY:
 * After the DB write, useLiveQuery in usePlantDetail detects the change
 * and re-renders the page. This means `alreadyWateredToday` automatically
 * becomes true without us manually syncing state — Dexie handles it.
 *
 * CELEBRATION ANIMATION:
 * `wasJustWatered` goes true for 2.5 seconds after watering, then
 * auto-resets. The page uses this to show a brief emoji animation.
 * The timeout is cleaned up on unmount to prevent memory leaks.
 */

/** Duration of the celebration animation (ms) */
const CELEBRATION_DURATION_MS = 2500;

export interface UseMarkWateredResult {
  /** Call to record a watering event */
  markAsWatered: () => Promise<void>;
  /** true while the DB write is in progress */
  isMarking: boolean;
  /** true for ~2.5 seconds after a successful watering (drives celebration) */
  wasJustWatered: boolean;
  /** true if the plant was already watered today (disables the button) */
  alreadyWateredToday: boolean;
}

export function useMarkWatered(
  plantId: string | undefined,
  lastWatered: Date | null,
): UseMarkWateredResult {
  const [isMarking, setIsMarking] = useState<boolean>(false);
  const [wasJustWatered, setWasJustWatered] = useState<boolean>(false);

  // Ref for the celebration timeout so we can clean it up on unmount
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up timeout on unmount (prevents setState on unmounted component)
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Derived value: was the plant watered today?
  // Uses date-fns isToday() which compares in the local timezone.
  const alreadyWateredToday: boolean =
    lastWatered !== null && isToday(lastWatered);

  /**
   * Mark the plant as watered: create a log entry + update lastWatered.
   *
   * DEXIE TRANSACTION:
   * We use db.transaction('rw', ...) to ensure both writes succeed or
   * both fail. Without a transaction, we could end up with a log entry
   * but no lastWatered update (or vice versa), leaving the data
   * inconsistent.
   *
   * GUARD CLAUSES:
   * - No plantId → nothing to water
   * - Already marking → prevents double-tap on mobile
   * - Already watered today → button should be disabled anyway
   */
  const markAsWatered = useCallback(async (): Promise<void> => {
    if (!plantId || isMarking || alreadyWateredToday) return;

    setIsMarking(true);
    const now = new Date();

    try {
      await db.transaction('rw', db.plants, db.wateringLogs, async () => {
        // 1. Create historical watering record
        await db.wateringLogs.add({
          id: generateId(),
          plantId,
          wateredAt: now,
        });

        // 2. Update the plant's lastWatered timestamp
        await db.plants.update(plantId, { lastWatered: now });
      });

      // Trigger celebration animation
      setWasJustWatered(true);
      timeoutRef.current = setTimeout(() => {
        setWasJustWatered(false);
      }, CELEBRATION_DURATION_MS);
    } catch (error) {
      console.error('[useMarkWatered] Error marking plant as watered:', error);
    } finally {
      setIsMarking(false);
    }
  }, [plantId, isMarking, alreadyWateredToday]);

  return {
    markAsWatered,
    isMarking,
    wasJustWatered,
    alreadyWateredToday,
  };
}
