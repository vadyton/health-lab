export interface SleepStage {
  start: number;
  end: number;
  state: "light" | "deep" | "rem" | "awake";
}

export interface SleepSummary {
  id: string;
  bedtime: number;
  wakeUpTime: number;
  totalDuration: number;
  deepDuration: number;
  lightDuration: number;
  remDuration: number;
  score?: number;
  avgHr?: number;
}

export interface SleepRecord extends SleepSummary {
  minHr?: number;
  maxHr?: number;
  avgSpo2?: number;
  minSpo2?: number;
  awakeCount?: number;
  avgBreath?: number;
  stages?: SleepStage[];
}
