import { addDays, differenceInDays, subDays, startOfDay, isSameDay } from 'date-fns';
import type { WateringLog } from '@/types';

/**
 * Watering calculation utilities.
 *
 * These pure functions calculate when a plant needs to be watered next,
 * based on the last watering date and the recommended frequency.
 *
 * PURE FUNCTIONS:
 * Both functions take all inputs as parameters and return a result
 * without modifying anything external (no database writes, no state
 * changes). This makes them easy to test and reason about.
 *
 * WHY date-fns?
 * JavaScript's built-in Date arithmetic is error-prone:
 *   - Adding days manually can break across month/year boundaries
 *   - Timezone handling is a minefield
 * date-fns handles all of this correctly.
 *
 * FUTURE USE:
 * These functions will be used for:
 *   1. Showing "needs water in X days" in the UI
 *   2. Scheduling push notifications
 *   3. Coloring the watering indicator (green/yellow/red)
 */

/**
 * Calculate when a plant should be watered next.
 *
 * @param lastWatered - When the plant was last watered (null if never)
 * @param frequencyDays - How often to water (e.g., 7 = every week)
 * @returns The next watering date, or null if the plant was never watered
 *
 * @example
 * // Last watered 3 days ago, frequency is 7 days
 * const next = calculateNextWatering(threeDaysAgo, 7);
 * // → Date representing 4 days from now
 *
 * @example
 * // Never watered
 * const next = calculateNextWatering(null, 7);
 * // → null (can't calculate without a starting point)
 */
export function calculateNextWatering(
  lastWatered: Date | null,
  frequencyDays: number,
): Date | null {
  if (!lastWatered) return null;

  // addDays from date-fns: safely adds X days to a date,
  // handling month/year boundaries and DST transitions.
  return addDays(lastWatered, frequencyDays);
}

/**
 * Get the number of days until the next watering is due.
 *
 * @param nextWateringDate - The calculated next watering date
 * @returns Days until watering:
 *   - Positive number: watering is X days away (e.g., 3 = in 3 days)
 *   - Zero: water today!
 *   - Negative number: overdue by X days (e.g., -2 = 2 days late)
 *   - null: can't calculate (nextWateringDate was null)
 *
 * @example
 * const days = getDaysUntilWatering(fourDaysFromNow);
 * // → 4 (watering in 4 days)
 *
 * @example
 * const days = getDaysUntilWatering(twoDaysAgo);
 * // → -2 (overdue by 2 days!)
 */
export function getDaysUntilWatering(
  nextWateringDate: Date | null,
): number | null {
  if (!nextWateringDate) return null;

  // differenceInDays returns a positive number when the first date
  // is AFTER the second date. So "future - today" gives positive
  // (days until) and "past - today" gives negative (days overdue).
  return differenceInDays(nextWateringDate, new Date());
}

/**
 * Get an array of the last 7 calendar days (today - 6 through today).
 *
 * Each date is normalized to startOfDay (00:00:00) for reliable
 * comparison with watering log timestamps using isSameDay.
 *
 * @param today - Optional override for "today" (useful for testing)
 * @returns Array of 7 Dates, oldest first, newest (today) last
 */
export function getLast7Days(today: Date = new Date()): Date[] {
  const days: Date[] = [];
  for (let i = 6; i >= 0; i--) {
    days.push(startOfDay(subDays(today, i)));
  }
  return days;
}

/**
 * Check if a plant was watered on a specific calendar day.
 *
 * Uses isSameDay from date-fns which compares year + month + day
 * while ignoring hours/minutes/seconds. This correctly matches
 * a watering timestamp (e.g., 14:30:00) against a calendar day.
 *
 * @param logs - Array of WateringLog entries to search
 * @param day - The calendar day to check
 * @returns true if at least one watering log falls on that day
 */
export function wasWateredOnDay(logs: WateringLog[], day: Date): boolean {
  return logs.some((log) => isSameDay(log.wateredAt, day));
}
