import { BaseApi } from "@/shared/api/BaseApi";

export interface ImportProgressEvent {
  type: "start" | "progress" | "done" | "error";
  step?: string;
  label?: string;
  current?: number;
  total?: number;
  stats?: Record<string, number>;
  message?: string;
}

class ImportApi extends BaseApi {
  /** Upload Mi Fitness SQLite .db — SSE stream with progress events */
  uploadSqlite = (
    file: File,
    onMessage: (event: ImportProgressEvent) => void,
  ) => {
    const form = new FormData();
    form.append("file", file);
    return this.streamForm("/api/import/sqlite", form, onMessage as (d: object) => void);
  };

  /** Upload FIT / TCX workout files */
  uploadFitTcx = (files: File[]) => {
    const form = new FormData();
    files.forEach(f => form.append("files", f));
    return this.postForm<{ added: string[]; skipped: string[] }>(
      "/api/import/upload-fit-tcx",
      form,
    );
  };

  /** Upload Zepp Life export ZIP — SSE stream with progress events */
  uploadZeppZip = (
    file: File,
    onMessage: (event: ImportProgressEvent) => void,
    password?: string,
  ) => {
    const form = new FormData();
    form.append("file", file);
    if (password) form.append("password", password);
    return this.streamForm("/api/import/zepp-zip", form, onMessage as (d: object) => void);
  };

  /** Upload raw CSV store files */
  uploadStoreCsv = (files: File[]) => {
    const form = new FormData();
    files.forEach(f => form.append("files", f));
    return this.postForm<{ saved: string[] }>("/api/store/upload", form);
  };
}

export const importApi = new ImportApi();
