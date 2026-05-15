import { makeAutoObservable, computed } from "mobx";

type Range = "day" | "week" | "month" | "year";

function shift(date: string, range: Range, dir: -1 | 1): string {
  const d = new Date(date + "T12:00:00Z");
  switch (range) {
    case "day":   d.setUTCDate(d.getUTCDate() + dir);           break;
    case "week":  d.setUTCDate(d.getUTCDate() + dir * 7);       break;
    case "month": d.setUTCDate(d.getUTCDate() + dir * 30);      break;
    case "year":  d.setUTCFullYear(d.getUTCFullYear() + dir);   break;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * densityLevel: 0 = 100%, 1 = 50%, 2 = 25%, 3 = 12.5%, 4 = 6.25%
 * divisor = 2^densityLevel
 */
export class HeartRateStore {
  range:        Range   = "week";
  date:         string  = new Date().toISOString().slice(0, 10);
  densityLevel: number  = 0; // 0..4
  compare:      boolean = false;

  constructor() {
    makeAutoObservable(this, { compareDate: computed });
  }

  get compareDate(): string {
    return shift(this.date, this.range, -1);
  }

  get today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  get canGoForward(): boolean {
    return shift(this.date, this.range, 1) <= this.today;
  }

  /** Fraction of points to show (1 = all, 0.5 = half, etc.) */
  get density(): number {
    return 1 / Math.pow(2, this.densityLevel);
  }

  get densityLabel(): string {
    return `${Math.round(this.density * 100)}%`;
  }

  setRange(range: Range) {
    this.range = range;
    this.densityLevel = 0;
  }

  setDate(date: string) {
    this.date = date;
  }

  setDensityLevel(v: number) {
    this.densityLevel = Math.max(0, Math.min(4, v));
  }

  toggleCompare() {
    this.compare = !this.compare;
  }

  stepDate(dir: -1 | 1) {
    const next = shift(this.date, this.range, dir);
    if (next <= this.today) this.date = next;
  }
}
