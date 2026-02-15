import { useEffect, useRef } from 'react';
import { db } from '@/db/database';
import {
  shouldSendNotification,
  getPlantsNeedingWater,
  formatNotificationMessage,
  sendWateringNotification,
  markNotificationSent,
} from '@/services/notificationService';

/**
 * useNotificationScheduler - Runs a periodic check for watering notifications.
 *
 * HOW IT WORKS:
 * 1. On mount, starts a setInterval that runs every minute
 * 2. Each tick: reads settings from IndexedDB (non-reactive, direct access)
 * 3. If shouldSendNotification() returns true:
 *    a. Get plants needing water
 *    b. Format the notification message
 *    c. Send the notification
 *    d. Update lastNotificationSent in IndexedDB
 *
 * WHY NOT useLiveQuery?
 * This runs in a setInterval callback, outside React's render cycle.
 * useLiveQuery is for reactive UI updates; here we need imperative DB access.
 *
 * WHY EVERY MINUTE?
 * - Too frequent (every second): wastes CPU for no benefit
 * - Too infrequent (every 5 min): might miss the exact notification time
 * - Every minute: good balance, catches the time within 60 seconds
 *
 * iOS PWA LIMITATION:
 * On iOS, this only works while the app is in the foreground or recently used.
 * True background notifications require push notification infrastructure
 * (server, APNS, etc.) which is beyond MVP scope.
 */

const CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

export function useNotificationScheduler(): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Don't start scheduler if Notification API isn't supported
    if (typeof Notification === 'undefined') {
      console.log('[useNotificationScheduler] Notifications not supported, scheduler disabled');
      return;
    }

    const checkAndNotify = async (): Promise<void> => {
      try {
        // Read settings directly from IndexedDB (non-reactive)
        const settings = await db.userSettings.get('user-settings');

        if (!settings) {
          // No settings yet (shouldn't happen after onboarding, but be safe)
          return;
        }

        if (!shouldSendNotification(settings)) {
          // Not time yet, or already sent today, or disabled
          return;
        }

        // Get plants that need watering
        const plantsNeedingWater = await getPlantsNeedingWater();

        if (plantsNeedingWater.length === 0) {
          // No plants need water - still mark as "sent" to avoid
          // re-checking every minute for the rest of the day
          await markNotificationSent();
          console.log('[useNotificationScheduler] No plants need water today');
          return;
        }

        // Build and send the notification
        const content = formatNotificationMessage(plantsNeedingWater);
        const sent = sendWateringNotification(content);

        if (sent) {
          await markNotificationSent();
          console.log(
            '[useNotificationScheduler] Notification sent for',
            plantsNeedingWater.length,
            'plant(s)'
          );
        }
      } catch (error) {
        console.error('[useNotificationScheduler] Error during check:', error);
      }
    };

    // Run immediately on mount (in case app opens after notification time)
    checkAndNotify();

    // Then run every minute
    intervalRef.current = setInterval(checkAndNotify, CHECK_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []); // Empty dependency array = runs once on mount
}
