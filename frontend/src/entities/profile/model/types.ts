export interface UserProfile {
  gender?: "male" | "female" | "other";
  dateOfBirth?: string;     // YYYY-MM-DD
  height?: number;          // cm
  weight?: number;          // kg
  restingHr?: number;       // bpm
  maxHr?: number;           // bpm (if not set: estimated as 220 - age)
  walkingStepLength?: number; // cm
  runningStrideLength?: number; // cm (one full stride = 2 steps)
  vo2max?: number;           // ml/kg/min
}
