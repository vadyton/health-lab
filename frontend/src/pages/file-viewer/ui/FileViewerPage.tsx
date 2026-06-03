import { useRef, useState, lazy, Suspense, DragEvent, ChangeEvent } from "react";
import { importApi } from "@/features/upload-data/api/importApi";
import { HRDayChart } from "@/widgets/hr-chart/ui/HRChart";
import { fmtDuration, fmtDistance, fmtDate } from "@/shared/lib/formatters";
import { sportLabel, sportIcon } from "@/shared/lib/sportLabels";
import s from "./FileViewerPage.module.scss";

const RouteMap = lazy(() => import("./RouteMap").then(m => ({ default: m.RouteMap })));

interface GpsPoint { ts: number; lat: number; lng: number; alt?: number }
interface HrSample { time: number; bpm: number }
interface FileMeta {
  filename: string;
  type?: string;
  category?: string;
  durationS?: number;
  avgHr?: number;
  maxHr?: number;
  distanceM?: number;
  calories?: number;
  startTs?: string;
}

interface ParseResult {
  hrSamples: { ts: number; bpm: number }[];
  gpsPoints: GpsPoint[];
  meta: FileMeta;
  error?: string;
}

export function FileViewerPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);

  const parse = async (file: File) => {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".fit") && !lower.endsWith(".tcx") && !lower.endsWith(".gpx")) {
      setError("Поддерживаются только .fit, .tcx и .gpx файлы");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await importApi.parseFile(file);
      if (data.error) { setError(data.error); }
      else { setResult(data as unknown as ParseResult); }
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) parse(file);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parse(file);
    e.target.value = "";
  };

  const hrSamples: HrSample[] = result?.hrSamples.map(s => ({ time: s.ts, bpm: s.bpm })) ?? [];
  const meta = result?.meta;

  return (
    <div className={s.page}>
      <h1 className={s.title}>Просмотр файла</h1>

      {!result && (
        <div
          className={`${s.zone} ${dragging ? s.zoneDragging : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className={s.zoneIcon}>📂</div>
          <div className={s.zoneHint}>
            Перетащите файл сюда или нажмите для выбора<br />
            <strong>.fit · .tcx · .gpx</strong>
          </div>
          <input
            ref={inputRef}
            type="file"
            className={s.zoneInput}
            accept=".fit,.tcx,.gpx"
            onChange={onFileChange}
          />
        </div>
      )}

      {loading && <div className={s.loading}>Разбираем файл…</div>}
      {error && <div className={s.error}>{error}</div>}

      {result && (
        <>
          <div className={s.metaBar}>
            <span className={s.metaTitle}>
              {meta?.category ? `${sportIcon(meta.category)} ${sportLabel(meta.category)}` : "📄"}{" "}
              {meta?.filename}
            </span>
            {meta?.startTs && (
              <span className={s.metaStat}>
                🗓 <strong>{fmtDate(Math.round(new Date(meta.startTs).getTime() / 1000))}</strong>
              </span>
            )}
            {meta?.durationS != null && (
              <span className={s.metaStat}>
                ⏱ <strong>{fmtDuration(meta.durationS)}</strong>
              </span>
            )}
            {meta?.distanceM != null && (
              <span className={s.metaStat}>
                📍 <strong>{fmtDistance(meta.distanceM)}</strong>
              </span>
            )}
            {meta?.avgHr != null && (
              <span className={s.metaStat}>
                ❤️ <strong>{meta.avgHr}</strong> уд/мин ср.
              </span>
            )}
            {meta?.maxHr != null && (
              <span className={s.metaStat}>
                ❤️ <strong>{meta.maxHr}</strong> уд/мин макс.
              </span>
            )}
            {meta?.calories != null && (
              <span className={s.metaStat}>
                🔥 <strong>{meta.calories}</strong> ккал
              </span>
            )}
          </div>

          {result.gpsPoints.length > 0 && (
            <div className={s.section}>
              <div className={s.sectionTitle}>Маршрут · {result.gpsPoints.length} точек</div>
              <div className={s.mapWrap}>
                <Suspense fallback={<div className={s.loading}>Загружаем карту…</div>}>
                  <RouteMap points={result.gpsPoints} />
                </Suspense>
              </div>
            </div>
          )}

          {hrSamples.length > 0 && (
            <div className={s.section}>
              <div className={s.sectionTitle}>Пульс · {hrSamples.length} точек</div>
              <HRDayChart samples={hrSamples} />
            </div>
          )}

          {result.gpsPoints.length === 0 && hrSamples.length === 0 && (
            <div className={s.loading}>Файл не содержит GPS или пульсовых данных</div>
          )}

          <button className={s.resetBtn} onClick={() => { setResult(null); setError(""); }}>
            ← Открыть другой файл
          </button>
        </>
      )}
    </div>
  );
}
