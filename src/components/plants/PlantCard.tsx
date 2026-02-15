import { useNavigate } from 'react-router-dom';
import { Flower2, Droplets } from 'lucide-react';
import { formatDistanceToNow, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Plant } from '@/types';
import styles from './PlantCard.module.css';

/**
 * PlantCard - Visual card for a single plant.
 *
 * COMPONENT RESPONSIBILITY:
 * This component only handles "how a plant looks" in the list.
 * It receives ALL data via props (the Plant object) and doesn't
 * query the database itself. This is called a "presentational component".
 *
 * DATE CALCULATIONS with date-fns:
 * - formatDistanceToNow: "hace 3 dias", "hace 1 semana", etc.
 * - differenceInDays: exact number of days between two dates
 * We use the Spanish locale (es) so dates show in Spanish.
 *
 * NAVIGATION:
 * useNavigate() is React Router's hook for programmatic navigation.
 * Unlike <Link>, it lets us navigate from any event handler.
 * We use it here because the entire card is clickable, not just text.
 */

// How many days without water before showing the "needs water" alert
const DAYS_UNTIL_NEEDS_WATER = 7;

interface PlantCardProps {
  plant: Plant;
}

const PlantCard: React.FC<PlantCardProps> = ({ plant }) => {
  const navigate = useNavigate();

  // Calculate watering status
  const needsWater = plant.lastWatered === null
    || differenceInDays(new Date(), plant.lastWatered) > DAYS_UNTIL_NEEDS_WATER;

  // Format "last watered" as a human-readable string
  // formatDistanceToNow returns strings like "hace 3 dias" with Spanish locale
  const lastWateredText = plant.lastWatered
    ? formatDistanceToNow(plant.lastWatered, { locale: es, addSuffix: true })
    : 'Nunca regada';

  // Display name: use nickname if available, otherwise species
  const displayName = plant.nickname ?? plant.species;

  const handleClick = (): void => {
    navigate(`/plant/${plant.id}`);
  };

  return (
    <article
      className={styles.card}
      onClick={handleClick}
      // Keyboard accessibility: make the card focusable and activatable
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          handleClick();
        }
      }}
    >
      {/* Plant photo or placeholder */}
      <div className={styles.imageContainer}>
        {plant.photoURL ? (
          <img
            src={plant.photoURL}
            alt={displayName}
            className={styles.image}
          />
        ) : (
          <div className={styles.placeholder}>
            <Flower2 size={48} />
          </div>
        )}

        {/* "Needs water" badge - only shown when overdue */}
        {needsWater && (
          <span className={styles.waterBadge}>
            <Droplets size={14} />
            Necesita agua
          </span>
        )}
      </div>

      {/* Plant info */}
      <div className={styles.info}>
        <h3 className={styles.name}>{displayName}</h3>
        <p className={styles.species}>
          {plant.type} &middot; {plant.species}
        </p>
        <p className={styles.watered}>
          <Droplets size={14} />
          {lastWateredText}
        </p>
      </div>
    </article>
  );
};

export default PlantCard;
