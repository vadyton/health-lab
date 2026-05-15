import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { importApi, type ImportProgressEvent } from "../api/importApi";
import s from "./FileDropzone.module.scss";
import ls from "./SqliteDropzone.module.scss";

interface StepState {
  label: string;
  current: number;
  total: number;
  done: boolean;
}

const STEP_ORDER  = ["heartRate", "spo2", "steps", "sleep", "activities"];
const STEP_LABELS: Record<string, string> = {
  heartRate: "Пульс", spo2: "SpO₂", steps: "Шаги",
  sleep: "Сон", activities: "Активности",
};

function fmt(n: number) { return n.toLocaleString("ru-RU"); }

export function SqliteDropzone() {
  const queryClient = useQueryClient();
  const [dragging, setDragging] = useState(false);
  const [status,   setStatus]   = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [steps,    setSteps]    = useState<Record<string, StepState>>({});
  const [errMsg,   setErrMsg]   = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const updateStep = (event: ImportProgressEvent) => {
    if (!event.step) return;
    setSteps(prev => ({
      ...prev,
      [event.step!]: {
        label:   event.label || STEP_LABELS[event.step!] || event.step!,
        current: event.current ?? 0,
        total:   event.total   ?? 0,
        done:    (event.current ?? 0) >= (event.total ?? 0) && (event.total ?? 0) > 0,
      },
    }));
  };

  const upload = async (files: FileList | null) => {
    const file = Array.from(files ?? []).find(f => f.name.endsWith(".db"));
    if (!file) { setStatus("error"); setErrMsg("Выберите файл .db"); return; }

    setStatus("uploading");
    setSteps({});
    setErrMsg("");

    try {
      await importApi.uploadSqlite(file, (event) => {
        if (event.type === "progress") {
          updateStep(event);
        } else if (event.type === "done") {
          setStatus("done");
          queryClient.invalidateQueries();
        } else if (event.type === "error") {
          setErrMsg(event.message ?? "Неизвестная ошибка");
          setStatus("error");
        }
      });
    } catch (e: unknown) {
      setErrMsg((e as Error).message);
      setStatus("error");
    }
  };

  const onDrop   = (e: DragEvent<HTMLDivElement>)    => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); };
  const onChange = (e: ChangeEvent<HTMLInputElement>) => upload(e.target.files);
  const isIdle   = status === "idle";

  return (
    <div className={ls.root}>
      {isIdle && (
        <div
          className={`${s.zone} ${dragging ? s.dragging : ""}`}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".db" className={s.input} onChange={onChange} />
          <div className={s.icon}>🗄️</div>
          <div className={s.hint}>
            Перетащите файл <strong>.db</strong> из Mi Fitness<br />
            <small>iPhone → Файлы → На моём iPhone → Mi Fitness → database → *.db</small>
          </div>
        </div>
      )}

      {(status === "uploading" || status === "done") && (
        <div className={ls.steps}>
          {STEP_ORDER.map(key => {
            const st = steps[key];
            if (!st && status === "uploading") {
              return (
                <div key={key} className={ls.stepRow}>
                  <span className={ls.stepLabel}>{STEP_LABELS[key]}</span>
                  <div className={ls.barWrap}><div className={`${ls.bar} ${ls.barPending}`} /></div>
                  <span className={ls.stepCount}>—</span>
                </div>
              );
            }
            if (!st) return null;
            const pct = st.total > 0 ? Math.min(100, Math.round(st.current / st.total * 100)) : 0;
            return (
              <div key={key} className={ls.stepRow}>
                <span className={ls.stepLabel}>{st.done ? "✓ " : ""}{st.label}</span>
                <div className={ls.barWrap}>
                  <div className={`${ls.bar} ${st.done ? ls.barDone : ls.barActive}`} style={{ width: `${pct}%` }} />
                </div>
                <span className={ls.stepCount}>
                  {st.done ? fmt(st.total) : `${fmt(st.current)} / ${fmt(st.total)}`}
                </span>
              </div>
            );
          })}
          {status === "done" && <p className={ls.doneMsg}>Импорт завершён</p>}
        </div>
      )}

      {status === "error" && (
        <div className={`${s.zone} ${s.error}`}>
          <div className={s.icon}>❌</div>
          <div className={s.hint}><span className={s.msgErr}>{errMsg}</span></div>
        </div>
      )}
    </div>
  );
}
