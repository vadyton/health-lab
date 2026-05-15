export interface HrSample {
  time: number;
  bpm: number;
}

export interface HrDay {
  date: string;
  avg: number;
  min: number;
  max: number;
  samples?: HrSample[];
}

export interface HrResponse {
  samples?: HrSample[];
  days?: HrDay[];
  avg: number;
  min: number;
  max: number;
  availableDates: string[];
}
