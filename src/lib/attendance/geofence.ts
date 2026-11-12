export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface GeofenceEvaluation {
  distanceMeters: number;
  isWithinGeofence: boolean;
  accuracyAcceptable: boolean;
  needsException: boolean;
  exceptionReason: string | null;
}

const EARTH_RADIUS_M = 6371000;

/**
 * Computes great-circle Haversine distance in meters between two WGS-84 coordinates.
 */
export function haversineDistanceMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLng * sinDLng;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(EARTH_RADIUS_M * c * 100) / 100;
}

/**
 * Evaluates a GPS check-in event against a company location's Geofence radius.
 * Drivers or off-site workers with `workMode === 'REMOTE_DUTY'` log their coordinates
 * without raising an out-of-geofence exception.
 */
export function evaluateGpsCheckin(params: {
  userPoint: GeoPoint;
  locationCenter: GeoPoint;
  geofenceRadiusMeters: number;
  accuracyMeters: number;
  workMode: "ONSITE" | "REMOTE_DUTY";
}): GeofenceEvaluation {
  const distanceMeters = haversineDistanceMeters(params.userPoint, params.locationCenter);
  const isWithinGeofence = distanceMeters <= params.geofenceRadiusMeters;
  const accuracyAcceptable = params.accuracyMeters <= 100;

  if (params.workMode === "REMOTE_DUTY") {
    return {
      distanceMeters,
      isWithinGeofence,
      accuracyAcceptable,
      needsException: false,
      exceptionReason: null,
    };
  }

  if (!isWithinGeofence) {
    return {
      distanceMeters,
      isWithinGeofence: false,
      accuracyAcceptable,
      needsException: true,
      exceptionReason: `Khoảng cách ${distanceMeters}m vượt bán kính Geofence ${params.geofenceRadiusMeters}m.`,
    };
  }

  if (!accuracyAcceptable) {
    return {
      distanceMeters,
      isWithinGeofence: true,
      accuracyAcceptable: false,
      needsException: true,
      exceptionReason: `Sai số GPS ${params.accuracyMeters}m vượt ngưỡng cho phép 100m.`,
    };
  }

  return {
    distanceMeters,
    isWithinGeofence: true,
    accuracyAcceptable: true,
    needsException: false,
    exceptionReason: null,
  };
}

