import { XMLParser } from "fast-xml-parser";
import type { GpsPoint } from "./route-calculator";

const MAX_GPS = 5000;

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const result: T[] = [arr[0]];
  const step = (arr.length - 1) / (max - 1);
  for (let i = 1; i < max - 1; i++) result.push(arr[Math.round(i * step)]);
  result.push(arr[arr.length - 1]);
  return result;
}

interface RawPoint {
  lat: number;
  lng: number;
  altM?: number;
  time?: string;
}

function extractTrkpts(gpx: Record<string, unknown>): RawPoint[] {
  const tracks = toArray(gpx.trk);
  const points: RawPoint[] = [];

  for (const trk of tracks) {
    for (const seg of toArray((trk as Record<string, unknown>).trkseg)) {
      for (const pt of toArray((seg as Record<string, unknown>).trkpt)) {
        const p = pt as Record<string, unknown>;
        const lat = parseFloat(String(p["@_lat"] ?? ""));
        const lng = parseFloat(String(p["@_lon"] ?? ""));
        if (!isFinite(lat) || !isFinite(lng)) continue;
        points.push({
          lat, lng,
          altM: p.ele != null ? parseFloat(String(p.ele)) : undefined,
          time: p.time ? String(p.time) : undefined,
        });
      }
    }
  }

  if (points.length > 0) return points;

  // Fallback: route points
  for (const rte of toArray(gpx.rte)) {
    for (const pt of toArray((rte as Record<string, unknown>).rtept)) {
      const p = pt as Record<string, unknown>;
      const lat = parseFloat(String(p["@_lat"] ?? ""));
      const lng = parseFloat(String(p["@_lon"] ?? ""));
      if (!isFinite(lat) || !isFinite(lng)) continue;
      points.push({
        lat, lng,
        altM: p.ele != null ? parseFloat(String(p.ele)) : undefined,
        time: p.time ? String(p.time) : undefined,
      });
    }
  }

  return points;
}

function toArray(val: unknown): unknown[] {
  if (Array.isArray(val)) return val;
  if (val != null) return [val];
  return [];
}

export function parseGpx(content: string, fallbackStartTs?: number): GpsPoint[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    isArray: name => ["trk", "trkseg", "trkpt", "rte", "rtept", "wpt"].includes(name),
  });

  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(content);
  } catch {
    return [];
  }

  const gpx = doc?.gpx as Record<string, unknown> | undefined;
  if (!gpx) return [];

  const raw = extractTrkpts(gpx);
  if (raw.length === 0) return [];

  const hasAllTimes = raw.every(p => p.time);

  let points: GpsPoint[];
  if (hasAllTimes) {
    points = raw
      .map(p => ({
        ts:   Math.round(new Date(p.time!).getTime() / 1000),
        lat:  p.lat,
        lng:  p.lng,
        altM: p.altM,
      }))
      .filter(p => isFinite(p.ts) && p.ts > 0);
  } else {
    // No timestamps — space points 1s apart from activity start
    const baseTs = fallbackStartTs ?? Math.round(Date.now() / 1000);
    points = raw.map((p, i) => ({
      ts:   baseTs + i,
      lat:  p.lat,
      lng:  p.lng,
      altM: p.altM,
    }));
  }

  return downsample(points, MAX_GPS);
}
