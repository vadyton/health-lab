import { useRef, useState } from "react";
import { activitiesApi } from "@/entities/activity/api/activitiesApi";
import s from "./GpxUpload.module.scss";

interface RouteStats {
  distanceM: number;
  durationS: number;
  avgSpeed: number;
  maxSpeed: number;
  totalAscent: number;
  totalDescent: number;
}

interface Props {
  activityId: string;
  onApplied: (count: number, stats: RouteStats | null) => void;
}

type State = "idle" | "uploading" | "error";

export function GpxUpload({ activityId, onApplied }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>("idle");
  const [errMsg, setErrMsg] = useState("");

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.gpx$/i)) {
      setState("error");
      setErrMsg("Поддерживаются только .gpx файлы");
      return;
    }

    setState("uploading");
    setErrMsg("");

    try {
      const data = await activitiesApi.importGpx(activityId, file);
      setState("idle");
      onApplied(data.count, data.stats);
    } catch (e: unknown) {
      setState("error");
      setErrMsg((e as Error).message);
    }
  };

  return (
    <div className={s.root}>
      <input
        ref={inputRef} type="file" accept=".gpx"
        className={s.hidden}
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
      />

      {state === "uploading" ? (
        <span className={s.status}>⏳ Импорт…</span>
      ) : (
        <button className={s.btn} onClick={() => inputRef.current?.click()}>
          ⊕ Загрузить GPX маршрут
        </button>
      )}

      {state === "error" && <span className={s.error}>{errMsg}</span>}
    </div>
  );
}
