import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import type { Plant } from '@/types';

/**
 * CUSTOM HOOK: usePlants
 *
 * What is a custom hook?
 * A function that starts with "use" and can use other React hooks inside.
 * We use them to separate DATA LOGIC from VISUAL LOGIC:
 *   - This hook handles: "where do plants come from?" (IndexedDB)
 *   - The component handles: "how do plants look?" (JSX/CSS)
 *
 * Why not just query Dexie directly in the component?
 *   - Reusability: multiple components can use the same hook
 *   - Testability: easier to test logic separately from UI
 *   - Clean code: components stay focused on rendering
 *
 * How useLiveQuery works:
 *   - It's Dexie's reactive hook (like useState, but for the database)
 *   - The function you pass is a "querier" that reads from IndexedDB
 *   - If ANY data in the queried table changes, the hook re-runs automatically
 *   - Returns `undefined` while the first query is loading
 *   - After loading, returns the actual data (could be an empty array)
 */

interface UsePlantsResult {
  plants: Plant[];
  isLoading: boolean;
}

export function usePlants(): UsePlantsResult {
  // useLiveQuery returns:
  //   - undefined: still loading (first render, database not read yet)
  //   - Plant[]: loaded (could be empty array if no plants exist)
  //
  // orderBy('createdAt').reverse() = newest plants first
  const result = useLiveQuery(
    () => db.plants.orderBy('createdAt').reverse().toArray()
  );

  return {
    plants: result ?? [], // if undefined (loading), use empty array
    isLoading: result === undefined,
  };
}
