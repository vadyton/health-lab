export interface GpsPoint {
  ts: number;    // Unix seconds
  lat: number;
  lng: number;
  altM?: number | null;
}

export interface RouteStats {
  distanceM: number;
  durationS: number;
  avgSpeed: number;    // m/s
  maxSpeed: number;    // m/s
  totalAscent: number;
  totalDescent: number;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calcRouteStats(points: GpsPoint[]): RouteStats | null {
  if (points.length < 2) return null;

  let distM = 0, ascent = 0, descent = 0, maxSpeedMs = 0;
  let speedSum = 0, speedCount = 0;

  for (let i = 1; i < points.length; i++) {
    const d = haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
    const dt = points[i].ts - points[i - 1].ts;
    distM += d;

    if (dt > 0 && dt < 300) { // ignore GPS gaps > 5 min
      const spd = d / dt;
      if (spd < 35) { // filter speeds > 126 km/h
        if (spd > maxSpeedMs) maxSpeedMs = spd;
        speedSum += spd;
        speedCount++;
      }
    }

    if (points[i].altM != null && points[i - 1].altM != null) {
      const dAlt = (points[i].altM as number) - (points[i - 1].altM as number);
      if (dAlt > 0.5) ascent += dAlt;
      else if (dAlt < -0.5) descent -= dAlt;
    }
  }

  const durationS = points[points.length - 1].ts - points[0].ts;
  const avgSpeedMs = durationS > 0 ? distM / durationS : (speedCount > 0 ? speedSum / speedCount : 0);

  return {
    distanceM:   Math.round(distM),
    durationS:   Math.max(0, durationS),
    avgSpeed:    Math.round(avgSpeedMs * 1000) / 1000,
    maxSpeed:    Math.round(maxSpeedMs * 1000) / 1000,
    totalAscent: Math.round(ascent),
    totalDescent: Math.round(descent),
  };
}
