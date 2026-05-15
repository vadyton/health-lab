import { BaseApi } from "@/shared/api/BaseApi";
import type { BodyResponse } from "../model/types";

class BodyApi extends BaseApi {
  query = (date: string, range: "month" | "year" | "all") =>
    this.get<BodyResponse>(`/api/body?date=${date}&range=${range}`);
}

export const bodyApi = new BodyApi();
