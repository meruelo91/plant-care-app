import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Plant } from '@/types';

/**
 * usePlantDetail - Hook to read a single plant by ID and delete it.
 *
 * DIFFERENCE FROM usePlants:
 *   usePlants  → db.plants.toArray()  → reads ALL plants
 *   usePlantDetail → db.plants.get(id) → reads ONE plant by primary key
 *
 * DEPENDENCY ARRAY in useLiveQuery:
 * The second argument [id] tells Dexie to re-run the query whenever
 * the id value changes. This happens when the user navigates from
 * one plant detail page to another (e.g., via browser back/forward).
 * Without this, the query would only run once with the initial id.
 *
 * LOADING vs NOT FOUND:
 * Both return `plant === undefined`, but the difference is timing:
 *   - Loading: useLiveQuery hasn't resolved yet (isLoading = true)
 *   - Not found: useLiveQuery resolved but no plant with that id exists
 * We track this with a separate `isLoading` flag using the same
 * pattern as usePlants: result === undefined means still loading.
 */

interface UsePlantDetailResult {
  plant: Plant | undefined;
  isLoading: boolean;
  isNotFound: boolean;
  deletePlant: () => Promise<void>;
}

export function usePlantDetail(id: string | undefined): UsePlantDetailResult {
  const navigate = useNavigate();

  // useLiveQuery returns undefined while loading, then the actual value after.
  // Problem: if the plant doesn't exist, the query also returns undefined.
  // How to distinguish "loading" from "not found"?
  //
  // TRICK: We map "not found" to null inside the query.
  // So: undefined = still loading, null = query ran but no plant found.
  // This lets us show a spinner during loading and "not found" after.
  const rawResult = useLiveQuery(
    () => (id ? db.plants.get(id).then((p) => p ?? null) : null),
    [id],
  );

  const isLoading = rawResult === undefined;
  const plant = rawResult ?? undefined;
  const isNotFound = !isLoading && !plant;

  /**
   * Delete the plant and all its associated watering logs.
   *
   * WHY delete watering logs too?
   * If we only delete the plant, orphan watering logs would remain
   * in IndexedDB forever, wasting storage. This is called "cascading
   * delete" - when the parent record is removed, related records
   * go with it. Relational databases do this automatically, but
   * IndexedDB doesn't, so we handle it manually.
   *
   * useCallback:
   * Wraps the function so React doesn't recreate it on every render.
   * This is a performance optimization - components that receive
   * deletePlant as a prop won't re-render unnecessarily.
   */
  const deletePlant = useCallback(async (): Promise<void> => {
    if (!id) return;

    try {
      // Delete watering logs first (child records), then the plant
      await db.wateringLogs.where('plantId').equals(id).delete();
      await db.plants.delete(id);

      navigate('/');
    } catch (error) {
      console.error('Error deleting plant:', error);
    }
  }, [id, navigate]);

  return {
    plant,
    isLoading,
    isNotFound,
    deletePlant,
  };
}
