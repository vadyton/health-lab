import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { importApi } from "../api/importApi";
import s from "./FileDropzone.module.scss";

interface Props {
  onUploaded: () => void;
}

export function FileDropzone({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [status,   setStatus]   = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [message,  setMessage]  = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const csvFiles = Array.from(files).filter(
      f => f.name.endsWith(".csv") || f.name.endsWith(".zip"),
    );
    if (!csvFiles.length) { setStatus("error"); setMessage("Только .csv файлы"); return; }

    setStatus("uploading");
    setMessage(`Загрузка ${csvFiles.length} файлов…`);

    try {
      const data = await importApi.uploadStoreCsv(csvFiles);
      setStatus("done");
      setMessage(`Загружено: ${data.saved.join(", ")}`);
      onUploaded();
    } catch (e: unknown) {
      setStatus("error");
      setMessage(`Ошибка: ${(e as Error).message}`);
    }
  };

  const onDrop   = (e: DragEvent<HTMLDivElement>)    => { e.preventDefault(); setDragging(false); upload(e.dataTransfer.files); };
  const onChange = (e: ChangeEvent<HTMLInputElement>) => upload(e.target.files);

  return (
    <div className={s.wrapper}>
      <div
        className={`${s.zone} ${dragging ? s.dragging : ""} ${status === "done" ? s.done : ""} ${status === "error" ? s.error : ""}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" multiple accept=".csv" className={s.input} onChange={onChange} />
        <div className={s.icon}>
          {status === "uploading" ? "⏳" : status === "done" ? "✅" : status === "error" ? "❌" : "📂"}
        </div>
        <div className={s.hint}>
          {status === "idle"      && <>Перетащите CSV-файлы из экспорта Mi Fitness<br /><small>или нажмите для выбора</small></>}
          {status === "uploading" && <span>{message}</span>}
          {status === "done"      && <span className={s.msgDone}>{message}</span>}
          {status === "error"     && <span className={s.msgErr}>{message}</span>}
        </div>
      </div>
    </div>
  );
}
