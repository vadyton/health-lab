import { makeAutoObservable } from "mobx";

type Range = "month" | "year" | "all";

function shift(date: string, range: Range, dir: -1 | 1): string {
  const d = new Date(date + "T12:00:00Z");
  switch (range) {
    case "month": d.setUTCDate(d.getUTCDate() + dir * 30);    break;
    case "year":  d.setUTCFullYear(d.getUTCFullYear() + dir); break;
    default:      break;
  }
  return d.toISOString().slice(0, 10);
}

export class BodyStore {
  range: Range  = "year";
  date:  string = new Date().toISOString().slice(0, 10);

  constructor() {
    makeAutoObservable(this);
  }

  get today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  get canGoForward(): boolean {
    if (this.range === "all") return false;
    return shift(this.date, this.range, 1) <= this.today;
  }

  setRange(range: Range) { this.range = range; }
  setDate(date: string)  { this.date  = date;  }

  stepDate(dir: -1 | 1) {
    if (this.range === "all") return;
    const next = shift(this.date, this.range, dir);
    if (next <= this.today) this.date = next;
  }
}
