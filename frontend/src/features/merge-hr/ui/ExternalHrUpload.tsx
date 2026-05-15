import { useRef, useState } from "react";
import type { HrSample } from "../model/hrMergeLogic";
import { HrMergeModal } from "./HrMergeModal";
import type { Activity } from "@/entities/activity/model/types";
import { activitiesApi } from "@/entities/activity/api/activitiesApi";
import s from "./ExternalHrUpload.module.scss";

interface Props {
  activity: Activity;
  onApplied: (avgHr: number, maxHr: number) => void;
}

type UploadState = "idle" | "uploading" | "ready" | "error";

export function ExternalHrUpload({ activity, onApplied }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState]           = useState<UploadState>("idle");
  const [errMsg, setErrMsg]         = useState("");
  const [extSamples, setExtSamples] = useState<HrSample[]>([]);
  const [extFilename, setExtFilename] = useState("");
  const [showModal, setShowModal]   = useState(false);

  const miBandSamples = activity.hrSamples ?? [];

  const handleFile = async (file: File) => {
    if (!file.name.match(/\.(tcx|fit|xml)$/i)) {
      setState("error");
      setErrMsg("Поддерживаются только .tcx и .fit файлы");
      return;
    }

    setState("uploading");
    setErrMsg("");

    try {
      const data = await activitiesApi.uploadExternalHr(activity.id, file);
      if (!data.samples) throw new Error(data.error ?? "Нет данных");
      if (data.count === 0) throw new Error("В файле не найдено данных о пульсе");

      setExtSamples(data.samples);
      setExtFilename(data.filename ?? file.name);
      setState("ready");
      setShowModal(true);
    } catch (e: unknown) {
      setState("error");
      setErrMsg((e as Error).message);
    }
  };

  return (
    <>
      <div className={s.root}>
        <input
          ref={inputRef} type="file" accept=".tcx,.fit,.xml"
          className={s.hidden}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />

        {state === "idle" || state === "error" ? (
          <button
            className={s.btn}
            onClick={() => inputRef.current?.click()}
          >
            ⊕ Загрузить внешний файл (TCX / FIT)
          </button>
        ) : state === "uploading" ? (
          <span className={s.status}>⏳ Загрузка…</span>
        ) : (
          <button className={s.btnReopen} onClick={() => setShowModal(true)}>
            ◈ {extFilename} — открыть слияние
          </button>
        )}

        {state === "error" && (
          <span className={s.error}>{errMsg}</span>
        )}
      </div>

      {showModal && extSamples.length > 0 && (
        <HrMergeModal
          activityId={activity.id}
          activityStart={activity.start}
          miBandSamples={miBandSamples}
          externalSamples={extSamples}
          externalFilename={extFilename}
          onClose={() => setShowModal(false)}
          onApplied={(avg, max) => {
            setShowModal(false);
            setState("idle");
            onApplied(avg, max);
          }}
        />
      )}
    </>
  );
}
