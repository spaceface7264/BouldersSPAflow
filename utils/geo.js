// Calculate distance between two coordinates using Haversine formula
export function calculateDistance(lat1, lon1, lat2, lon2) {
  // Validate inputs
  if (typeof lat1 !== 'number' || typeof lon1 !== 'number' ||
      typeof lat2 !== 'number' || typeof lon2 !== 'number' ||
      isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
    console.error('[Distance Calculation] Invalid coordinates:', { lat1, lon1, lat2, lon2 });
    return null;
  }

  // Validate coordinate ranges (lat: -90 to 90, lon: -180 to 180)
  if (lat1 < -90 || lat1 > 90 || lat2 < -90 || lat2 > 90) {
    console.error('[Distance Calculation] Invalid latitude (must be -90 to 90):', { lat1, lat2 });
    return null;
  }
  if (lon1 < -180 || lon1 > 180 || lon2 < -180 || lon2 > 180) {
    console.error('[Distance Calculation] Invalid longitude (must be -180 to 180):', { lon1, lon2 });
    return null;
  }

  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers

  return distance;
}

// Helper to create address key for lookup
export function createAddressKey(address) {
  if (!address) return null;
  // Normalize the address string
  const street = (address.street || '').trim();
  const postalCode = (address.postalCode || '').trim();
  const city = (address.city || '').trim();
  return `${street}, ${postalCode} ${city}`;
}

// Format distance for display
export function formatDistance(distance) {
  if (distance === null || distance === undefined) return '';
  if (distance < 1) {
    return `${Math.round(distance * 1000)} m`;
  }
  return `${distance.toFixed(1)} km`;
}
