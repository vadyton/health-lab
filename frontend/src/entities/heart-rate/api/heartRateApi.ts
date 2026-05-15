import { BaseApi } from "@/shared/api/BaseApi";
import type { HrResponse } from "../model/types";

class HeartRateApi extends BaseApi {
  query = (date: string, range: "day" | "week" | "month" | "year") =>
    this.get<HrResponse>(`/api/heart-rate?date=${date}&range=${range}`);
}

export const heartRateApi = new HeartRateApi();
