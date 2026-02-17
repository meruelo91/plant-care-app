import { useNavigate } from 'react-router-dom';
import { Sprout, Plus, Loader, MapPin, SlidersHorizontal, SearchX } from 'lucide-react';
import { useFilteredPlants } from '@/hooks/useFilteredPlants';
import { useUserSettings } from '@/hooks/useUserSettings';
import PlantCard from '@/components/plants/PlantCard';
import EmptyState from '@/components/common/EmptyState';
import SearchBar from '@/components/common/SearchBar';
import FilterChips from '@/components/common/FilterChips';
import FilterPanel from '@/components/plants/FilterPanel';
import styles from './HomePage.module.css';

/**
 * HomePage - "Mis Plantas" screen.
 *
 * This page demonstrates several important React patterns:
 *
 * 1. CONDITIONAL RENDERING:
 *    Based on the data state (loading / empty / has plants),
 *    we show different UI. This is done with if/return statements.
 *
 * 2. CUSTOM HOOK USAGE:
 *    useFilteredPlants() gives us plants + filtering/sorting.
 *    The component doesn't know HOW filtering works. It just renders.
 *
 * 3. LIST RENDERING:
 *    plants.map() creates one PlantCard per plant.
 *    The `key` prop is crucial - React uses it to efficiently
 *    update only the cards that changed instead of re-rendering all.
 *
 * 4. SEARCH & FILTER:
 *    SearchBar for text search (debounced 300ms)
 *    FilterPanel (bottom drawer) for filters and sorting
 *    FilterChips show active filters as removable pills
 */

const HomePage: React.FC = () => {
  const {
    filteredPlants,
    isLoading,
    totalCount,
    filteredCount,
    filterOptions,
    activeFilters,
    isFilterPanelOpen,
    openFilterPanel,
    closeFilterPanel,
    setSearchTerm,
    setWateringStatus,
    setPlantType,
    setSortBy,
    clearFilters,
    removeFilter,
    availablePlantTypes,
  } = useFilteredPlants();

  const { settings } = useUserSettings();
  const navigate = useNavigate();

  const handleAddPlant = (): void => {
    navigate('/add');
  };

  // Loading state: show while Dexie reads from IndexedDB
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader size={32} className={styles.spinner} />
        <p>Cargando tu jardín...</p>
      </div>
    );
  }

  // Empty state: no plants at all
  if (totalCount === 0) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon={<Sprout size={80} />}
          title="Empieza tu jardín digital"
          message="Añade tu primera planta y nunca olvides regarla"
          actionLabel="🌱 Añadir mi primera planta"
          onAction={handleAddPlant}
        />
      </div>
    );
  }

  // Check if filters are active (excluding sort)
  const hasActiveFilters =
    filterOptions.searchTerm !== '' ||
    filterOptions.wateringStatus !== 'all' ||
    filterOptions.plantType !== null;

  // Success state: plants exist
  return (
    <div className={styles.page}>
      {/* Header - vertical layout for better readability */}
      <header className={styles.header}>
        <h1 className={styles.title}>🌱 Mis Plantas</h1>
        {settings?.location?.city && (
          <div className={styles.locationBadge}>
            <MapPin size={14} />
            <span>{settings.location.city}</span>
          </div>
        )}
        <p className={styles.plantCount}>
          {totalCount} {totalCount === 1 ? 'planta' : 'plantas'}
        </p>
      </header>

      {/* Search & Filter Row */}
      <div className={styles.searchRow}>
        <SearchBar
          value={filterOptions.searchTerm}
          onChange={setSearchTerm}
        />
        <button
          type="button"
          className={styles.filterButton}
          onClick={openFilterPanel}
          aria-label="Filtrar y ordenar"
        >
          <SlidersHorizontal size={20} />
          {activeFilters.count > 0 && (
            <span className={styles.filterBadge}>{activeFilters.count}</span>
          )}
        </button>
      </div>

      {/* Active Filter Chips */}
      <FilterChips chips={activeFilters.chips} onRemove={removeFilter} />

      {/* Results count when filtered */}
      {hasActiveFilters && filteredCount !== totalCount && (
        <p className={styles.resultsCount}>
          Mostrando {filteredCount} de {totalCount} plantas
        </p>
      )}

      {/* Plant grid or no results */}
      {filteredCount > 0 ? (
        <div className={styles.grid}>
          {filteredPlants.map((plant) => (
            <PlantCard key={plant.id} plant={plant} />
          ))}
        </div>
      ) : (
        <div className={styles.noResults}>
          <SearchX size={48} className={styles.noResultsIcon} />
          <p className={styles.noResultsTitle}>No se encontraron plantas</p>
          <p className={styles.noResultsMessage}>
            Prueba con otros términos de búsqueda o filtros
          </p>
          <button
            type="button"
            className={styles.clearFiltersButton}
            onClick={clearFilters}
          >
            Limpiar filtros
          </button>
        </div>
      )}

      {/* Floating Action Button (FAB) - common mobile pattern */}
      <button
        type="button"
        className={styles.fab}
        onClick={handleAddPlant}
        aria-label="Agregar planta"
      >
        <Plus size={28} />
      </button>

      {/* Filter Panel (bottom drawer) */}
      <FilterPanel
        isOpen={isFilterPanelOpen}
        onClose={closeFilterPanel}
        wateringStatus={filterOptions.wateringStatus}
        plantType={filterOptions.plantType}
        sortBy={filterOptions.sortBy}
        setWateringStatus={setWateringStatus}
        setPlantType={setPlantType}
        setSortBy={setSortBy}
        clearFilters={clearFilters}
        availablePlantTypes={availablePlantTypes}
      />
    </div>
  );
};

export default HomePage;
