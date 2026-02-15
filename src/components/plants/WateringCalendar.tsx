import React from 'react';
import { format, isToday } from 'date-fns';
import { CheckCircle, Circle } from 'lucide-react';
import type { WateringLog } from '@/types';
import { getLast7Days, wasWateredOnDay } from '@/utils/watering';
import styles from './WateringCalendar.module.css';

/**
 * WateringCalendar - Horizontal 7-day watering history widget.
 *
 * PRESENTATIONAL COMPONENT:
 * Receives watering logs via props and uses pure utility functions
 * to determine the display. No database access — follows the same
 * pattern as PlantCard.tsx.
 *
 * LAYOUT:
 * 7 equal-width cells in a CSS Grid row, each showing:
 *   - Day initial in Spanish (L M X J V S D)
 *   - Date number (1-31)
 *   - Status icon: green checkmark (watered) or gray circle (not watered)
 *   - Today gets a highlighted background
 *
 * SPANISH DAY INITIALS:
 * "X" for Miercoles avoids confusion with "M" for Martes.
 */

interface WateringCalendarProps {
  logs: WateringLog[];
}

/** Map JS getDay() (0=Sunday) to Spanish day initial */
const DAY_INITIALS: Record<number, string> = {
  0: 'D',
  1: 'L',
  2: 'M',
  3: 'X',
  4: 'J',
  5: 'V',
  6: 'S',
};

const WateringCalendar: React.FC<WateringCalendarProps> = ({ logs }) => {
  const days: Date[] = getLast7Days();

  return (
    <div className={styles.calendar}>
      {days.map((day: Date) => {
        const watered: boolean = wasWateredOnDay(logs, day);
        const today: boolean = isToday(day);
        const dayInitial: string = DAY_INITIALS[day.getDay()];
        const dateNumber: string = format(day, 'd');

        return (
          <div
            key={day.toISOString()}
            className={`${styles.dayCell} ${today ? styles.dayCellToday : ''} ${watered ? styles.dayCellWatered : ''}`}
          >
            <span className={styles.dayInitial}>{dayInitial}</span>
            <span className={styles.dateNumber}>{dateNumber}</span>
            <div className={styles.statusIcon}>
              {watered ? (
                <CheckCircle size={20} />
              ) : (
                <Circle size={20} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WateringCalendar;
