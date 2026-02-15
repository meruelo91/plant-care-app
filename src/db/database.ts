import Dexie, { type Table } from 'dexie';
import type { Plant, WateringLog, UserSettings } from '../types';

/**
 * PlantCareDB - Our IndexedDB database using Dexie.
 *
 * IndexedDB is a database built into every browser. Unlike localStorage
 * (which only stores strings), IndexedDB can store complex objects,
 * images as blobs, and supports indexes for fast queries.
 *
 * Dexie wraps IndexedDB with a clean API:
 *   - Instead of callbacks, we use async/await
 *   - Instead of manual transactions, Dexie handles them
 *   - Instead of raw indexes, we define a simple schema
 *
 * VERSION SYSTEM:
 * The `.version(1).stores({...})` call defines the database schema.
 * If we need to add fields or tables later, we increment the version
 * number and Dexie handles the migration automatically. This is
 * important because users' data persists between app updates.
 *
 * SCHEMA SYNTAX:
 * In the stores() call, we only list INDEXED fields (fields we'll
 * search/filter by), not all fields. Other fields are still stored,
 * they just won't have an index.
 *   - 'id' = primary key
 *   - '&id' = primary key (unique)
 *   - 'plantId' = indexed field for fast lookups
 */
class PlantCareDB extends Dexie {
  // These typed table declarations let TypeScript know the shape
  // of each table, enabling autocomplete and type checking.
  plants!: Table<Plant, string>;
  wateringLogs!: Table<WateringLog, string>;
  userSettings!: Table<UserSettings, string>;

  constructor() {
    super('PlantCareDB');

    // VERSION 1: Initial schema
    this.version(1).stores({
      plants: '&id, type, createdAt',
      wateringLogs: '&id, plantId, wateredAt',
      userSettings: '&id',
    });

    // VERSION 2: Added wateringAdvice field to Plant objects.
    // The indexes don't change (wateringAdvice doesn't need an index),
    // but we bump the version to document the structural evolution.
    // Dexie handles the "migration" automatically since no index changes.
    //
    // WHY VERSION BUMP WITHOUT INDEX CHANGES?
    // Even though Dexie stores ALL fields regardless of the schema,
    // bumping the version is a best practice because:
    //   1. It documents when the data structure changed
    //   2. If we ever need to add a migration (e.g., transform old data),
    //      we have a clear version boundary to work with
    this.version(2).stores({
      plants: '&id, type, createdAt',
      wateringLogs: '&id, plantId, wateredAt',
      userSettings: '&id',
    });

    // VERSION 3: Added notificationPermission field to UserSettings.
    // Tracks the browser's notification permission state ('granted', 'denied', 'default').
    // No index changes needed - just documenting the structural evolution.
    this.version(3).stores({
      plants: '&id, type, createdAt',
      wateringLogs: '&id, plantId, wateredAt',
      userSettings: '&id',
    });

    // VERSION 4: Added lastNotificationSent field to UserSettings.
    // Tracks when the last watering reminder notification was sent,
    // preventing multiple notifications on the same day.
    this.version(4).stores({
      plants: '&id, type, createdAt',
      wateringLogs: '&id, plantId, wateredAt',
      userSettings: '&id',
    });
  }
}

// Singleton instance - the entire app shares this one database connection.
// "Singleton" means we create it once and reuse it everywhere.
// This avoids opening multiple connections to the same database.
export const db = new PlantCareDB();
