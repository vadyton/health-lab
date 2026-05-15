import { BaseApi } from "@/shared/api/BaseApi";
import type { Spo2Response } from "../model/types";

class Spo2Api extends BaseApi {
  query = (date: string, range: "day" | "week" | "month" | "year") =>
    this.get<Spo2Response>(`/api/spo2?date=${date}&range=${range}`);
}

export const spo2Api = new Spo2Api();
