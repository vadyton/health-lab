import { makeAutoObservable } from "mobx";

type Period = "week" | "month" | "year";

function shiftDate(dateStr: string, period: Period, dir: -1 | 1): string {
  const d = new Date(dateStr + "T12:00:00Z");
  if (period === "week")  d.setUTCDate(d.getUTCDate() + dir * 7);
  if (period === "month") d.setUTCDate(d.getUTCDate() + dir * 30);
  if (period === "year")  d.setUTCFullYear(d.getUTCFullYear() + dir);
  return d.toISOString().slice(0, 10);
}

export class SleepStore {
  period:       Period  = "month";
  anchorDate:   string  = new Date().toISOString().slice(0, 10); // end of current period
  selectedDate: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  get today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  get anchorTs(): number {
    return Math.floor(new Date(this.anchorDate + "T23:59:59Z").getTime() / 1000);
  }

  get canGoForward(): boolean {
    return shiftDate(this.anchorDate, this.period, 1) <= this.today;
  }

  setPeriod(period: Period) {
    this.period = period;
    this.anchorDate = this.today;
  }

  setAnchorDate(date: string) {
    this.anchorDate = date <= this.today ? date : this.today;
  }

  stepPeriod(dir: -1 | 1) {
    const next = shiftDate(this.anchorDate, this.period, dir);
    if (next <= this.today) this.anchorDate = next;
  }

  setSelectedDate(date: string | null) {
    this.selectedDate = date;
  }
}
