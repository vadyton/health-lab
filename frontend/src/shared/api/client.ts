// Re-export token helpers so existing imports keep working
export { getToken, setToken } from "./BaseApi";

// ── Convenience singleton for one-off calls (backward compat) ─────────────
// Prefer using typed API class instances from entities/features.

import { BaseApi } from "./BaseApi";

class RawApi extends BaseApi {
  get  = <T>(url: string)                => super.get<T>(url);
  post = <T>(url: string, body: unknown) => super.post<T>(url, body);
  put  = <T>(url: string, body: unknown) => super.put<T>(url, body);
  delete = <T>(url: string)              => super.del<T>(url);
}

export const api = new RawApi();
