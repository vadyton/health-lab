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

export class StepsStore {
  range:   Range   = "week";
  date:    string  = new Date().toISOString().slice(0, 10);
  compare: boolean = false;

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

  setRange(range: Range) {
    this.range = range;
  }

  setDate(date: string) {
    this.date = date;
  }

  toggleCompare() {
    this.compare = !this.compare;
  }

  stepDate(dir: -1 | 1) {
    const next = shift(this.date, this.range, dir);
    if (next <= this.today) this.date = next;
  }
}
