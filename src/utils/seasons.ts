/**
 * Season utilities for determining the current season.
 *
 * WHY IS SEASON IMPORTANT FOR WATERING?
 * Plants need different amounts of water depending on the season:
 *   - Summer: more water (heat, evaporation)
 *   - Winter: less water (dormancy, less evaporation)
 *   - Spring/Fall: moderate water
 *
 * HEMISPHERES:
 * The seasons are opposite in the Northern and Southern hemispheres.
 * When it's Summer in Spain (July), it's Winter in Argentina.
 * We determine the hemisphere based on the user's country.
 *
 * SIMPLIFICATION:
 * Countries near the equator (Colombia, Ecuador) don't really have
 * four seasons — they have "wet" and "dry" seasons. For simplicity,
 * we treat them as Southern Hemisphere, but the AI prompt will
 * receive the country name so Claude can give more accurate advice.
 */

// ─── Types ───

export type Season = 'Primavera' | 'Verano' | 'Otoño' | 'Invierno';

// ─── Constants ───

/**
 * Countries in the Southern Hemisphere (or near the equator).
 * Everything else defaults to Northern Hemisphere.
 *
 * We use a Set for O(1) lookup performance (constant time),
 * as opposed to an array which would be O(n) (linear search).
 */
const SOUTHERN_HEMISPHERE_COUNTRIES: ReadonlySet<string> = new Set([
  'Argentina',
  'Chile',
  'Perú',
  'Brasil',
  'Colombia',
  'Uruguay',
  'Paraguay',
  'Bolivia',
  'Ecuador',
  'Australia',
  'Nueva Zelanda',
  'Sudáfrica',
]);

/**
 * Map month number (0-11) to season for Northern Hemisphere.
 *
 * MONTH MAPPING (JavaScript months are 0-indexed):
 *   0 = January, 1 = February, ..., 11 = December
 *
 *   Dec(11), Jan(0), Feb(1) → Invierno
 *   Mar(2), Apr(3), May(4)  → Primavera
 *   Jun(5), Jul(6), Aug(7)  → Verano
 *   Sep(8), Oct(9), Nov(10) → Otoño
 */
const NORTH_SEASONS: readonly Season[] = [
  'Invierno',   // 0 = January
  'Invierno',   // 1 = February
  'Primavera',  // 2 = March
  'Primavera',  // 3 = April
  'Primavera',  // 4 = May
  'Verano',     // 5 = June
  'Verano',     // 6 = July
  'Verano',     // 7 = August
  'Otoño',      // 8 = September
  'Otoño',      // 9 = October
  'Otoño',      // 10 = November
  'Invierno',   // 11 = December
];

/**
 * Southern Hemisphere: seasons are shifted 6 months.
 * When it's Summer in the North, it's Winter in the South.
 */
const SOUTH_SEASONS: readonly Season[] = [
  'Verano',     // 0 = January
  'Verano',     // 1 = February
  'Otoño',      // 2 = March
  'Otoño',      // 3 = April
  'Otoño',      // 4 = May
  'Invierno',   // 5 = June
  'Invierno',   // 6 = July
  'Invierno',   // 7 = August
  'Primavera',  // 8 = September
  'Primavera',  // 9 = October
  'Primavera',  // 10 = November
  'Verano',     // 11 = December
];

// ─── Functions ───

/**
 * Determine if a country is in the Southern Hemisphere.
 */
function isSouthernHemisphere(country: string): boolean {
  return SOUTHERN_HEMISPHERE_COUNTRIES.has(country);
}

/**
 * Get the current season based on the user's country.
 *
 * @param country - The user's country name (e.g., "España", "Argentina")
 * @param date - Optional date to check (defaults to now, useful for testing)
 * @returns The current season name in Spanish
 */
export function getCurrentSeason(
  country: string,
  date: Date = new Date(),
): Season {
  const month: number = date.getMonth(); // 0-11
  const seasons = isSouthernHemisphere(country)
    ? SOUTH_SEASONS
    : NORTH_SEASONS;

  return seasons[month];
}
