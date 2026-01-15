import { calculateDistance, createAddressKey } from './geo.js';

// Hardcoded coordinates for known Boulders gyms (verified and updated for accuracy)
// Format: "Street, PostalCode City" -> { latitude, longitude }
const GYM_COORDINATES = {
  'Skjernvej 4D, 9220 Aalborg': { latitude: 57.0488, longitude: 9.9217 },
  'Søren Frichs Vej 54, 8230 Aarhus': { latitude: 56.15101, longitude: 10.16778 }, // Boulders Aarhus Aaby
  'Ankersgade 12, 8000 Aarhus': { latitude: 56.14836, longitude: 10.19124 }, // Boulders Aarhus City
  'Graham Bells Vej 18A, 8200 Aarhus': { latitude: 56.20514, longitude: 10.18169 }, // Boulders Aarhus Nord
  'Søren Nymarks Vej 6A, 8270 Aarhus': { latitude: 56.1075, longitude: 10.2039 }, // Boulders Aarhus Syd
  'Amager Landevej 233, 2770 København': { latitude: 55.6500, longitude: 12.5833 },
  'Strandmarksvej 20, 2650 København': { latitude: 55.6500, longitude: 12.4833 },
  'Bådehavnsgade 38, 2450 København': { latitude: 55.6500, longitude: 12.5500 },
  'Wichmandsgade 11, 5000 Odense': { latitude: 55.40252, longitude: 10.37333 }, // Verified via Nominatim
  'Vigerslev Allé 47, 2500 København': { latitude: 55.6667, longitude: 12.5167 },
  'Vanløse Torv 1, Kronen Vanløse, 2720 København': { latitude: 55.6833, longitude: 12.4833 },
  'Vesterbrogade 149, 1620 København V': { latitude: 55.6761, longitude: 12.5683 },
};

const geocodeCache = new Map();
const noop = () => {};

const getLogger = (logger) => ({
  log: logger?.log ?? noop,
  warn: logger?.warn ?? noop,
});

export function isGeolocationAvailable() {
  return 'geolocation' in navigator;
}

export async function checkGeolocationPermission() {
  if (!isGeolocationAvailable()) {
    return 'not-supported';
  }

  // Note: Permission API is not widely supported, so we'll try to get location
  // and handle the error if permission is denied.
  return 'unknown';
}

export async function getUserLocation({ logger } = {}) {
  const { log } = getLogger(logger);

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    const options = {
      enableHighAccuracy: true,
      timeout: 15000, // Increased timeout
      maximumAge: 60000, // Allow 1 minute old cached position
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy, // in meters
        };

        log('[Geolocation] User location obtained:', {
          coordinates: { lat: location.latitude, lon: location.longitude },
          accuracy: `${location.accuracy.toFixed(0)} meters`,
        });

        resolve(location);
      },
      (error) => {
        let errorMessage = 'Unable to get your location';
        let errorType = 'unknown';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Location access denied. Please allow location access in your browser settings and try again.';
            errorType = 'permission-denied';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable. Please check your device location settings and try again.';
            errorType = 'unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out. Please check your connection and try again.';
            errorType = 'timeout';
            break;
        }

        const errorObj = new Error(errorMessage);
        errorObj.type = errorType;
        errorObj.originalError = error;
        reject(errorObj);
      },
      options
    );
  });
}

function findGymCoordinates(address) {
  if (!address) return null;

  const addressKey = createAddressKey(address);
  if (!addressKey) return null;

  if (GYM_COORDINATES[addressKey]) {
    return GYM_COORDINATES[addressKey];
  }

  const street = address.street?.trim();
  const postalCode = address.postalCode?.trim();

  if (street && postalCode) {
    for (const [key, coords] of Object.entries(GYM_COORDINATES)) {
      if (key.includes(street) && key.includes(postalCode)) {
        return coords;
      }
    }
  }

  return null;
}

async function geocodeAddress(address, { logger } = {}) {
  const { log, warn } = getLogger(logger);

  if (!address) return null;

  const hardcodedCoords = findGymCoordinates(address);
  if (hardcodedCoords) {
    const addressKey = createAddressKey(address);
    log(`[Geocoding] Using hardcoded coordinates for: ${addressKey}`);
    return hardcodedCoords;
  }

  const addressKey = createAddressKey(address);
  if (!addressKey) return null;

  if (geocodeCache.has(addressKey)) {
    return geocodeCache.get(addressKey);
  }

  try {
    const query = encodeURIComponent(`${address.postalCode} ${address.city}, ${address.street}, Denmark`);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=dk&addressdetails=1&extratags=1&zoom=18`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Boulders Membership Signup',
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.status}`);
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const result = data[0];
      const coords = {
        latitude: parseFloat(result.lat),
        longitude: parseFloat(result.lon),
      };

      log(`[Geocoding] Geocoded ${addressKey}:`, {
        coordinates: coords,
        displayName: result.display_name,
        importance: result.importance,
        type: result.type,
      });

      geocodeCache.set(addressKey, coords);
      await new Promise(resolve => setTimeout(resolve, 1100));

      return coords;
    }

    return null;
  } catch (error) {
    warn('[Geocoding] Failed to geocode address:', addressKey, error);
    return null;
  }
}

export async function calculateGymDistances(
  gyms,
  userLat,
  userLon,
  userAccuracy = null,
  { logger } = {}
) {
  const { log, warn } = getLogger(logger);

  log('[Distance Calculation] User location:', {
    latitude: userLat,
    longitude: userLon,
    accuracy: userAccuracy ? `${userAccuracy.toFixed(0)} meters` : 'unknown',
  });

  if (userAccuracy && userAccuracy > 1000) {
    warn('[Distance Calculation] WARNING: Low location accuracy detected. Distance calculations may be inaccurate.', {
      accuracy: `${userAccuracy.toFixed(0)} meters`,
      note: 'This suggests IP-based geolocation rather than GPS. Distances may be off by hundreds of kilometers.',
    });
  }

  const gymsWithCoords = await Promise.all(gyms.map(async (gym) => {
    let gymLat = null;
    let gymLon = null;

    if (gym.address) {
      if (gym.address.latitude !== undefined && gym.address.longitude !== undefined) {
        gymLat = parseFloat(gym.address.latitude);
        gymLon = parseFloat(gym.address.longitude);
      } else if (gym.address.coordinates && Array.isArray(gym.address.coordinates)) {
        gymLat = parseFloat(gym.address.coordinates[1]);
        gymLon = parseFloat(gym.address.coordinates[0]);
      }
    }

    if ((gymLat === null || isNaN(gymLat)) && gym.coordinates && Array.isArray(gym.coordinates)) {
      gymLat = parseFloat(gym.coordinates[1]);
      gymLon = parseFloat(gym.coordinates[0]);
    }

    if (isNaN(gymLat) || isNaN(gymLon)) {
      gymLat = null;
      gymLon = null;
    }

    if ((gymLat === null || gymLon === null) && gym.address) {
      log(`[Distance Calculation] Geocoding ${gym.name}...`);
      const coords = await geocodeAddress(gym.address, { logger });
      if (coords) {
        gymLat = coords.latitude;
        gymLon = coords.longitude;
        log(`[Distance Calculation] Geocoded ${gym.name}:`, coords);
      } else {
        warn(`[Distance Calculation] Failed to geocode ${gym.name}`);
      }
    }

    return { ...gym, gymLat, gymLon };
  }));

  const gymsWithDistances = gymsWithCoords.map(gym => {
    if (gym.gymLat === null || gym.gymLon === null || isNaN(gym.gymLat) || isNaN(gym.gymLon)) {
      return { ...gym, distance: null };
    }

    const distance = calculateDistance(
      userLat,
      userLon,
      gym.gymLat,
      gym.gymLon
    );

    log(`[Distance Calculation] ${gym.name}:`, {
      userLocation: { lat: userLat, lon: userLon },
      gymLocation: { lat: gym.gymLat, lon: gym.gymLon },
      distance: `${distance.toFixed(2)} km`,
      address: gym.address ? `${gym.address.street}, ${gym.address.postalCode} ${gym.address.city}` : 'N/A',
      coordinateValidation: {
        userLatValid: userLat >= -90 && userLat <= 90,
        userLonValid: userLon >= -180 && userLon <= 180,
        gymLatValid: gym.gymLat >= -90 && gym.gymLat <= 90,
        gymLonValid: gym.gymLon >= -180 && gym.gymLon <= 180,
      },
    });

    return { ...gym, distance };
  });

  const sorted = gymsWithDistances.sort((a, b) => {
    if (a.distance === null && b.distance === null) return 0;
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  });

  log('[Distance Calculation] Sorted gyms:', sorted.map(g => ({
    name: g.name,
    distance: g.distance !== null ? `${g.distance.toFixed(2)} km` : 'N/A',
  })));

  return sorted;
}
