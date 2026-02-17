import React, { useEffect, useState } from 'react';
import { SlidersHorizontal, Droplets, CheckCircle, HelpCircle, X } from 'lucide-react';
import { WATERING_STATUS_LABELS, SORT_LABELS } from '@/hooks/useFilteredPlants';
import type { WateringStatusFilter, PlantSortOption } from '@/types';
import styles from './FilterPanel.module.css';

/**
 * FilterPanel - Bottom drawer with filter and sort options.
 *
 * MOBILE UX:
 *   - Slides up from the bottom (thumb-friendly on mobile)
 *   - Dark overlay behind it
 *   - Sections for watering status, plant type, and sort order
 *   - Apply/Clear/Cancel actions at the bottom
 *
 * STATE:
 *   - Uses local state for "pending" selections
 *   - Only calls the setters when user clicks "Aplicar"
 *   - This allows the user to preview changes before committing
 *
 * PROPS:
 *   - isOpen: controls visibility
 *   - onClose: close without applying
 *   - Current filter values (for initializing local state)
 *   - Setters (called on Apply)
 *   - availablePlantTypes: list of plant types for the dropdown
 */

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Current values
  wateringStatus: WateringStatusFilter;
  plantType: string | null;
  sortBy: PlantSortOption;
  // Setters
  setWateringStatus: (status: WateringStatusFilter) => void;
  setPlantType: (type: string | null) => void;
  setSortBy: (sortBy: PlantSortOption) => void;
  clearFilters: () => void;
  // Options
  availablePlantTypes: readonly string[];
}

// Watering status options with icons
const WATERING_OPTIONS: Array<{
  value: WateringStatusFilter;
  icon: React.ReactNode;
}> = [
  { value: 'all', icon: <span>✨</span> },
  { value: 'needs_water', icon: <Droplets size={16} /> },
  { value: 'ok', icon: <CheckCircle size={16} /> },
  { value: 'no_data', icon: <HelpCircle size={16} /> },
];

// Sort options
const SORT_OPTIONS: PlantSortOption[] = [
  'next_watering',
  'alphabetical',
  'newest',
  'last_watered',
];

export default function FilterPanel({
  isOpen,
  onClose,
  wateringStatus,
  plantType,
  sortBy,
  setWateringStatus,
  setPlantType,
  setSortBy,
  clearFilters,
  availablePlantTypes,
}: FilterPanelProps): React.ReactElement | null {
  // Local "pending" state (applied only when user clicks Apply)
  const [pendingWateringStatus, setPendingWateringStatus] =
    useState<WateringStatusFilter>(wateringStatus);
  const [pendingPlantType, setPendingPlantType] = useState<string | null>(plantType);
  const [pendingSortBy, setPendingSortBy] = useState<PlantSortOption>(sortBy);

  // Sync local state when panel opens with new values
  useEffect(() => {
    if (isOpen) {
      setPendingWateringStatus(wateringStatus);
      setPendingPlantType(plantType);
      setPendingSortBy(sortBy);
    }
  }, [isOpen, wateringStatus, plantType, sortBy]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleApply = (): void => {
    setWateringStatus(pendingWateringStatus);
    setPlantType(pendingPlantType);
    setSortBy(pendingSortBy);
    onClose();
  };

  const handleClearAndApply = (): void => {
    clearFilters();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.panel}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Filtrar y ordenar plantas"
      >
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <SlidersHorizontal size={20} />
            <h2 className={styles.title}>Filtrar y Ordenar</h2>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Cerrar"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className={styles.content}>
          {/* Watering Status Section */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Estado de riego</h3>
            <div className={styles.optionGrid}>
              {WATERING_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.optionButton} ${
                    pendingWateringStatus === option.value ? styles.optionSelected : ''
                  }`}
                  onClick={() => setPendingWateringStatus(option.value)}
                >
                  <span className={styles.optionIcon}>{option.icon}</span>
                  <span className={styles.optionLabel}>
                    {WATERING_STATUS_LABELS[option.value]}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Plant Type Section */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Tipo de planta</h3>
            <div className={styles.optionWrap}>
              <button
                type="button"
                className={`${styles.typeChip} ${
                  pendingPlantType === null ? styles.typeChipSelected : ''
                }`}
                onClick={() => setPendingPlantType(null)}
              >
                Todas
              </button>
              {availablePlantTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`${styles.typeChip} ${
                    pendingPlantType === type ? styles.typeChipSelected : ''
                  }`}
                  onClick={() => setPendingPlantType(type)}
                >
                  {type}
                </button>
              ))}
            </div>
          </section>

          {/* Sort Section */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Ordenar por</h3>
            <div className={styles.sortOptions}>
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`${styles.sortButton} ${
                    pendingSortBy === option ? styles.sortSelected : ''
                  }`}
                  onClick={() => setPendingSortBy(option)}
                >
                  {SORT_LABELS[option]}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Footer Actions */}
        <div className={styles.footer}>
          <button
            type="button"
            className={styles.clearButton}
            onClick={handleClearAndApply}
          >
            Limpiar
          </button>
          <button
            type="button"
            className={styles.applyButton}
            onClick={handleApply}
          >
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
