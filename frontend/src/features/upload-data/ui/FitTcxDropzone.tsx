import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { importApi } from "../api/importApi";
import s from "./FileDropzone.module.scss";

type Result = { added: string[]; skipped: string[] };

export function FitTcxDropzone() {
  const queryClient = useQueryClient();
  const [dragging, setDragging] = useState(false);
  const [status,   setStatus]   = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [result,   setResult]   = useState<Result | null>(null);
  const [errMsg,   setErrMsg]   = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const valid = Array.from(files).filter(f =>
      f.name.toLowerCase().endsWith(".fit") || f.name.toLowerCase().endsWith(".tcx"),
    );
    if (!valid.length) { setStatus("error"); setErrMsg("Только .fit и .tcx файлы"); return; }

    setStatus("uploading");
    setResult(null);

    try {
      const data = await importApi.uploadFitTcx(valid);
      setResult(data);
      setStatus("done");
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    } catch (e: unknown) {
      setStatus("error");
      setErrMsg((e as Error).message);
    }
  };

  const onDrop   = (e: DragEvent<HTMLDivElement>)    => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); };
  const onChange = (e: ChangeEvent<HTMLInputElement>) => upload(e.target.files);

  const icon =
    status === "uploading" ? "⏳" :
    status === "done"      ? "✅" :
    status === "error"     ? "❌" : "📂";

  return (
    <div className={s.wrapper}>
      <div
        className={`${s.zone} ${dragging ? s.dragging : ""} ${status === "done" ? s.done : ""} ${status === "error" ? s.error : ""}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" multiple accept=".fit,.tcx" className={s.input} onChange={onChange} />
        <div className={s.icon}>{icon}</div>
        <div className={s.hint}>
          {status === "idle"     && <>Перетащите .fit или .tcx файлы<br /><small>или нажмите для выбора</small></>}
          {status === "uploading" && <span>Обработка файлов…</span>}
          {status === "done" && result && (
            <span className={s.msgDone}>
              Добавлено: {result.added.length}
              {result.skipped.length > 0 && ` · Пропущено (дубликаты): ${result.skipped.length}`}
            </span>
          )}
          {status === "error" && <span className={s.msgErr}>{errMsg}</span>}
        </div>
      </div>
    </div>
  );
}
