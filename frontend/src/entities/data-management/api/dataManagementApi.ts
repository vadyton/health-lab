import { BaseApi } from "@/shared/api/BaseApi";

export interface SourceStats {
  heartRate:  number;
  steps:      number;
  sleep:      number;
  activities: number;
  body:       number;
}

export const SOURCE_LABELS: Record<string, string> = {
  zepp_life:  "Zepp Life",
  mi_fitness: "Mi Fitness",
};

class DataManagementApi extends BaseApi {
  getSourceStats = () =>
    this.get<Record<string, SourceStats>>("/api/data/sources");

  deleteSource = (source: string, types?: string[]) => {
    const params = new URLSearchParams({ source });
    if (types?.length) params.set("types", types.join(","));
    return this.del<Record<string, number>>(`/api/data/source?${params}`);
  };

  exportActivities = (format: "tcx" | "fit", sources?: string[]) => {
    const params = new URLSearchParams({ format });
    if (sources?.length) params.set("sources", sources.join(","));
    const suffix = sources?.length ? `_${sources.join("_")}` : "_all";
    const filename = `activities${suffix}_${new Date().toISOString().slice(0, 10)}.zip`;
    return this.download(`/api/data/export/activities?${params}`, filename);
  };
}

export const dataManagementApi = new DataManagementApi();
