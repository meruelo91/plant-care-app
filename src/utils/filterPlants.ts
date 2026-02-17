/**
 * Plant filtering and sorting utilities.
 *
 * All functions here are PURE:
 *   - No side effects (no database writes, no state changes)
 *   - Same input always produces same output
 *   - Easy to test and compose
 *
 * These functions are designed to work together via applyFilters(),
 * which combines search, filters, and sorting in a single pass.
 */

import type {
  Plant,
  PlantFilterOptions,
  WateringStatusFilter,
  PlantSortOption,
} from '@/types';
import { getWateringUrgency, calculateNextWatering, getDaysUntilWatering } from './watering';

// ─── Search ───

/**
 * Search plants by text query.
 *
 * Searches across multiple fields (nickname, species, type) for a
 * case-insensitive match. Returns all plants if query is empty.
 *
 * @param plants - Array of plants to search
 * @param searchTerm - Search query (can be empty)
 * @returns Filtered array of matching plants
 *
 * @example
 * searchPlants(plants, "cactus")
 * // → Plants with "cactus" in nickname, species, or type
 */
export function searchPlants(plants: Plant[], searchTerm: string): Plant[] {
  const trimmed = searchTerm.trim().toLowerCase();

  // Empty search = show all
  if (!trimmed) return plants;

  return plants.filter((plant) => {
    const nickname = plant.nickname?.toLowerCase() ?? '';
    const species = plant.species.toLowerCase();
    const type = plant.type.toLowerCase();

    // Match any field
    return (
      nickname.includes(trimmed) ||
      species.includes(trimmed) ||
      type.includes(trimmed)
    );
  });
}

// ─── Watering Status Filter ───

/**
 * Filter plants by watering status.
 *
 * Maps the WateringStatusFilter enum to getWateringUrgency() results.
 * 'no_data' is a special case: plants that have never been watered.
 *
 * @param plants - Array of plants to filter
 * @param status - Which watering status to filter by
 * @returns Filtered array of plants matching the status
 */
export function filterByWateringStatus(
  plants: Plant[],
  status: WateringStatusFilter
): Plant[] {
  // 'all' = no filtering
  if (status === 'all') return plants;

  return plants.filter((plant) => {
    // 'no_data' = never watered
    if (status === 'no_data') {
      return plant.lastWatered === null;
    }

    const urgency = getWateringUrgency(plant);

    switch (status) {
      case 'needs_water':
        // Both 'urgent' and 'warning' need water soon
        return urgency === 'urgent' || urgency === 'warning';
      case 'ok':
        return urgency === 'ok';
      default:
        return true;
    }
  });
}

// ─── Plant Type Filter ───

/**
 * Filter plants by their type (e.g., "Cactus", "Suculenta").
 *
 * @param plants - Array of plants to filter
 * @param plantType - Type to filter by, or null for all types
 * @returns Filtered array of plants matching the type
 */
export function filterByType(plants: Plant[], plantType: string | null): Plant[] {
  // null = show all types
  if (plantType === null) return plants;

  return plants.filter((plant) => plant.type === plantType);
}

// ─── Sorting ───

/**
 * Get display name for a plant (nickname or species).
 * Used for alphabetical sorting.
 */
function getDisplayName(plant: Plant): string {
  return plant.nickname || plant.species;
}

/**
 * Sort plants by the selected criteria.
 *
 * @param plants - Array of plants to sort (NOT mutated)
 * @param sortBy - Sorting criteria
 * @returns New sorted array
 */
export function sortPlants(plants: Plant[], sortBy: PlantSortOption): Plant[] {
  // Create a copy to avoid mutating the original
  const sorted = [...plants];

  switch (sortBy) {
    case 'next_watering':
      // Sort by urgency (most urgent first)
      // Plants without data go first (need attention)
      return sorted.sort((a, b) => {
        const urgencyOrder = { urgent: 0, warning: 1, ok: 2 };
        const urgencyA = getWateringUrgency(a);
        const urgencyB = getWateringUrgency(b);

        // First compare by urgency level
        const urgencyDiff = urgencyOrder[urgencyA] - urgencyOrder[urgencyB];
        if (urgencyDiff !== 0) return urgencyDiff;

        // If same urgency, sort by days until watering (ascending)
        const freqA = a.wateringAdvice?.frequencyDays ?? 7;
        const freqB = b.wateringAdvice?.frequencyDays ?? 7;
        const nextA = calculateNextWatering(a.lastWatered, freqA);
        const nextB = calculateNextWatering(b.lastWatered, freqB);
        const daysA = getDaysUntilWatering(nextA) ?? -999;
        const daysB = getDaysUntilWatering(nextB) ?? -999;

        return daysA - daysB;
      });

    case 'alphabetical':
      // A-Z by display name
      return sorted.sort((a, b) =>
        getDisplayName(a).localeCompare(getDisplayName(b), 'es')
      );

    case 'newest':
      // Most recently added first
      return sorted.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    case 'last_watered':
      // Most recently watered first
      // Never-watered plants go to the end
      return sorted.sort((a, b) => {
        if (!a.lastWatered && !b.lastWatered) return 0;
        if (!a.lastWatered) return 1;
        if (!b.lastWatered) return -1;
        return new Date(b.lastWatered).getTime() - new Date(a.lastWatered).getTime();
      });

    default:
      return sorted;
  }
}

// ─── Combined Filter + Sort ───

/**
 * Apply all filters and sorting in a single pass.
 *
 * This is the main entry point for filtering the plant list.
 * It applies operations in order:
 *   1. Search by text
 *   2. Filter by watering status
 *   3. Filter by plant type
 *   4. Sort by selected criteria
 *
 * @param plants - Full array of plants
 * @param options - Filter and sort options
 * @returns Filtered and sorted array
 *
 * @example
 * const filtered = applyFilters(allPlants, {
 *   searchTerm: 'aloe',
 *   wateringStatus: 'needs_water',
 *   plantType: 'Suculenta',
 *   sortBy: 'next_watering',
 * });
 */
export function applyFilters(
  plants: Plant[],
  options: PlantFilterOptions
): Plant[] {
  let result = plants;

  // Step 1: Search
  result = searchPlants(result, options.searchTerm);

  // Step 2: Filter by watering status
  result = filterByWateringStatus(result, options.wateringStatus);

  // Step 3: Filter by plant type
  result = filterByType(result, options.plantType);

  // Step 4: Sort
  result = sortPlants(result, options.sortBy);

  return result;
}

// ─── Default Filter Options ───

/**
 * Default filter options (no filters applied, sorted by urgency).
 * Used as initial state and for "reset filters" functionality.
 */
export const DEFAULT_FILTER_OPTIONS: PlantFilterOptions = {
  searchTerm: '',
  wateringStatus: 'all',
  plantType: null,
  sortBy: 'next_watering',
};
