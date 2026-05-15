import { BaseApi } from "@/shared/api/BaseApi";
import type { SleepRecord, SleepSummary } from "../model/types";

class SleepApi extends BaseApi {
  summary = () =>
    this.get<SleepSummary[]>("/api/sleep/summary");

  getOne = (id: string) =>
    this.get<SleepRecord>(`/api/sleep/${id}`);

  list = (limit = 60, offset = 0) =>
    this.get<{ total: number; records: SleepRecord[] }>(
      `/api/sleep?limit=${limit}&offset=${offset}`,
    );
}

export const sleepApi = new SleepApi();
