// Plant Care PWA - Type definitions
// These interfaces define the shape of our data throughout the app.
// Everything from the database to the UI components uses these types,
// so they're the "single source of truth" for our data structure.

/**
 * Represents a plant in the user's garden.
 * Each plant has a photo, classification info, and watering tracking.
 */
export interface Plant {
  id: string;
  photoURL: string; // base64 encoded image or blob URL
  type: string; // e.g., "Suculenta", "Cactus", "Tropical"
  species: string; // e.g., "Brighamia insignis"
  nickname?: string; // optional user-given name
  createdAt: Date;
  lastWatered: Date | null;
  wateringAdvice?: PlantWateringAdvice; // AI-generated advice, saved for offline access
}

/**
 * A record of when a plant was watered.
 * Stored separately from Plant to maintain a complete history.
 * This separation follows "normalization" - a database design principle
 * that avoids storing repeated data inside the Plant record.
 */
export interface WateringLog {
  id: string;
  plantId: string; // references Plant.id
  wateredAt: Date;
}

/**
 * Browser notification permission status.
 * Maps directly to the Notification API's permission states:
 *   - 'default': User hasn't been asked yet
 *   - 'granted': User allowed notifications
 *   - 'denied': User blocked notifications (can't re-ask programmatically)
 */
export type NotificationPermissionStatus = 'granted' | 'denied' | 'default';

/**
 * Global user preferences.
 * Uses a fixed id ('user-settings') because there's only ever one record.
 * This is a common pattern called "singleton record" in databases.
 *
 * onboardingCompleted tracks whether the user has finished the initial
 * setup flow (location selection). The app checks this on every launch
 * to decide whether to show the onboarding screen or the main app.
 */
export interface UserSettings {
  id: 'user-settings'; // literal type - can ONLY be this exact string
  location: UserLocation;
  onboardingCompleted: boolean;
  notificationsEnabled: boolean;
  notificationTime: string; // 24h format, e.g., "09:00"
  notificationPermission: NotificationPermissionStatus;
  lastNotificationSent?: Date; // Tracks when we last sent a watering reminder (prevents duplicates)
}

/**
 * User's location info for weather-based watering recommendations.
 *
 * type distinguishes how the location was obtained:
 *   - 'auto': via Geolocation API + reverse geocoding (has city + coords)
 *   - 'manual': user picked a country from a dropdown (no city/coords)
 *
 * coords is optional because manual selection doesn't provide GPS data.
 */
export interface UserLocation {
  type: 'auto' | 'manual';
  country: string;
  city?: string;
  coords?: {
    lat: number;
    lon: number;
  };
}

/**
 * AI-generated watering advice as returned from the Claude API.
 *
 * This is the RAW response structure after parsing Claude's JSON.
 * It gets enriched with metadata (date, season, location) before
 * being saved as PlantWateringAdvice in IndexedDB.
 *
 * frequencyDays: how often to water (e.g., 7 = once a week)
 * bestTime: optimal time of day for watering
 * amount: how much water to give relative to the pot size
 */
export interface WateringAdvice {
  advice: string;
  frequencyDays: number; // 1-30
  bestTime: 'mañana' | 'tarde' | 'noche';
  amount: 'poca' | 'moderada' | 'abundante';
}

/**
 * Persisted watering advice stored inside the Plant record in IndexedDB.
 *
 * Extends the API response with metadata about WHEN and WHERE
 * the advice was generated. This lets us:
 *   1. Show "Generated 3 days ago" in the UI
 *   2. Know if advice is outdated (different season)
 *   3. Display the context (e.g., "Verano en Valencia, España")
 *
 * WHY SEPARATE FROM WateringAdvice?
 * WateringAdvice is the "raw" API response type (used for parsing).
 * PlantWateringAdvice is the "enriched" version (used for storage).
 * This separation keeps the API parsing clean and the storage complete.
 */
export interface PlantWateringAdvice {
  text: string;           // The main advice text
  frequencyDays: number;  // 1-30, how often to water
  bestTime: string;       // "mañana" | "tarde" | "noche"
  amount: string;         // "poca" | "moderada" | "abundante"
  generatedAt: Date;      // When this advice was generated
  season: string;         // "Primavera", "Verano", "Otoño", "Invierno"
  location: string;       // "Valencia, España" or just "México"
  isFallback?: boolean;   // true if advice came from hardcoded fallback (no API)
}
