import { useState, useMemo, useCallback, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { applyFilters, DEFAULT_FILTER_OPTIONS } from '@/utils/filterPlants';
import { PLANT_TYPES } from './useAddPlant';
import type {
  Plant,
  PlantFilterOptions,
  WateringStatusFilter,
  PlantSortOption,
  ActiveFilters,
  FilterChipData,
} from '@/types';

/**
 * useFilteredPlants - Custom hook for search and filter functionality.
 *
 * FEATURES:
 *   - Real-time search with debounce (300ms)
 *   - Filter by watering status (needs water, ok, no data)
 *   - Filter by plant type
 *   - Sort by various criteria
 *   - Persistence of filters in localStorage (not search term)
 *   - Track active filters for UI (badge count, chips)
 *
 * PERFORMANCE:
 *   - useMemo for expensive filtering operations
 *   - Debounce prevents re-filtering on every keystroke
 *   - Filters run client-side (no IndexedDB queries per filter change)
 *
 * PATTERN:
 *   - Returns both data (filteredPlants) and actions (setters)
 *   - Similar to usePlants but with filter state layered on top
 */

// ─── LocalStorage Key ───
const STORAGE_KEY = 'plant-pwa-filters';

// ─── Labels for UI ───

const WATERING_STATUS_LABELS: Record<WateringStatusFilter, string> = {
  all: 'Todas',
  needs_water: 'Necesitan agua',
  ok: 'Al día',
  no_data: 'Sin datos',
};

const SORT_LABELS: Record<PlantSortOption, string> = {
  next_watering: 'Próximo riego',
  alphabetical: 'A-Z',
  newest: 'Más reciente',
  last_watered: 'Última regada',
};

// ─── Types ───

interface UseFilteredPlantsResult {
  // Data
  plants: Plant[];           // All plants (unfiltered)
  filteredPlants: Plant[];   // After search/filter/sort
  isLoading: boolean;

  // Counts
  totalCount: number;        // Total plants
  filteredCount: number;     // After filters

  // Filter state
  filterOptions: PlantFilterOptions;
  debouncedSearchTerm: string; // The actual search term being used

  // Active filters summary (for badge and chips)
  activeFilters: ActiveFilters;

  // Panel state
  isFilterPanelOpen: boolean;
  openFilterPanel: () => void;
  closeFilterPanel: () => void;

  // Actions
  setSearchTerm: (term: string) => void;
  setWateringStatus: (status: WateringStatusFilter) => void;
  setPlantType: (type: string | null) => void;
  setSortBy: (sortBy: PlantSortOption) => void;
  clearFilters: () => void;
  removeFilter: (key: string) => void;

  // Available filter options (for the panel)
  availablePlantTypes: readonly string[];
}

// ─── Helpers ───

/**
 * Load filters from localStorage.
 * Returns default options if nothing is stored or on error.
 */
function loadFiltersFromStorage(): Omit<PlantFilterOptions, 'searchTerm'> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_FILTER_OPTIONS;

    const parsed = JSON.parse(stored) as Partial<PlantFilterOptions>;

    return {
      wateringStatus: parsed.wateringStatus ?? DEFAULT_FILTER_OPTIONS.wateringStatus,
      plantType: parsed.plantType ?? DEFAULT_FILTER_OPTIONS.plantType,
      sortBy: parsed.sortBy ?? DEFAULT_FILTER_OPTIONS.sortBy,
    };
  } catch {
    return DEFAULT_FILTER_OPTIONS;
  }
}

/**
 * Save filters to localStorage (excludes searchTerm).
 */
function saveFiltersToStorage(options: PlantFilterOptions): void {
  try {
    const toStore = {
      wateringStatus: options.wateringStatus,
      plantType: options.plantType,
      sortBy: options.sortBy,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore));
  } catch {
    // Silently fail - localStorage might be full or disabled
  }
}

/**
 * Build the active filters summary for UI.
 */
function buildActiveFilters(options: PlantFilterOptions): ActiveFilters {
  const chips: FilterChipData[] = [];

  // Watering status filter
  if (options.wateringStatus !== 'all') {
    chips.push({
      key: 'wateringStatus',
      label: WATERING_STATUS_LABELS[options.wateringStatus],
    });
  }

  // Plant type filter
  if (options.plantType !== null) {
    chips.push({
      key: 'plantType',
      label: options.plantType,
    });
  }

  // Sort (only show if not default)
  if (options.sortBy !== 'next_watering') {
    chips.push({
      key: 'sortBy',
      label: `Orden: ${SORT_LABELS[options.sortBy]}`,
    });
  }

  return {
    count: chips.length,
    chips,
  };
}

// ─── Debounce Hook ───

/**
 * Simple debounce hook.
 * Returns the value after it hasn't changed for `delay` ms.
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ─── Main Hook ───

export function useFilteredPlants(): UseFilteredPlantsResult {
  // ─── Database Query ───
  const result = useLiveQuery(
    () => db.plants.orderBy('createdAt').reverse().toArray()
  );

  const plants = result ?? [];
  const isLoading = result === undefined;

  // ─── Filter State ───
  // Initialize from localStorage (except searchTerm which starts empty)
  const [filterOptions, setFilterOptions] = useState<PlantFilterOptions>(() => ({
    ...loadFiltersFromStorage(),
    searchTerm: '', // Always start empty
  }));

  // ─── Panel State ───
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState<boolean>(false);

  // ─── Debounced Search ───
  const debouncedSearchTerm = useDebounce(filterOptions.searchTerm, 300);

  // ─── Persist to localStorage when filters change ───
  useEffect(() => {
    saveFiltersToStorage(filterOptions);
  }, [filterOptions.wateringStatus, filterOptions.plantType, filterOptions.sortBy]);

  // ─── Apply Filters (Memoized) ───
  const filteredPlants = useMemo(() => {
    return applyFilters(plants, {
      ...filterOptions,
      searchTerm: debouncedSearchTerm, // Use debounced value
    });
  }, [plants, filterOptions.wateringStatus, filterOptions.plantType, filterOptions.sortBy, debouncedSearchTerm]);

  // ─── Active Filters Summary ───
  const activeFilters = useMemo(
    () => buildActiveFilters(filterOptions),
    [filterOptions]
  );

  // ─── Actions ───

  const setSearchTerm = useCallback((term: string) => {
    setFilterOptions((prev) => ({ ...prev, searchTerm: term }));
  }, []);

  const setWateringStatus = useCallback((status: WateringStatusFilter) => {
    setFilterOptions((prev) => ({ ...prev, wateringStatus: status }));
  }, []);

  const setPlantType = useCallback((type: string | null) => {
    setFilterOptions((prev) => ({ ...prev, plantType: type }));
  }, []);

  const setSortBy = useCallback((sortBy: PlantSortOption) => {
    setFilterOptions((prev) => ({ ...prev, sortBy: sortBy }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilterOptions({
      ...DEFAULT_FILTER_OPTIONS,
      searchTerm: '', // Keep search empty too
    });
  }, []);

  const removeFilter = useCallback((key: string) => {
    setFilterOptions((prev) => {
      switch (key) {
        case 'wateringStatus':
          return { ...prev, wateringStatus: 'all' };
        case 'plantType':
          return { ...prev, plantType: null };
        case 'sortBy':
          return { ...prev, sortBy: 'next_watering' };
        default:
          return prev;
      }
    });
  }, []);

  const openFilterPanel = useCallback(() => {
    setIsFilterPanelOpen(true);
  }, []);

  const closeFilterPanel = useCallback(() => {
    setIsFilterPanelOpen(false);
  }, []);

  return {
    // Data
    plants,
    filteredPlants,
    isLoading,

    // Counts
    totalCount: plants.length,
    filteredCount: filteredPlants.length,

    // Filter state
    filterOptions,
    debouncedSearchTerm,

    // Active filters
    activeFilters,

    // Panel state
    isFilterPanelOpen,
    openFilterPanel,
    closeFilterPanel,

    // Actions
    setSearchTerm,
    setWateringStatus,
    setPlantType,
    setSortBy,
    clearFilters,
    removeFilter,

    // Available options
    availablePlantTypes: PLANT_TYPES,
  };
}

// ─── Export Labels for UI Components ───
export { WATERING_STATUS_LABELS, SORT_LABELS };
