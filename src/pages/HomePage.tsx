import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sprout, Plus, Loader, MapPin } from 'lucide-react';
import { usePlants } from '@/hooks/usePlants';
import { useUserSettings } from '@/hooks/useUserSettings';
import { getWateringUrgency } from '@/utils/watering';
import PlantCard from '@/components/plants/PlantCard';
import EmptyState from '@/components/common/EmptyState';
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
 *    usePlants() gives us { plants, isLoading }. The component
 *    doesn't know or care HOW the data is fetched. It just renders it.
 *
 * 3. LIST RENDERING:
 *    plants.map() creates one PlantCard per plant.
 *    The `key` prop is crucial - React uses it to efficiently
 *    update only the cards that changed instead of re-rendering all.
 *
 * 4. SORTED BY URGENCY:
 *    Plants are sorted so urgent ones (needing water) appear first.
 *    useMemo prevents re-sorting on every render.
 */

const HomePage: React.FC = () => {
  const { plants, isLoading } = usePlants();
  const { settings } = useUserSettings();
  const navigate = useNavigate();

  const handleAddPlant = (): void => {
    navigate('/add');
  };

  // Sort plants by urgency: urgent first, then warning, then ok
  const sortedPlants = useMemo(() => {
    const urgencyOrder = { urgent: 0, warning: 1, ok: 2 };
    return [...plants].sort(
      (a, b) => urgencyOrder[getWateringUrgency(a)] - urgencyOrder[getWateringUrgency(b)]
    );
  }, [plants]);

  // Loading state: show while Dexie reads from IndexedDB
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader size={32} className={styles.spinner} />
        <p>Cargando tu jardín...</p>
      </div>
    );
  }

  // Empty state: no plants yet
  if (plants.length === 0) {
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
          {plants.length} {plants.length === 1 ? 'planta' : 'plantas'}
        </p>
      </header>

      {/* Plant grid - sorted by urgency */}
      <div className={styles.grid}>
        {sortedPlants.map((plant) => (
          <PlantCard key={plant.id} plant={plant} />
        ))}
      </div>

      {/* Floating Action Button (FAB) - common mobile pattern */}
      <button
        type="button"
        className={styles.fab}
        onClick={handleAddPlant}
        aria-label="Agregar planta"
      >
        <Plus size={28} />
      </button>
    </div>
  );
};

export default HomePage;
