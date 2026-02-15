import { useLiveQuery } from 'dexie-react-hooks';
import { startOfDay, subDays } from 'date-fns';
import { db } from '@/db/database';
import type { WateringLog } from '@/types';

/**
 * useWateringHistory - Hook to read the last 7 days of watering logs.
 *
 * WHY A SEPARATE HOOK?
 * Following the "one domain per hook" pattern:
 *   - usePlantDetail → reads plant data
 *   - useMarkWatered → writes watering events
 *   - useWateringHistory → reads watering history
 *
 * DEXIE QUERY:
 * Filters wateringLogs by plantId (uses index) then by date range
 * (JavaScript filter on the reduced set). The wateringLogs table
 * has indexes on both 'plantId' and 'wateredAt'.
 *
 * LIVE QUERY:
 * useLiveQuery auto-updates when new watering logs are added.
 * When useMarkWatered writes a new log, this query re-runs and
 * the calendar instantly shows the green checkmark.
 */

export interface UseWateringHistoryResult {
  /** Watering logs from the last 7 days, or undefined while loading */
  recentLogs: WateringLog[] | undefined;
  /** true while the initial query is resolving */
  isLoading: boolean;
}

export function useWateringHistory(
  plantId: string | undefined,
): UseWateringHistoryResult {
  const cutoffDate: Date = startOfDay(subDays(new Date(), 6));

  const recentLogs = useLiveQuery(
    (): Promise<WateringLog[]> => {
      if (!plantId) return Promise.resolve([]);

      return db.wateringLogs
        .where('plantId')
        .equals(plantId)
        .filter((log: WateringLog) => log.wateredAt >= cutoffDate)
        .toArray();
    },
    [plantId],
  );

  return {
    recentLogs,
    isLoading: recentLogs === undefined,
  };
}
