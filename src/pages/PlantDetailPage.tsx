import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Trash2,
  Flower2,
  Droplets,
  Leaf,
  Brain,
  CalendarDays,
  SearchX,
  Clock,
  RefreshCw,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePlantDetail } from '@/hooks/usePlantDetail';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useWateringAdvice } from '@/hooks/useWateringAdvice';
import { useMarkWatered } from '@/hooks/useMarkWatered';
import { useWateringHistory } from '@/hooks/useWateringHistory';
import { calculateNextWatering, getDaysUntilWatering } from '@/utils/watering';
import ConfirmModal from '@/components/common/ConfirmModal';
import WateringCalendar from '@/components/plants/WateringCalendar';
import styles from './PlantDetailPage.module.css';

/**
 * PlantDetailPage - Full-screen detail view for a single plant.
 *
 * PAGE STATES:
 * This page can be in one of three states:
 *   1. Loading — The database query hasn't resolved yet
 *   2. Not found — The query resolved but no plant has this ID
 *   3. Success — Plant data is available, show the full UI
 *
 * WHY three states?
 * If the user bookmarks /plant/abc123 and later deletes that plant,
 * visiting the bookmark should show "not found" instead of a blank page.
 * The loading state prevents a flash of "not found" while the DB loads.
 *
 * LAYOUT:
 * The page uses the "Hero + Content Sheet" pattern:
 *   - Top section: large photo with floating back/delete buttons
 *   - Bottom section: white card that overlaps the photo, containing
 *     plant info, watering status, and placeholder sections.
 *
 * DELETE FLOW:
 * Clicking the delete (trash) button doesn't immediately delete.
 * Instead, it opens a ConfirmModal asking the user to confirm.
 * This prevents accidental deletions - a critical UX pattern when
 * actions are destructive and irreversible.
 */

const PlantDetailPage: React.FC = () => {
  // Extract the plant ID from the URL (e.g., /plant/abc123 → id = "abc123")
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Custom hook: reads one plant from IndexedDB and provides a delete function
  const { plant, isLoading, isNotFound, deletePlant } = usePlantDetail(id);

  // User settings: needed for location data to send to Claude AI
  const { settings } = useUserSettings();

  // AI watering advice hook: auto-fetches, persists to DB, and provides regenerate
  const { status: adviceStatus, advice, isFallback, errorMessage: adviceError, regenerate } =
    useWateringAdvice(plant, settings);

  // Mark-as-watered hook: provides the action + state for the water button
  const { markAsWatered, isMarking, wasJustWatered, alreadyWateredToday } =
    useMarkWatered(plant?.id, plant?.lastWatered ?? null);

  // Watering history hook: reads last 7 days of logs for the calendar
  const { recentLogs } = useWateringHistory(plant?.id);

  // Local state for the delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

  // ─── Loading state ───
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>Cargando planta...</p>
      </div>
    );
  }

  // ─── Not found state ───
  if (isNotFound || !plant) {
    return (
      <div className={styles.notFoundContainer}>
        <SearchX size={64} className={styles.notFoundIcon} />
        <h2 className={styles.notFoundTitle}>Planta no encontrada</h2>
        <p className={styles.notFoundMessage}>
          Esta planta ya no existe o el enlace es incorrecto.
        </p>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => navigate('/')}
        >
          <ArrowLeft size={18} />
          Volver al jardín
        </button>
      </div>
    );
  }

  // ─── Success state ───

  // Display name: prefer nickname, fall back to species
  const displayName: string = plant.nickname ?? plant.species;

  // Format "last watered" as human-readable text
  const lastWateredText: string = plant.lastWatered
    ? formatDistanceToNow(plant.lastWatered, { locale: es, addSuffix: true })
    : 'Nunca regada';

  // ─── Next watering calculation ───
  // Only meaningful when we have both a last-watered date and AI advice
  const nextWateringDate: Date | null =
    plant.lastWatered && advice?.frequencyDays
      ? calculateNextWatering(plant.lastWatered, advice.frequencyDays)
      : null;

  const daysUntilWatering: number | null =
    nextWateringDate ? getDaysUntilWatering(nextWateringDate) : null;

  // Urgency level determines the color of the next-watering indicator
  type UrgencyLevel = 'ok' | 'soon' | 'today' | 'overdue';
  const urgencyLevel: UrgencyLevel = (() => {
    if (daysUntilWatering === null) return 'ok';
    if (daysUntilWatering < 0) return 'overdue';
    if (daysUntilWatering === 0) return 'today';
    if (daysUntilWatering <= 1) return 'soon';
    return 'ok';
  })();

  // Handle delete confirmation
  const handleDeleteConfirm = (): void => {
    setShowDeleteModal(false);
    deletePlant();
  };

  return (
    <div className={styles.page}>
      {/* ─── Hero Image Section ─── */}
      <div className={styles.heroContainer}>
        {plant.photoURL ? (
          <img
            src={plant.photoURL}
            alt={displayName}
            className={styles.heroImage}
          />
        ) : (
          <div className={styles.heroPlaceholder}>
            <Flower2 size={80} />
          </div>
        )}

        {/* Dark gradient overlay so buttons are visible on light photos */}
        <div className={styles.heroOverlay} />

        {/* Floating buttons: Back (left) and Delete (right) */}
        <div className={styles.floatingButtons}>
          <button
            type="button"
            className={styles.floatingButton}
            onClick={() => navigate('/')}
            aria-label="Volver al jardín"
          >
            <ArrowLeft size={20} />
          </button>
          <button
            type="button"
            className={`${styles.floatingButton} ${styles.deleteButton}`}
            onClick={() => setShowDeleteModal(true)}
            aria-label="Eliminar planta"
          >
            <Trash2 size={20} />
          </button>
        </div>
      </div>

      {/* ─── Content Card (overlaps hero with negative margin) ─── */}
      <div className={styles.contentCard}>
        {/* Plant info header */}
        <div className={styles.plantHeader}>
          <span className={styles.typeBadge}>
            <Leaf size={14} />
            {plant.type}
          </span>
          <h1 className={styles.plantName}>{displayName}</h1>
          {/* Show species separately if there's a nickname */}
          {plant.nickname && (
            <p className={styles.plantSpecies}>{plant.species}</p>
          )}
        </div>

        {/* ─── Watering Section ─── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Riego</h3>

          <div className={styles.wateringInfo}>
            <Droplets size={24} className={styles.wateringIcon} />
            <div>
              <span className={styles.wateringText}>{lastWateredText}</span>
              <span className={styles.wateringLabel}>Último riego</span>
            </div>
          </div>

          {/* ─── Next Watering Indicator ─── */}
          {nextWateringDate && daysUntilWatering !== null && (
            <div className={`${styles.nextWateringInfo} ${styles[`urgency-${urgencyLevel}`]}`}>
              <CalendarDays size={20} className={styles.nextWateringIcon} />
              <div>
                <span className={styles.nextWateringText}>
                  {urgencyLevel === 'overdue'
                    ? `Necesita agua (${Math.abs(daysUntilWatering)} ${Math.abs(daysUntilWatering) === 1 ? 'día' : 'días'} de retraso)`
                    : urgencyLevel === 'today'
                      ? 'Toca regar hoy'
                      : urgencyLevel === 'soon'
                        ? 'Regar mañana'
                        : `Próximo riego en ${daysUntilWatering} ${daysUntilWatering === 1 ? 'día' : 'días'}`
                  }
                </span>
                <span className={styles.nextWateringLabel}>Próximo riego</span>
              </div>
            </div>
          )}

          {/* ─── AI Advice ─── */}

          {/* Loading: auto-fetch in progress */}
          {adviceStatus === 'loading' && (
            <div className={styles.adviceLoading}>
              <div className={styles.adviceSpinner} />
              <span className={styles.adviceLoadingText}>
                Generando consejos de riego...
              </span>
            </div>
          )}

          {/* Error: very unlikely (fallback should catch most failures) */}
          {adviceStatus === 'error' && (
            <div className={styles.adviceError}>
              <AlertCircle size={20} />
              <span className={styles.adviceErrorText}>
                {adviceError ?? 'Error desconocido'}
              </span>
              <button
                type="button"
                className={styles.adviceRetryButton}
                onClick={regenerate}
              >
                <RefreshCw size={14} />
                Reintentar
              </button>
            </div>
          )}

          {/* Success: show persisted advice card + metadata + regenerate */}
          {adviceStatus === 'success' && advice && (
            <>
              <div className={styles.adviceCard}>
                <div className={styles.adviceHeader}>
                  <Brain size={18} className={styles.adviceHeaderIcon} />
                  <span className={styles.adviceHeaderTitle}>
                    Consejos de riego
                  </span>
                </div>

                <p className={styles.adviceText}>{advice.text}</p>

                <div className={styles.adviceDetails}>
                  <div className={styles.adviceDetailItem}>
                    <Droplets size={18} className={styles.adviceDetailIcon} />
                    <span className={styles.adviceDetailLabel}>Frecuencia</span>
                    <span className={styles.adviceDetailValue}>
                      Cada {advice.frequencyDays} días
                    </span>
                  </div>

                  <div className={styles.adviceDetailItem}>
                    <Clock size={18} className={styles.adviceDetailIcon} />
                    <span className={styles.adviceDetailLabel}>Mejor hora</span>
                    <span className={styles.adviceDetailValue}>
                      {advice.bestTime.charAt(0).toUpperCase() + advice.bestTime.slice(1)}
                    </span>
                  </div>

                  <div className={styles.adviceDetailItem}>
                    <Droplets size={18} className={styles.adviceDetailIcon} />
                    <span className={styles.adviceDetailLabel}>Cantidad</span>
                    <span className={styles.adviceDetailValue}>
                      {advice.amount.charAt(0).toUpperCase() + advice.amount.slice(1)}
                    </span>
                  </div>
                </div>

                {/* Metadata: when generated + context */}
                <div className={styles.adviceMetadata}>
                  <span>
                    Generado {formatDistanceToNow(advice.generatedAt, { locale: es, addSuffix: true })}
                  </span>
                  <span>
                    {advice.season} en {advice.location}
                  </span>
                </div>

                {/* Fallback badge if advice is generic */}
                {isFallback && (
                  <span className={styles.adviceFallbackBadge}>
                    <AlertCircle size={12} />
                    Consejo genérico — sin conexión a IA
                  </span>
                )}
              </div>

              {/* Regenerate button */}
              <button
                type="button"
                className={styles.regenerateButton}
                onClick={regenerate}
              >
                <RefreshCw size={14} />
                Regenerar consejos
              </button>
            </>
          )}
        </div>

        {/* ─── Watering History Calendar ─── */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Historial de Riego</h3>
          {recentLogs ? (
            <WateringCalendar logs={recentLogs} />
          ) : (
            <div className={styles.placeholderBox}>
              <CalendarDays size={28} className={styles.placeholderIcon} />
              <span className={styles.placeholderText}>
                Cargando historial...
              </span>
            </div>
          )}
        </div>

        {/* ─── Water Button ─── */}
        <button
          type="button"
          className={`${styles.waterButton} ${wasJustWatered ? styles.waterButtonSuccess : ''} ${alreadyWateredToday && !wasJustWatered ? styles.waterButtonDone : ''}`}
          disabled={alreadyWateredToday || isMarking}
          onClick={markAsWatered}
        >
          {isMarking ? (
            <>
              <div className={styles.buttonSpinner} />
              Regando...
            </>
          ) : wasJustWatered ? (
            <>
              <CheckCircle size={20} />
              ¡Regada!
            </>
          ) : alreadyWateredToday ? (
            <>
              <CheckCircle size={20} />
              Ya regada hoy
            </>
          ) : (
            <>
              <Droplets size={20} />
              Marcar como regada
            </>
          )}
        </button>

        {/* Celebration overlay: floating emojis after watering */}
        {wasJustWatered && (
          <div className={styles.celebrationOverlay}>
            <span className={styles.celebrationEmoji}>💧</span>
            <span className={styles.celebrationEmoji}>🌱</span>
            <span className={styles.celebrationEmoji}>💧</span>
          </div>
        )}
      </div>

      {/* ─── Delete Confirmation Modal ─── */}
      <ConfirmModal
        isOpen={showDeleteModal}
        title="¿Eliminar planta?"
        message={`Se eliminará "${displayName}" y todo su historial de riego. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        cancelLabel="Cancelar"
        variant="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
};

export default PlantDetailPage;
