/**
 * Geolocation utilities for obtaining the user's location.
 *
 * This module wraps two browser/web APIs:
 *
 * 1. GEOLOCATION API (navigator.geolocation):
 *    Built into all modern browsers. Asks the user for permission to
 *    share their GPS coordinates (latitude, longitude). The user sees
 *    a browser popup like "This site wants to know your location".
 *
 * 2. NOMINATIM REVERSE GEOCODING:
 *    A free API by OpenStreetMap. Given coordinates, it returns a
 *    human-readable address (country, city, street, etc.).
 *    "Reverse geocoding" = coordinates → address (the reverse of
 *    normal geocoding which is address → coordinates).
 *
 * WHY SEPARATE UTILS FILE?
 * These functions deal with external APIs and browser permissions,
 * which are complex and error-prone. Keeping them separate from
 * React components makes them easier to understand, test, and reuse.
 */

// ─── Types ───

/** Result from the Geolocation API */
export interface GeoCoordinates {
  lat: number;
  lon: number;
}

/** Result from reverse geocoding (Nominatim) */
export interface GeoLocationResult {
  country: string;
  city: string | undefined;
  coords: GeoCoordinates;
}

/**
 * Custom error types for geolocation failures.
 *
 * UNION TYPE ('permission_denied' | 'position_unavailable' | ...):
 * This is a TypeScript feature that limits a string to specific values.
 * It's safer than using raw strings because TypeScript catches typos.
 */
export type GeoErrorType =
  | 'permission_denied'
  | 'position_unavailable'
  | 'timeout'
  | 'not_supported'
  | 'geocoding_failed';

export interface GeoError {
  type: GeoErrorType;
  message: string;
}

// ─── Constants ───

/**
 * Nominatim API URL for reverse geocoding.
 * format=json: we want JSON (not XML or HTML)
 * accept-language=es: prefer Spanish names for countries/cities
 */
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org/reverse';

/**
 * User-Agent header required by Nominatim's usage policy.
 * Without this, Nominatim may block our requests.
 * See: https://operations.osmfoundation.org/policies/nominatim/
 */
const USER_AGENT = 'PlantCarePWA/1.0 (learning-project)';

/** Maximum time to wait for GPS coordinates (in milliseconds) */
const GEOLOCATION_TIMEOUT = 15000; // 15 seconds

// ─── Functions ───

/**
 * Get the user's current GPS coordinates.
 *
 * PROMISE WRAPPER:
 * The Geolocation API uses old-style callbacks (success/error functions).
 * We wrap it in a Promise so we can use async/await, which is much
 * cleaner to read and handle errors with try/catch.
 *
 * @returns The user's latitude and longitude
 * @throws GeoError if the user denies permission, GPS is unavailable, etc.
 */
export function getCurrentPosition(): Promise<GeoCoordinates> {
  return new Promise((resolve, reject) => {
    // Feature detection: check if the browser supports geolocation
    if (!navigator.geolocation) {
      const error: GeoError = {
        type: 'not_supported',
        message: 'Tu navegador no soporta geolocalización',
      };
      reject(error);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      // Success callback: browser got the GPS coordinates
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },

      // Error callback: something went wrong
      (positionError) => {
        /**
         * positionError.code tells us WHAT went wrong:
         *   1 = PERMISSION_DENIED (user clicked "Don't allow")
         *   2 = POSITION_UNAVAILABLE (GPS hardware issue)
         *   3 = TIMEOUT (took too long to get coordinates)
         */
        let error: GeoError;

        switch (positionError.code) {
          case positionError.PERMISSION_DENIED:
            error = {
              type: 'permission_denied',
              message: 'Permiso de ubicación denegado',
            };
            break;
          case positionError.POSITION_UNAVAILABLE:
            error = {
              type: 'position_unavailable',
              message: 'No se pudo obtener tu ubicación',
            };
            break;
          case positionError.TIMEOUT:
            error = {
              type: 'timeout',
              message: 'Se agotó el tiempo de espera',
            };
            break;
          default:
            error = {
              type: 'position_unavailable',
              message: 'Error desconocido de geolocalización',
            };
        }

        reject(error);
      },

      // Options for the geolocation request
      {
        enableHighAccuracy: false, // false = faster, uses WiFi/cell instead of GPS
        timeout: GEOLOCATION_TIMEOUT,
        maximumAge: 300000, // Accept cached position up to 5 min old
      },
    );
  });
}

/**
 * Convert GPS coordinates into a country and city name.
 *
 * REVERSE GEOCODING:
 * Takes latitude/longitude → returns human-readable location.
 * Example: (39.47, -0.37) → { country: "España", city: "Valencia" }
 *
 * Uses OpenStreetMap's Nominatim API (free, no API key needed).
 *
 * NOMINATIM RESPONSE STRUCTURE:
 * The API returns an object with an 'address' field containing:
 *   - country: "España"
 *   - city: "Valencia" (for big cities)
 *   - town: "Torrent" (for medium towns)
 *   - village: "Godella" (for small villages)
 * We check city → town → village in order of preference.
 *
 * @param coords - Latitude and longitude to look up
 * @returns Country name and optional city name
 * @throws GeoError if the API call fails
 */
export async function reverseGeocode(
  coords: GeoCoordinates,
): Promise<{ country: string; city: string | undefined }> {
  try {
    const url = `${NOMINATIM_BASE_URL}?format=json&lat=${coords.lat}&lon=${coords.lon}&accept-language=es`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim responded with status ${response.status}`);
    }

    // The response body is JSON with an 'address' object
    const data: NominatimResponse = await response.json();

    if (!data.address || !data.address.country) {
      throw new Error('No address data in Nominatim response');
    }

    // Try to extract city name from different fields
    // Nominatim uses different keys depending on the size of the settlement
    const city =
      data.address.city ??
      data.address.town ??
      data.address.village ??
      data.address.municipality ??
      undefined;

    return {
      country: data.address.country,
      city,
    };
  } catch (error) {
    const geoError: GeoError = {
      type: 'geocoding_failed',
      message: 'No se pudo determinar tu ubicación desde las coordenadas',
    };
    throw geoError;
  }
}

/**
 * Full geolocation flow: get GPS coordinates, then reverse geocode them.
 * This is the main function called by the onboarding hook.
 *
 * @returns Country, city, and coordinates
 * @throws GeoError at any step
 */
export async function getFullLocation(): Promise<GeoLocationResult> {
  // Step 1: Get GPS coordinates (asks user for permission)
  const coords = await getCurrentPosition();

  // Step 2: Convert coordinates to country/city
  const { country, city } = await reverseGeocode(coords);

  return { country, city, coords };
}

// ─── Nominatim API Response Types ───

/**
 * Partial type for the Nominatim reverse geocoding API response.
 * We only define the fields we actually use.
 *
 * PARTIAL TYPING:
 * The full Nominatim response has many more fields, but we only
 * care about address.country and address.city/town/village.
 * In TypeScript, it's fine to only type what you need.
 */
interface NominatimAddress {
  country: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  state?: string;
}

interface NominatimResponse {
  address: NominatimAddress;
}
