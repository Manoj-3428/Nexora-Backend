/**
 * Geo helpers for pool discovery and location-privacy.
 */

const isValidLatitude = (lat) => typeof lat === 'number' && !Number.isNaN(lat) && lat >= -90 && lat <= 90;
const isValidLongitude = (lng) => typeof lng === 'number' && !Number.isNaN(lng) && lng >= -180 && lng <= 180;

const isValidCoordinates = (lat, lng) => isValidLatitude(lat) && isValidLongitude(lng);

/**
 * Convert a raw metre distance into a coarse, privacy-preserving proximity label.
 * We deliberately avoid returning other users'/pools' exact coordinates.
 */
const proximityLabel = (meters) => {
  if (meters == null) return 'Unknown';
  if (meters < 100) return 'Very close';
  if (meters < 500) return 'Nearby';
  if (meters < 1500) return 'Within range';
  if (meters <= 5000) return 'In area';
  return 'Far';
};

/**
 * Human-friendly distance string, rounded to reduce location precision leakage.
 * e.g. 412 -> "0.4 km away", 1830 -> "1.8 km away"
 */
const formatDistance = (meters) => {
  if (meters == null) return null;
  if (meters < 1000) {
    // round to nearest 50m
    const rounded = Math.round(meters / 50) * 50;
    return `${rounded} m away`;
  }
  return `${(meters / 1000).toFixed(1)} km away`;
};

module.exports = {
  isValidLatitude,
  isValidLongitude,
  isValidCoordinates,
  proximityLabel,
  formatDistance,
};
