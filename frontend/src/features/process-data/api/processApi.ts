import { BaseApi } from "@/shared/api/BaseApi";

export interface ProcessEvent {
  type: "start" | "job" | "stdout" | "stderr" | "done" | "error";
  command?: string;
  id?: string | number;
  text?: string;
  exitCode?: number;
  signal?: string;
  message?: string;
}

class ProcessApi extends BaseApi {
  /** Start a store processing job — SSE stream */
  run = (
    onMessage: (event: ProcessEvent) => void,
    signal?: AbortSignal,
  ) =>
    this.streamJson("/api/store/process", {}, onMessage as (d: object) => void, signal);

  /** Cancel a running job (fire-and-forget) */
  cancel = (jobId: string) =>
    this.deleteQuiet(`/api/store/process/${jobId}`);
}

export const processApi = new ProcessApi();
