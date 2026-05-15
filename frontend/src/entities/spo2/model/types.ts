export interface Spo2Sample {
  time: number;
  spo2: number;
}

export interface Spo2Response {
  samples: Spo2Sample[];
  avg: number;
  min: number;
  max: number;
  availableDates: string[];
}
