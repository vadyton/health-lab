import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { processApi, type ProcessEvent } from "../api/processApi";

export interface LogLine {
  type: "system" | "cmd" | "stdout" | "stderr" | "ok" | "err";
  text: string;
}

export function useProcess() {
  const queryClient = useQueryClient();
  const [running, setRunning] = useState(false);
  const [log,     setLog]     = useState<LogLine[]>([]);
  const [jobId,   setJobId]   = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const addLine = (type: LogLine["type"], text: string) =>
    setLog(prev => [...prev, { type, text }]);

  const run = async () => {
    if (running) return;
    setRunning(true);
    setLog([]);
    addLine("system", "Запуск обработки данных…");

    abortRef.current = new AbortController();
    try {
      await processApi.run((event: ProcessEvent) => {
        switch (event.type) {
          case "start":  addLine("cmd",    `$ ${event.command}`); break;
          case "job":    setJobId(String(event.id)); break;
          case "stdout": addLine("stdout", String(event.text ?? "").trimEnd()); break;
          case "stderr": addLine("stderr", String(event.text ?? "").trimEnd()); break;
          case "done":
            if (Number(event.exitCode) === 0) {
              addLine("ok", "✓ Обработка завершена успешно");
              queryClient.invalidateQueries();
            } else {
              const detail = event.signal ? `сигнал ${event.signal}` : `код ${event.exitCode}`;
              addLine("err", `✗ Ошибка (${detail})`);
            }
            break;
          case "error": addLine("err", `Ошибка: ${event.message}`); break;
        }
      }, abortRef.current.signal);
    } catch (e: unknown) {
      if ((e as Error).name !== "AbortError") {
        addLine("err", `Ошибка: ${(e as Error).message}`);
      }
    } finally {
      setRunning(false);
      setJobId(null);
    }
  };

  const stop = async () => {
    if (jobId) await processApi.cancel(jobId);
    abortRef.current?.abort();
    setRunning(false);
    setJobId(null);
    addLine("system", "Остановлено");
  };

  return { running, log, run, stop };
}
