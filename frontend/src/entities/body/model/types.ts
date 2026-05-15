export interface BodySample {
  time:          number;
  weightKg:      number;
  heightCm:      number | null;
  bmi:           number | null;
  fatRate:       number | null;
  bodyWaterRate: number | null;
  boneMassKg:    number | null;
  metabolism:    number | null;
  muscleRate:    number | null;
  visceralFat:   number | null;
}

export interface BodyResponse {
  samples:        BodySample[];
  latest:         BodySample | null;
  availableDates: string[];
}
