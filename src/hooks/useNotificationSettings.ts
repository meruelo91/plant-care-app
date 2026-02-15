import { useState, useCallback, useEffect } from 'react';
import { useUserSettings } from './useUserSettings';
import type { NotificationPermissionStatus } from '@/types';

/**
 * useNotificationSettings - Hook for managing notification preferences.
 *
 * RESPONSIBILITIES:
 * 1. Sync browser permission state with IndexedDB on mount
 * 2. Handle the permission request flow when enabling notifications
 * 3. Provide reactive state for the settings UI
 *
 * PERMISSION FLOW:
 * When user toggles notifications ON:
 *   - If permission is 'default': Request permission via browser API
 *   - If permission is 'granted': Just enable in settings
 *   - If permission is 'denied': Cannot enable (show help message in UI)
 *
 * WHY SYNC ON MOUNT?
 * Users can change notification permissions in browser settings outside our app.
 * On mount, we check the browser's current state and update IndexedDB if it differs.
 */

export interface UseNotificationSettingsResult {
  /** Whether notifications are enabled in settings */
  isEnabled: boolean;
  /** Current browser permission status */
  permissionStatus: NotificationPermissionStatus;
  /** The configured notification time (e.g., "09:00") */
  notificationTime: string;
  /** Whether we're currently requesting permission from the browser */
  isRequestingPermission: boolean;
  /** Toggle notifications on/off (handles permission request automatically) */
  toggleNotifications: () => Promise<void>;
  /** Update the notification time */
  updateNotificationTime: (time: string) => Promise<void>;
  /** Whether the browser supports the Notification API */
  isSupported: boolean;
}

export function useNotificationSettings(): UseNotificationSettingsResult {
  const { settings, updateSettings } = useUserSettings();
  const [isRequestingPermission, setIsRequestingPermission] = useState<boolean>(false);

  // Check if Notification API is available in this browser
  const isSupported: boolean = typeof Notification !== 'undefined';

  // ─── Sync browser permission with IndexedDB on mount ───
  // This catches cases where the user changed permissions in browser settings
  useEffect(() => {
    if (!isSupported || !settings) return;

    const browserPermission = Notification.permission as NotificationPermissionStatus;

    // If browser permission differs from what we stored, update IndexedDB
    if (browserPermission !== settings.notificationPermission) {
      updateSettings({ notificationPermission: browserPermission });

      // If permission was revoked externally, also disable notifications
      if (browserPermission === 'denied' && settings.notificationsEnabled) {
        updateSettings({ notificationsEnabled: false });
      }
    }
  }, [isSupported, settings, updateSettings]);

  /**
   * Toggle notifications on/off.
   * When turning ON, requests browser permission if needed.
   */
  const toggleNotifications = useCallback(async (): Promise<void> => {
    if (!settings || !isSupported) return;

    const newEnabled: boolean = !settings.notificationsEnabled;

    if (newEnabled) {
      // User is turning ON notifications
      const currentPermission = Notification.permission as NotificationPermissionStatus;

      if (currentPermission === 'default') {
        // Never asked before — request permission from browser
        setIsRequestingPermission(true);
        try {
          const result = await Notification.requestPermission();
          const permissionStatus = result as NotificationPermissionStatus;

          await updateSettings({
            notificationPermission: permissionStatus,
            notificationsEnabled: permissionStatus === 'granted',
          });
        } finally {
          setIsRequestingPermission(false);
        }
      } else if (currentPermission === 'granted') {
        // Already granted — just enable
        await updateSettings({ notificationsEnabled: true });
      }
      // If 'denied', we don't enable (UI will show a help message)
    } else {
      // User is turning OFF notifications
      await updateSettings({ notificationsEnabled: false });
    }
  }, [settings, isSupported, updateSettings]);

  /**
   * Update the notification time.
   * Expects a 24-hour format string like "09:00" or "14:30".
   */
  const updateNotificationTime = useCallback(
    async (time: string): Promise<void> => {
      await updateSettings({ notificationTime: time });
    },
    [updateSettings]
  );

  return {
    isEnabled: settings?.notificationsEnabled ?? false,
    permissionStatus: (settings?.notificationPermission ?? 'default') as NotificationPermissionStatus,
    notificationTime: settings?.notificationTime ?? '09:00',
    isRequestingPermission,
    toggleNotifications,
    updateNotificationTime,
    isSupported,
  };
}
