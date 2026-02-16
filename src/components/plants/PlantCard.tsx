import { useNavigate } from 'react-router-dom';
import { Flower2, Droplets } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { Plant } from '@/types';
import { getWateringUrgency, type UrgencyLevel } from '@/utils/watering';
import styles from './PlantCard.module.css';

/**
 * PlantCard - Visual card for a single plant.
 *
 * COMPONENT RESPONSIBILITY:
 * This component only handles "how a plant looks" in the list.
 * It receives ALL data via props (the Plant object) and doesn't
 * query the database itself. This is called a "presentational component".
 *
 * URGENCY-BASED STYLING:
 * Uses getWateringUrgency() to determine the visual state:
 *   - 'urgent': Red pulsing badge, red border on card
 *   - 'warning': Orange badge
 *   - 'ok': Green subtle badge
 *
 * NAVIGATION:
 * useNavigate() is React Router's hook for programmatic navigation.
 * Unlike <Link>, it lets us navigate from any event handler.
 * We use it here because the entire card is clickable, not just text.
 */

interface PlantCardProps {
  plant: Plant;
}

/**
 * Get the badge text based on urgency level.
 */
function getBadgeText(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'urgent':
      return '💧 Necesita agua';
    case 'warning':
      return '⏰ Pronto';
    case 'ok':
      return '✓ Bien';
  }
}

/**
 * Get the CSS class name for the badge based on urgency.
 */
function getBadgeClass(urgency: UrgencyLevel): string {
  switch (urgency) {
    case 'urgent':
      return styles.badgeUrgent;
    case 'warning':
      return styles.badgeWarning;
    case 'ok':
      return styles.badgeOk;
  }
}

const PlantCard: React.FC<PlantCardProps> = ({ plant }) => {
  const navigate = useNavigate();

  // Calculate urgency level using the shared utility
  const urgency = getWateringUrgency(plant);

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

  // Build card class: add urgent border if needed
  const cardClass = urgency === 'urgent'
    ? `${styles.card} ${styles.cardUrgent}`
    : styles.card;

  return (
    <article
      className={cardClass}
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

        {/* Watering status badge - always shown with urgency color */}
        <span className={`${styles.waterBadge} ${getBadgeClass(urgency)}`}>
          {getBadgeText(urgency)}
        </span>
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
