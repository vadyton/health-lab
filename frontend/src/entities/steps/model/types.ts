export interface DailySteps {
  date: string;
  steps: number;
  distance: number;
  calories: number;
  goal?: number;
}

export interface StepsSample {
  time: number;
  steps: number;
  distance: number;
  calories: number;
}

export interface StepsResponse {
  samples: StepsSample[];
  total: number;
  distance: number;
  calories: number;
  goal?: number;
  availableDates: string[];
}
