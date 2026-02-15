import { isSameDay, format } from 'date-fns';
import { db } from '@/db/database';
import type { Plant, UserSettings } from '@/types';
import { calculateNextWatering, getDaysUntilWatering } from '@/utils/watering';

/**
 * notificationService - Pure functions for watering notification logic.
 *
 * This service is decoupled from React and handles:
 *   1. Determining which plants need water
 *   2. Formatting notification messages
 *   3. Sending browser notifications
 *   4. Checking if it's time to send
 *   5. Tracking when notifications were sent
 *
 * WHY PURE FUNCTIONS?
 * The scheduler hook (useNotificationScheduler) calls these from a setInterval,
 * outside React's render cycle. Pure functions are easier to test and reason about.
 */

// ─── Constants ───

/** Default watering frequency when plant has no AI advice */
const DEFAULT_FREQUENCY_DAYS = 7;

/** Icon path for notifications (relative to public folder) */
const NOTIFICATION_ICON = '/icons/icon-192x192.png';

// ─── Types ───

export interface PlantNeedingWater {
  id: string;
  displayName: string;
  daysOverdue: number;
}

export interface NotificationContent {
  title: string;
  body: string;
  icon: string;
}

// ─── Core Functions ───

/**
 * Get all plants that need watering (daysUntilWatering <= 0).
 *
 * A plant needs water if:
 *   - It has never been watered (lastWatered is null)
 *   - Its next watering date is today or in the past
 *
 * Uses direct Dexie access (not useLiveQuery) since this runs
 * outside React's render cycle in a setInterval callback.
 */
export async function getPlantsNeedingWater(): Promise<PlantNeedingWater[]> {
  const plants: Plant[] = await db.plants.toArray();
  const needingWater: PlantNeedingWater[] = [];

  for (const plant of plants) {
    const frequencyDays: number = plant.wateringAdvice?.frequencyDays ?? DEFAULT_FREQUENCY_DAYS;
    const nextWatering: Date | null = calculateNextWatering(plant.lastWatered, frequencyDays);
    const daysUntil: number | null = getDaysUntilWatering(nextWatering);

    // Include if:
    // - daysUntil is null (never watered, but has been added to garden)
    // - daysUntil is 0 (water today)
    // - daysUntil is negative (overdue)
    if (daysUntil === null || daysUntil <= 0) {
      needingWater.push({
        id: plant.id,
        displayName: plant.nickname ?? plant.species,
        daysOverdue: daysUntil === null ? 0 : Math.abs(daysUntil),
      });
    }
  }

  return needingWater;
}

/**
 * Format notification message based on how many plants need water.
 *
 * Content rules:
 * - 0 plants: "All good" message (for test notifications only)
 * - 1 plant: "Tu [name] necesita agua"
 * - 2-3 plants: "Tienes X plantas que necesitan agua: [names]"
 * - 4+ plants: "Tienes X plantas que necesitan agua"
 */
export function formatNotificationMessage(
  plants: PlantNeedingWater[]
): NotificationContent {
  const count: number = plants.length;

  if (count === 0) {
    return {
      title: '🌱 Tus plantas están bien',
      body: 'No hay plantas que necesiten agua hoy.',
      icon: NOTIFICATION_ICON,
    };
  }

  if (count === 1) {
    const plant = plants[0];
    return {
      title: `🌱 Tu ${plant.displayName} necesita agua`,
      body: plant.daysOverdue > 0
        ? `Tiene ${plant.daysOverdue} día${plant.daysOverdue === 1 ? '' : 's'} de retraso`
        : '¡Es hora de regar!',
      icon: NOTIFICATION_ICON,
    };
  }

  if (count <= 3) {
    const names: string = plants.map((p) => p.displayName).join(', ');
    return {
      title: `🌱 Tienes ${count} plantas que necesitan agua`,
      body: names,
      icon: NOTIFICATION_ICON,
    };
  }

  // 4+ plants
  return {
    title: `🌱 Tienes ${count} plantas que necesitan agua`,
    body: 'Abre la app para ver cuáles son.',
    icon: NOTIFICATION_ICON,
  };
}

/**
 * Send a browser notification using the Notification API.
 *
 * IMPORTANT: Only call this if permission === 'granted'.
 * Returns true if notification was sent, false otherwise.
 */
export function sendWateringNotification(content: NotificationContent): boolean {
  if (typeof Notification === 'undefined') {
    console.warn('[notificationService] Notification API not supported');
    return false;
  }

  if (Notification.permission !== 'granted') {
    console.warn('[notificationService] Permission not granted');
    return false;
  }

  try {
    new Notification(content.title, {
      body: content.body,
      icon: content.icon,
      badge: content.icon,
      tag: 'plant-watering-reminder',
      requireInteraction: false,
    });
    return true;
  } catch (error) {
    console.error('[notificationService] Failed to send notification:', error);
    return false;
  }
}

/**
 * Check if it's time to send a notification.
 *
 * Conditions (ALL must be true):
 * 1. Notifications are enabled in settings
 * 2. Browser permission is 'granted'
 * 3. Current time is at or past the configured notification time
 * 4. We haven't already sent a notification today
 *
 * @param settings - Current user settings
 * @returns true if we should send a notification now
 */
export function shouldSendNotification(settings: UserSettings): boolean {
  // Check 1: Notifications enabled
  if (!settings.notificationsEnabled) {
    return false;
  }

  // Check 2: Permission granted
  if (settings.notificationPermission !== 'granted') {
    return false;
  }

  // Check 3: Time check - is it at or past the notification time?
  const now = new Date();
  const currentTimeStr: string = format(now, 'HH:mm');

  // Compare strings: "09:15" >= "09:00" means it's time
  if (currentTimeStr < settings.notificationTime) {
    return false;
  }

  // Check 4: Haven't sent today
  if (settings.lastNotificationSent) {
    if (isSameDay(settings.lastNotificationSent, now)) {
      return false;
    }
  }

  return true;
}

/**
 * Update the lastNotificationSent timestamp in IndexedDB.
 * Called after successfully sending a notification.
 */
export async function markNotificationSent(): Promise<void> {
  try {
    await db.userSettings.update('user-settings', {
      lastNotificationSent: new Date(),
    });
  } catch (error) {
    console.error('[notificationService] Failed to update lastNotificationSent:', error);
  }
}

// ─── Test Helper ───

/**
 * Send a test notification immediately, bypassing all checks.
 * Used by the "Probar notificación" button in SettingsPage.
 *
 * If plants need water, sends a real notification with actual data.
 * If no plants need water, sends a generic test success message.
 */
export async function sendTestNotification(): Promise<boolean> {
  const plants: PlantNeedingWater[] = await getPlantsNeedingWater();

  // If no plants need water, send a generic test notification
  if (plants.length === 0) {
    return sendWateringNotification({
      title: '🧪 Prueba de notificación',
      body: '¡Las notificaciones funcionan correctamente!',
      icon: NOTIFICATION_ICON,
    });
  }

  // Otherwise, send a real notification with actual data
  const content: NotificationContent = formatNotificationMessage(plants);
  return sendWateringNotification(content);
}
