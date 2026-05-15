export interface GpsPoint {
  ts: number;
  lat: number;
  lng: number;
  alt?: number;
}

export interface HrZones {
  warmUp: number;
  fatBurn: number;
  aerobic: number;
  anaerobic: number;
  extreme: number;
}

export interface HrSample {
  time: number;
  bpm: number;
}

export interface ActivityOverrides {
  sport?: string;
  title?: string;
  notes?: string;
  calories?: number;
  avgHr?: number;
  maxHr?: number;
  trainLoad?: number;
  trainEffect?: number;
  recoverTime?: number;
  distanceM?: number;
  vo2Max?: number;
  avgSpeed?: number;   // m/s
  maxSpeed?: number;   // m/s
  avgCadence?: number;
  maxCadence?: number;
  avgPower?: number;   // watts
  maxPower?: number;   // watts
  totalAscent?: number;
  totalDescent?: number;
}

export type ActivityFileEdit = ActivityOverrides;

export interface ActivitySummary {
  id: string;
  category: string;
  start: number;
  title: string;
  duration: number;   // seconds
  calories: number;
  distanceM: number;  // meters
}

export interface Activity {
  id: string;
  category: string;
  categoryOriginal: string;
  start: number;
  end: number;
  duration: number;
  calories: number;
  avgHr?: number;
  maxHr?: number;
  minHr?: number;
  trainLoad?: number;
  trainEffect?: number;
  trainLoadLevel?: number;
  recoverTime?: number;
  distanceM?: number;
  vo2Max?: number;
  avgSpeed?: number;   // m/s
  maxSpeed?: number;   // m/s
  avgCadence?: number;
  maxCadence?: number;
  avgPower?: number;   // watts
  maxPower?: number;   // watts
  totalAscent?: number;
  totalDescent?: number;
  hrZones?: HrZones;
  title?: string;
  notes?: string;
  sid: string;
  uid: string;
  source?: string;
  hrSamples?: HrSample[];
  gpsPoints?: GpsPoint[];
  hasTcx?: boolean;
  hasFit?: boolean;
  overrides?: ActivityOverrides;
}
