import { useState } from 'react';
import { Settings, MapPin, Bell, AlertCircle, Info, FlaskConical } from 'lucide-react';
import { useUserSettings } from '@/hooks/useUserSettings';
import { useNotificationSettings } from '@/hooks/useNotificationSettings';
import { sendTestNotification } from '@/services/notificationService';
import Toggle from '@/components/common/Toggle';
import styles from './SettingsPage.module.css';

/**
 * SettingsPage - App configuration screen.
 *
 * SECTIONS:
 * 1. Location — Shows where the user's garden is located
 * 2. Notifications — Configure watering reminders
 *
 * NOTIFICATIONS FLOW:
 * - Toggle requests browser permission when turned ON for the first time
 * - If permission is 'denied', toggle is disabled with help message
 * - Time picker only appears when notifications are enabled
 */

/**
 * Generate time options from 06:00 to 22:00 in 30-minute increments.
 * Returns an array like ["06:00", "06:30", "07:00", ..., "22:00"]
 */
const generateTimeOptions = (): string[] => {
  const options: string[] = [];
  for (let hour = 6; hour <= 22; hour++) {
    const hourStr: string = hour.toString().padStart(2, '0');
    options.push(`${hourStr}:00`);
    if (hour < 22) {
      options.push(`${hourStr}:30`);
    }
  }
  return options;
};

const SettingsPage: React.FC = () => {
  const { settings, isLoading } = useUserSettings();
  const {
    isEnabled,
    permissionStatus,
    notificationTime,
    isRequestingPermission,
    toggleNotifications,
    updateNotificationTime,
    isSupported,
  } = useNotificationSettings();

  // State for test notification feedback
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  // Handle test notification button click
  const handleTestNotification = async (): Promise<void> => {
    setTestStatus('sending');
    try {
      const sent: boolean = await sendTestNotification();
      setTestStatus(sent ? 'sent' : 'error');
      // Reset to idle after 3 seconds
      setTimeout(() => setTestStatus('idle'), 3000);
    } catch {
      setTestStatus('error');
      setTimeout(() => setTestStatus('idle'), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.page}>
        <h1 className={styles.pageTitle}>
          <Settings size={24} />
          Ajustes
        </h1>
        <p>Cargando...</p>
      </div>
    );
  }

  // Build location display text
  const locationText: string = settings?.location.city
    ? `${settings.location.city}, ${settings.location.country}`
    : settings?.location.country ?? 'No configurada';

  // How was the location obtained?
  const detectionMethod: string =
    settings?.location.type === 'auto' ? 'GPS automático' : 'Selección manual';

  // Determine toggle description based on permission state
  const getToggleDescription = (): string => {
    if (permissionStatus === 'denied') {
      return 'Permiso denegado. Actívalo en los ajustes de tu navegador.';
    }
    return 'Recibe un recordatorio diario para regar tus plantas.';
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>
        <Settings size={24} />
        Ajustes
      </h1>

      {/* ─── Location Section ─── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <MapPin size={20} className={styles.sectionIcon} />
          <h2 className={styles.sectionTitle}>Ubicación</h2>
        </div>

        <div className={styles.locationRow}>
          <div>
            <p className={styles.locationLabel}>Tu jardín está en</p>
            <p className={styles.locationValue}>{locationText}</p>
          </div>
        </div>

        <div className={styles.locationRow}>
          <span className={styles.locationBadge}>
            {detectionMethod}
          </span>
        </div>
      </div>

      {/* ─── Notifications Section ─── */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <Bell size={20} className={styles.sectionIcon} />
          <h2 className={styles.sectionTitle}>Notificaciones</h2>
        </div>

        {!isSupported ? (
          // Browser doesn't support Notification API
          <div className={styles.notSupportedMessage}>
            <AlertCircle size={16} />
            <span>Tu navegador no soporta notificaciones push.</span>
          </div>
        ) : (
          <>
            {/* Enable/Disable Toggle */}
            <Toggle
              id="notifications-toggle"
              checked={isEnabled}
              onChange={toggleNotifications}
              disabled={permissionStatus === 'denied' || isRequestingPermission}
              label="Recordatorios de riego"
              description={getToggleDescription()}
            />

            {/* Permission denied warning */}
            {permissionStatus === 'denied' && (
              <div className={styles.permissionWarning}>
                <Info size={16} />
                <span>
                  Has bloqueado las notificaciones. Para activarlas, ve a la
                  configuración de tu navegador y habilita las notificaciones
                  para este sitio.
                </span>
              </div>
            )}

            {/* Time picker (only when enabled and permission granted) */}
            {isEnabled && permissionStatus === 'granted' && (
              <div className={styles.timePickerRow}>
                <label htmlFor="notification-time" className={styles.timeLabel}>
                  Hora del recordatorio
                </label>
                <select
                  id="notification-time"
                  className={styles.timeSelect}
                  value={notificationTime}
                  onChange={(e) => updateNotificationTime(e.target.value)}
                >
                  {generateTimeOptions().map((time: string) => (
                    <option key={time} value={time}>
                      {time}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Test notification button (only when enabled and granted) */}
            {isEnabled && permissionStatus === 'granted' && (
              <div className={styles.testButtonRow}>
                <button
                  type="button"
                  className={styles.testButton}
                  onClick={handleTestNotification}
                  disabled={testStatus === 'sending'}
                >
                  <FlaskConical size={16} />
                  {testStatus === 'sending' ? 'Enviando...' : 'Probar notificación'}
                </button>
                {testStatus === 'sent' && (
                  <span className={styles.testSuccess}>¡Notificación enviada!</span>
                )}
                {testStatus === 'error' && (
                  <span className={styles.testError}>Error al enviar</span>
                )}
              </div>
            )}

            {/* Permission status badge */}
            {permissionStatus !== 'denied' && (
              <div className={styles.permissionBadge}>
                <span
                  className={
                    permissionStatus === 'granted'
                      ? styles.badgeGranted
                      : styles.badgeDefault
                  }
                >
                  {permissionStatus === 'granted'
                    ? 'Permisos activados'
                    : 'Permisos pendientes'}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
