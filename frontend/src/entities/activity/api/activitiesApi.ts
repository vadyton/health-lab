import { BaseApi } from "@/shared/api/BaseApi";
import type { Activity, ActivitySummary, ActivityFileEdit, GpsPoint } from "../model/types";
import type { HrSample } from "@/features/merge-hr/model/hrMergeLogic";

class ActivitiesApi extends BaseApi {
  list = (limit = 30, offset = 0, source?: string) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (source) params.set("source", source);
    return this.get<{ total: number; items: Activity[] }>(`/api/activities?${params}`);
  };

  summary = () =>
    this.get<ActivitySummary[]>("/api/activities/summary");

  getOne = (id: string) =>
    this.get<Activity>(`/api/activities/${id}`);

  update = (id: string, patch: { title?: string; notes?: string }) =>
    this.put<{ ok: boolean }>(`/api/activities/${id}`, patch);

  fileEdit = (id: string, patch: ActivityFileEdit) =>
    this.put<{ ok: boolean; hasTcx: boolean; hasFit: boolean }>(
      `/api/activities/${id}/file-edit`,
      patch,
    );

  updateRoute = (id: string, points: GpsPoint[]) =>
    this.put<{
      ok: boolean;
      stats: {
        distanceM: number; durationS: number;
        avgSpeed: number; maxSpeed: number;
        totalAscent: number; totalDescent: number;
      } | null;
    }>(
      `/api/activities/${id}/route`,
      { points: points.map(p => ({ ts: p.ts, lat: p.lat, lng: p.lng, altM: p.alt })) },
    );

  downloadFile = (id: string, format: "tcx" | "fit", filename?: string) =>
    this.download(
      `/api/activities/${id}/download?format=${format}`,
      filename ?? `activity-${id}.${format}`,
    );

  delete = (id: string) =>
    this.del<{ ok: boolean }>(`/api/activities/${id}`);

  attachHrFromDb = (id: string) =>
    this.post<{ count: number; avgHr: number; maxHr: number; samples: { time: number; bpm: number }[] }>(
      `/api/activities/${id}/attach-hr-from-db`,
      {},
    );

  importGpx = (activityId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return this.postForm<{ ok: boolean; count: number; stats: { distanceM: number; durationS: number; avgSpeed: number; maxSpeed: number; totalAscent: number; totalDescent: number } | null }>(
      `/api/activities/${activityId}/import-gpx`,
      form,
    );
  };

  /** Upload external HR file (TCX/FIT) for a given activity */
  uploadExternalHr = (activityId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return this.postForm<{
      samples?: HrSample[]; filename?: string; count?: number; error?: string;
    }>(`/api/activities/${activityId}/external-hr`, form);
  };

  /** Apply merged HR data */
  mergeHr = (
    activityId: string,
    strategy: string,
    externalSamples: HrSample[],
  ) =>
    this.post<{ ok: boolean; avgHr: number; maxHr: number }>(
      `/api/activities/${activityId}/merge-hr`,
      { strategy, externalSamples },
    );
}

export const activitiesApi = new ActivitiesApi();
