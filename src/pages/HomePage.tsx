import { useNavigate } from 'react-router-dom';
import { Sprout, Plus, Loader } from 'lucide-react';
import { usePlants } from '@/hooks/usePlants';
import { seedMockPlants } from '@/db/seedData';
import PlantCard from '@/components/plants/PlantCard';
import EmptyState from '@/components/common/EmptyState';
import styles from './HomePage.module.css';

/**
 * HomePage - "Mi Jardin" screen.
 *
 * This page demonstrates three important React patterns:
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
 */

const HomePage: React.FC = () => {
  const { plants, isLoading } = usePlants();
  const navigate = useNavigate();

  const handleAddPlant = (): void => {
    navigate('/add');
  };

  const handleSeedData = async (): Promise<void> => {
    await seedMockPlants();
  };

  // Loading state: show while Dexie reads from IndexedDB
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <Loader size={32} className={styles.spinner} />
        <p>Cargando tu jardin...</p>
      </div>
    );
  }

  // Empty state: no plants yet
  if (plants.length === 0) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon={<Sprout size={64} />}
          title="Tu jardin esta vacio"
          message="Agrega tu primera planta y empieza a cuidar tu jardin."
          actionLabel="+ Agregar mi primera planta"
          onAction={handleAddPlant}
        />

        {/* Temporary button for development - remove in production */}
        <div className={styles.devTools}>
          <button
            type="button"
            className={styles.devButton}
            onClick={handleSeedData}
          >
            Cargar datos de prueba
          </button>
        </div>
      </div>
    );
  }

  // Success state: plants exist
  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Mi Jardin</h1>
          <p className={styles.subtitle}>
            {plants.length} {plants.length === 1 ? 'planta' : 'plantas'}
          </p>
        </div>
      </header>

      {/* Plant grid */}
      <div className={styles.grid}>
        {plants.map((plant) => (
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

      {/* Temporary button for development - remove in production */}
      <div className={styles.devTools}>
        <button
          type="button"
          className={styles.devButton}
          onClick={handleSeedData}
        >
          Cargar datos de prueba
        </button>
      </div>
    </div>
  );
};

export default HomePage;
