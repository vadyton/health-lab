import { makeAutoObservable } from "mobx";

export class DashboardStore {
  filterDate: string | undefined = undefined;
  filterSource: string | undefined = undefined;

  constructor() {
    makeAutoObservable(this);
  }

  setFilterDate(date: string | undefined) {
    this.filterDate = date;
  }

  setFilterSource(source: string | undefined) {
    this.filterSource = source;
  }

  clearFilter() {
    this.filterDate = undefined;
    this.filterSource = undefined;
  }
}
