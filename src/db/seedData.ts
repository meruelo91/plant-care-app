import { db } from './database';
import { subDays } from 'date-fns';
import { generateId } from '@/utils/generateId';
import type { Plant } from '@/types';

/**
 * Seed data for development/testing.
 *
 * These mock plants cover 3 important states:
 * 1. Recently watered (2 days ago) → healthy, no alert
 * 2. Needs water (10 days ago) → shows "needs water" badge
 * 3. Never watered (null) → shows "needs water" badge
 *
 * subDays() from date-fns:
 * Creates a date X days in the past from now.
 * subDays(new Date(), 2) = "2 days ago"
 *
 * Why photoURL is empty:
 * We don't depend on external URLs (Unsplash, etc.) because:
 * - They might be blocked, slow, or go offline
 * - We want the app to work 100% offline
 * - PlantCard handles missing photos with a placeholder icon
 */
export async function seedMockPlants(): Promise<void> {
  // Check if plants already exist to avoid duplicating seed data
  const existingCount = await db.plants.count();
  if (existingCount > 0) {
    return;
  }

  const now = new Date();

  const mockPlants: Plant[] = [
    {
      id: generateId(),
      photoURL: '',
      type: 'Suculenta',
      species: 'Echeveria elegans',
      nickname: 'Susy',
      createdAt: subDays(now, 30),
      lastWatered: subDays(now, 2),
    },
    {
      id: generateId(),
      photoURL: '',
      type: 'Cactus',
      species: 'Opuntia microdasys',
      nickname: 'Pincho',
      createdAt: subDays(now, 20),
      lastWatered: subDays(now, 10),
    },
    {
      id: generateId(),
      photoURL: '',
      type: 'Tropical',
      species: 'Monstera deliciosa',
      createdAt: subDays(now, 5),
      lastWatered: null,
    },
  ];

  await db.plants.bulkAdd(mockPlants);
}
