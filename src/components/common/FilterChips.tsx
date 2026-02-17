import React from 'react';
import { X } from 'lucide-react';
import type { FilterChipData } from '@/types';
import styles from './FilterChips.module.css';

/**
 * FilterChips - Horizontal list of active filter chips.
 *
 * Each chip shows a filter label with an X button to remove it.
 * Chips scroll horizontally if they overflow.
 *
 * USAGE:
 *   <FilterChips chips={activeFilters.chips} onRemove={removeFilter} />
 *
 * PROPS:
 *   - chips: Array of active filter chips to display
 *   - onRemove: Callback when user clicks X on a chip (receives chip key)
 */

interface FilterChipsProps {
  chips: FilterChipData[];
  onRemove: (key: string) => void;
}

export default function FilterChips({
  chips,
  onRemove,
}: FilterChipsProps): React.ReactElement | null {
  // Don't render anything if no active filters
  if (chips.length === 0) return null;

  return (
    <div className={styles.container}>
      {chips.map((chip) => (
        <div key={chip.key} className={styles.chip}>
          <span className={styles.label}>{chip.label}</span>
          <button
            type="button"
            className={styles.removeButton}
            onClick={() => onRemove(chip.key)}
            aria-label={`Quitar filtro: ${chip.label}`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
