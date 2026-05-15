// ── Token helpers ──────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
}

// ── BaseApi class ──────────────────────────────────────────────────────────

export class BaseApi {

  private authHeader(): Record<string, string> {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  private handleUnauthorized() {
    setToken(null);
    window.dispatchEvent(new CustomEvent("auth:logout"));
  }

  // ── Core request ──────────────────────────────────────────────────────

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const r = await fetch(url, {
      ...init,
      headers: {
        ...this.authHeader(),
        ...(init?.headers as Record<string, string> ?? {}),
      },
    });

    if (r.status === 401) {
      this.handleUnauthorized();
      throw new Error("Unauthorized");
    }

    if (!r.ok) {
      let msg = `${r.status} ${r.statusText}`;
      try { const j = await r.json(); msg = j.message ?? msg; } catch {}
      throw new Error(msg);
    }

    return r.json() as Promise<T>;
  }

  // ── Standard HTTP methods ─────────────────────────────────────────────

  protected get<T>(url: string): Promise<T> {
    return this.request<T>(url);
  }

  protected post<T>(url: string, body: unknown): Promise<T> {
    return this.request<T>(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  protected postForm<T>(url: string, form: FormData): Promise<T> {
    return this.request<T>(url, { method: "POST", body: form });
  }

  protected put<T>(url: string, body: unknown): Promise<T> {
    return this.request<T>(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  protected del<T>(url: string): Promise<T> {
    return this.request<T>(url, { method: "DELETE" });
  }

  // ── File download ─────────────────────────────────────────────────────

  /** Fetch a binary file with auth, then trigger browser download dialog */
  protected async download(url: string, fallbackFilename: string): Promise<void> {
    const r = await fetch(url, { headers: this.authHeader() });

    if (r.status === 401) { this.handleUnauthorized(); throw new Error("Unauthorized"); }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);

    const cd = r.headers.get("content-disposition");
    const serverFilename = cd?.match(/filename="([^"]+)"/)?.[1];
    const filename = serverFilename ?? fallbackFilename;

    const blob = await r.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  }

  // ── SSE streaming helpers ─────────────────────────────────────────────

  /** POST FormData → SSE stream (для загрузки файлов с прогрессом) */
  protected async streamForm(
    url: string,
    form: FormData,
    onMessage: (data: object) => void,
  ): Promise<void> {
    const r = await fetch(url, {
      method: "POST",
      body: form,
      headers: this.authHeader(),
    });

    if (r.status === 401) { this.handleUnauthorized(); throw new Error("Unauthorized"); }
    if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);

    await this.readSse(r.body, onMessage);
  }

  /** POST JSON → SSE stream (для процессинга с AbortController) */
  protected async streamJson(
    url: string,
    body: unknown,
    onMessage: (data: object) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const r = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json", ...this.authHeader() },
      signal,
    });

    if (r.status === 401) { this.handleUnauthorized(); throw new Error("Unauthorized"); }
    if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);

    await this.readSse(r.body, onMessage);
  }

  /** DELETE с авторизацией, игнорируя ошибки (для отмены задач) */
  protected async deleteQuiet(url: string): Promise<void> {
    try {
      await fetch(url, { method: "DELETE", headers: this.authHeader() });
    } catch {}
  }

  // ── SSE parser ────────────────────────────────────────────────────────

  private async readSse(
    body: ReadableStream<Uint8Array>,
    onMessage: (data: object) => void,
  ): Promise<void> {
    const reader  = body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        const line = part.replace(/^data: /, "").trim();
        if (!line) continue;
        try { onMessage(JSON.parse(line)); } catch {}
      }
    }
  }
}
