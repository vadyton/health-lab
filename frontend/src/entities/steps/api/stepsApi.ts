import { BaseApi } from "@/shared/api/BaseApi";
import type { StepsResponse } from "../model/types";

class StepsApi extends BaseApi {
  query = (date: string, range: "day" | "week" | "month" | "year") =>
    this.get<StepsResponse>(`/api/steps?date=${date}&range=${range}`);
}

export const stepsApi = new StepsApi();
