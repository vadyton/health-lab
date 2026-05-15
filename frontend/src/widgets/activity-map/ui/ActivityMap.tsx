import { useEffect, useRef, useState, useMemo, useCallback, memo } from "react";
import type L from "leaflet";
import type { GpsPoint } from "@/entities/activity/model/types";
import { activitiesApi } from "@/entities/activity/api/activitiesApi";
import { fmtDuration } from "@/shared/lib/formatters";
import s from "./ActivityMap.module.scss";

// ── Time helpers ───────────────────────────────────────────────────────────

function fmtRelTime(ts: number, baseTs: number): string {
  const total = Math.max(0, Math.round(ts - baseTs));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function parseRelTime(str: string): number | null {
  const parts = str.trim().split(":").map(s => parseInt(s, 10));
  if (parts.some(isNaN) || parts.length < 2 || parts.length > 3) return null;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

// ── Time editor row (uncontrolled input — no re-render on keypress) ─────────

interface TeRowProps {
  pt: GpsPoint;
  rowIdx: number;
  globalIdx: number;
  baseTs: number;
  prevPt?: GpsPoint;
  warning: boolean;
  onCommit: (globalIdx: number, newTs: number) => void;
}

const TimeEditorRow = memo(function TimeEditorRow({
  pt, rowIdx, globalIdx, baseTs, prevPt, warning, onCommit,
}: TeRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep displayed value in sync after cascade shifts — without remounting
  useEffect(() => {
    if (inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.value = fmtRelTime(pt.ts, baseTs);
    }
  }, [pt.ts, baseTs]);

  const dtSec = prevPt ? pt.ts - prevPt.ts : null;
  const distM = prevPt ? haversine(prevPt.lat, prevPt.lng, pt.lat, pt.lng) : null;

  const commit = (val: string) => {
    const sec = parseRelTime(val);
    if (sec !== null && sec >= 0) onCommit(globalIdx, baseTs + sec);
  };

  return (
    <div className={`${s.teRow} ${warning ? s.teRowWarn : ""}`}>
      <span className={s.teIdx}>{rowIdx + 1}</span>
      <input
        ref={inputRef}
        className={s.teInput}
        defaultValue={fmtRelTime(pt.ts, baseTs)}
        title="Время от начала (м:сс или ч:мм:сс) — сдвинет все последующие точки"
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter") {
            commit((e.target as HTMLInputElement).value);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
      <span className={s.teDelta} title="Δ от предыдущей точки">
        {dtSec !== null
          ? dtSec >= 0
            ? `+${dtSec}с`
            : <span style={{ color: "var(--color-error)" }}>{dtSec}с</span>
          : "—"}
      </span>
      <span className={s.teDist} title="Расстояние от предыдущей">
        {distM !== null
          ? distM < 1000 ? `${Math.round(distM)}м` : `${(distM / 1000).toFixed(2)}км`
          : "—"}
      </span>
      <span className={s.teCoord}>
        {pt.lat.toFixed(5)}, {pt.lng.toFixed(5)}
      </span>
    </div>
  );
});

// ── Geo helpers ────────────────────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcStats(pts: GpsPoint[]) {
  if (pts.length < 2) return null;
  let distM = 0, asc = 0, desc = 0, maxSpd = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = haversine(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
    const dt = pts[i].ts - pts[i - 1].ts;
    distM += d;
    if (dt > 0 && dt < 300) { const spd = d / dt; if (spd < 35 && spd > maxSpd) maxSpd = spd; }
    if (pts[i].alt != null && pts[i - 1].alt != null) {
      const dA = pts[i].alt! - pts[i - 1].alt!;
      if (dA > 0.5) asc += dA; else if (dA < -0.5) desc -= dA;
    }
  }
  const dur = Math.max(0, pts[pts.length - 1].ts - pts[0].ts);
  return { distanceM: Math.round(distM), durationS: dur, avgSpeed: dur > 0 ? distM / dur : 0, maxSpeed: maxSpd, totalAscent: Math.round(asc), totalDescent: Math.round(desc) };
}

function downsampleArr<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const r: T[] = [arr[0]];
  const step = (arr.length - 1) / (max - 1);
  for (let i = 1; i < max - 1; i++) r.push(arr[Math.round(i * step)]);
  r.push(arr[arr.length - 1]);
  return r;
}

function avgTimeStep(pts: GpsPoint[]) {
  if (pts.length < 2) return 2;
  return Math.max(1, Math.round((pts[pts.length - 1].ts - pts[0].ts) / (pts.length - 1)));
}

// Approximate point-to-segment distance in degree-units (fine for small areas).
function distToSegment2D(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function nearestSegmentIdx(lat: number, lng: number, pts: GpsPoint[]) {
  let minDist = Infinity, bestIdx = -1;
  for (let i = 0; i < pts.length - 1; i++) {
    const d = distToSegment2D(lat, lng, pts[i].lat, pts[i].lng, pts[i + 1].lat, pts[i + 1].lng);
    if (d < minDist) { minDist = d; bestIdx = i; }
  }
  return { idx: bestIdx, dist: minDist };
}

// ── Elevation profile ──────────────────────────────────────────────────────

function ElevationProfile({ pts }: { pts: GpsPoint[] }) {
  const alts = useMemo(() => {
    const withAlt = pts.filter(p => p.alt != null);
    return downsampleArr(withAlt, 300).map(p => p.alt as number);
  }, [pts]);
  if (alts.length < 2) return null;
  let minA = alts[0], maxA = alts[0];
  for (const a of alts) { if (a < minA) minA = a; if (a > maxA) maxA = a; }
  const range = maxA - minA || 1;
  const W = 600, H = 56;
  const pathPts = alts.map((a, i) => {
    const x = (i / (alts.length - 1)) * W;
    const y = H - ((a - minA) / range) * (H - 6) - 3;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const d = `M ${pathPts[0]} L ${pathPts.slice(1).join(" L ")} L ${W},${H} L 0,${H} Z`;
  return (
    <div className={s.elev}>
      <div className={s.elevMeta}>
        <span className={s.elevTitle}>Профиль высоты</span>
        <span className={s.elevRange}>{Math.round(minA)}–{Math.round(maxA)} м</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={s.elevSvg}>
        <defs>
          <linearGradient id="eg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <path d={d} fill="url(#eg)" stroke="#3b82f6" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  activityId: string;
  points: GpsPoint[];
  onRecalculated: (trimmedPts: GpsPoint[], stats: {
    distanceM: number; durationS: number; avgSpeed: number;
    maxSpeed: number; totalAscent: number; totalDescent: number;
  }) => void;
}

type LType = typeof L;
type PanelMode = "trim" | "draw";
type DrawDir   = "append" | "prepend" | "insert";

// ── Main component ─────────────────────────────────────────────────────────

export function ActivityMap({ activityId, points, onRecalculated }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const fullLineRef  = useRef<L.Polyline | null>(null);
  const selLineRef   = useRef<L.Polyline | null>(null);
  const startMkRef   = useRef<L.CircleMarker | null>(null);
  const endMkRef     = useRef<L.CircleMarker | null>(null);
  const LRef         = useRef<LType | null>(null);

  const [pts, setPts]           = useState<GpsPoint[]>(points);
  const [startIdx, setStart]    = useState(0);
  const [endIdx, setEnd]        = useState(points.length - 1);
  const [trimMode, setTrimMode] = useState<"start" | "end">("start");
  const [panelMode, setPanelMode] = useState<PanelMode>("trim");
  const [drawDir, setDrawDir]   = useState<DrawDir>("append");
  const [fullscreen, setFullscreen] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [errMsg, setErrMsg]     = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  // Incremented after Leaflet map initialises so selection overlay renders on first load
  const [mapReady, setMapReady] = useState(0);
  const [showTimeEditor, setShowTimeEditor] = useState(false);

  // Keep mutable refs in sync for Leaflet click handler
  const ptsRef       = useRef(pts);
  const startRef     = useRef(startIdx);
  const endRef       = useRef(endIdx);
  const panelModeRef = useRef(panelMode);
  const trimModeRef  = useRef(trimMode);
  const drawDirRef   = useRef(drawDir);
  useEffect(() => { ptsRef.current       = pts; },       [pts]);
  useEffect(() => { startRef.current     = startIdx; },  [startIdx]);
  useEffect(() => { endRef.current       = endIdx; },    [endIdx]);
  useEffect(() => { panelModeRef.current = panelMode; }, [panelMode]);
  useEffect(() => { trimModeRef.current  = trimMode; },  [trimMode]);
  useEffect(() => { drawDirRef.current   = drawDir; },   [drawDir]);

  const selectedPts = useMemo(() => pts.slice(startIdx, endIdx + 1), [pts, startIdx, endIdx]);
  const liveStats   = useMemo(() => calcStats(selectedPts), [selectedPts]);
  const hasAlt      = useMemo(() => pts.some(p => p.alt != null), [pts]);
  const trimmed     = startIdx > 0 || endIdx < pts.length - 1;
  const isDirty     = trimmed || hasChanges;

  // ── Invalidate map size on fullscreen toggle ───────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => mapRef.current?.invalidateSize(), 80);
    return () => clearTimeout(timer);
  }, [fullscreen]);

  // ── Set map cursor based on mode ───────────────────────────────────────
  useEffect(() => {
    const el = mapRef.current?.getContainer();
    if (!el) return;
    el.style.cursor = panelMode === "draw" ? "crosshair" : "";
  }, [panelMode]);

  // ── Update full route line when pts change ─────────────────────────────
  useEffect(() => {
    if (!fullLineRef.current) return;
    fullLineRef.current.setLatLngs(pts.map(p => [p.lat, p.lng] as [number, number]));
  }, [pts]);

  // ── Init Leaflet map ───────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let map: L.Map;

    import("leaflet").then((leaflet) => {
      const L = (leaflet.default ?? leaflet) as LType;
      LRef.current = L;
      if (!containerRef.current) return;

      map = L.map(containerRef.current, { zoomControl: true });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const allPos = ptsRef.current.map(p => [p.lat, p.lng] as [number, number]);
      fullLineRef.current = L.polyline(allPos, { color: "#93c5fd", weight: 2, opacity: 0.5 }).addTo(map);
      if (allPos.length > 1) map.fitBounds(L.polyline(allPos).getBounds(), { padding: [20, 20] });

      // Signal that the map is ready so selection overlay effect re-runs
      setMapReady(v => v + 1);

      map.on("click", (e: L.LeafletMouseEvent) => {
        const curPts  = ptsRef.current;
        const panel   = panelModeRef.current;
        const tMode   = trimModeRef.current;
        const dir     = drawDirRef.current;

        if (panel === "trim") {
          // ── Trim: find nearest route point ────────────────────────
          let nearestIdx = 0, minDist = Infinity;
          for (let i = 0; i < curPts.length; i++) {
            const d = e.latlng.distanceTo([curPts[i].lat, curPts[i].lng] as L.LatLngTuple);
            if (d < minDist) { minDist = d; nearestIdx = i; }
          }
          if (minDist > 300) return;
          if (tMode === "start") {
            setStart(Math.min(nearestIdx, endRef.current));
            setTrimMode("end");
          } else {
            setEnd(Math.max(nearestIdx, startRef.current));
            setTrimMode("start");
          }
        } else {
          // ── Draw ─────────────────────────────────────────────────
          const step = avgTimeStep(curPts);
          const lat  = e.latlng.lat;
          const lng  = e.latlng.lng;

          if (dir === "append") {
            const newPt: GpsPoint = { lat, lng, ts: curPts[curPts.length - 1].ts + step };
            const newPts = [...curPts, newPt];
            setPts(newPts);
            setEnd(newPts.length - 1);
          } else if (dir === "prepend") {
            const newPt: GpsPoint = { lat, lng, ts: curPts[0].ts - step };
            const newPts = [newPt, ...curPts];
            setPts(newPts);
            setStart(0);
            setEnd(e => e + 1);
          } else {
            // insert: find nearest segment
            const { idx } = nearestSegmentIdx(lat, lng, curPts);
            if (idx < 0) return;
            const ts = Math.round((curPts[idx].ts + curPts[idx + 1].ts) / 2);
            const newPt: GpsPoint = { lat, lng, ts };
            const newPts = [...curPts.slice(0, idx + 1), newPt, ...curPts.slice(idx + 1)];
            setPts(newPts);
            if (startRef.current > idx) setStart(v => v + 1);
            if (endRef.current > idx) setEnd(v => v + 1);
          }
          setHasChanges(true);
        }
      });
    });

    return () => {
      map?.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Update selection overlay ───────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const L   = LRef.current;
    if (!map || !L) return;

    selLineRef.current?.remove();
    startMkRef.current?.remove();
    endMkRef.current?.remove();

    if (selectedPts.length < 2) return;

    const selPos = selectedPts.map(p => [p.lat, p.lng] as [number, number]);
    selLineRef.current = L.polyline(selPos, { color: "#2563eb", weight: 4, opacity: 0.9 }).addTo(map);
    startMkRef.current = L.circleMarker([selectedPts[0].lat, selectedPts[0].lng],
      { radius: 7, color: "#15803d", fillColor: "#22c55e", fillOpacity: 1, weight: 2 }).addTo(map);
    endMkRef.current = L.circleMarker(
      [selectedPts[selectedPts.length - 1].lat, selectedPts[selectedPts.length - 1].lng],
      { radius: 7, color: "#b91c1c", fillColor: "#ef4444", fillOpacity: 1, weight: 2 }).addTo(map);
  }, [selectedPts, mapReady]);

  // ── Commit timestamp edit — cascade-shift all subsequent points ────────
  const handleTimeCommit = useCallback((globalIdx: number, newTs: number) => {
    setPts(prev => {
      const delta = newTs - prev[globalIdx].ts;
      if (delta === 0) return prev;
      const next = [...prev];
      for (let i = globalIdx; i < next.length; i++) {
        next[i] = { ...next[i], ts: next[i].ts + delta };
      }
      return next;
    });
    setHasChanges(true);
  }, []);

  // ── Undo last drawn point ──────────────────────────────────────────────
  const handleUndo = useCallback(() => {
    if (pts.length <= 2) return;
    if (drawDir === "append") {
      setPts(p => p.slice(0, -1));
      setEnd(e => Math.max(0, e - 1));
    } else if (drawDir === "prepend") {
      setPts(p => p.slice(1));
      setEnd(e => Math.max(0, e - 1));
    } else {
      // Can't easily undo insert; just remove last-added (complex); skip for now
    }
  }, [pts.length, drawDir]);

  // ── Save ───────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true); setErrMsg("");
    try {
      const { stats } = await activitiesApi.updateRoute(activityId, selectedPts);
      if (stats) {
        onRecalculated(selectedPts, stats);
        setPts(selectedPts);
        setStart(0);
        setEnd(selectedPts.length - 1);
        setHasChanges(false);
      }
    } catch (e: unknown) {
      setErrMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setPts(points);
    setStart(0);
    setEnd(points.length - 1);
    setHasChanges(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className={`${s.root} ${fullscreen ? s.rootFullscreen : ""}`}>

      {/* Top bar: panel switcher + fullscreen */}
      <div className={s.topBar}>
        <div className={s.modeTabs}>
          <button className={`${s.modeTab} ${panelMode === "trim" ? s.modeTabActive : ""}`}
            onClick={() => setPanelMode("trim")}>
            ✂️ Обрезать
          </button>
          <button className={`${s.modeTab} ${panelMode === "draw" ? s.modeTabActive : ""}`}
            onClick={() => setPanelMode("draw")}>
            ✏️ Рисовать
          </button>
        </div>
        <button className={s.fullscreenBtn} onClick={() => setFullscreen(f => !f)}
          title={fullscreen ? "Свернуть" : "На весь экран"}>
          {fullscreen ? "⊡" : "⛶"}
        </button>
      </div>

      {/* Mode-specific controls */}
      {panelMode === "trim" ? (
        <div className={s.modeBar}>
          <span className={s.modeTip}>Нажмите на карту, чтобы задать</span>
          <button className={`${s.modeBtn} ${trimMode === "start" ? s.modeBtnActive : ""}`}
            onClick={() => setTrimMode("start")}>
            <span className={s.dotGreen} /> Начало
          </button>
          <button className={`${s.modeBtn} ${trimMode === "end" ? s.modeBtnActive : ""}`}
            onClick={() => setTrimMode("end")}>
            <span className={s.dotRed} /> Конец
          </button>
        </div>
      ) : (
        <div className={s.modeBar}>
          <span className={s.modeTip}>Клик — поставить точку:</span>
          <button className={`${s.modeBtn} ${drawDir === "prepend" ? s.modeBtnActive : ""}`}
            onClick={() => setDrawDir("prepend")}
            title="Добавить точки ДО начала маршрута (если начали движение раньше нажатия Старт)">
            ← До старта
          </button>
          <button className={`${s.modeBtn} ${drawDir === "append" ? s.modeBtnActive : ""}`}
            onClick={() => setDrawDir("append")}
            title="Добавить точки ПОСЛЕ конца маршрута">
            После финиша →
          </button>
          <button className={`${s.modeBtn} ${drawDir === "insert" ? s.modeBtnActive : ""}`}
            onClick={() => setDrawDir("insert")}
            title="Вставить точку в ближайший отрезок маршрута">
            ⊕ Вставить
          </button>
          {hasChanges && (drawDir === "append" || drawDir === "prepend") && (
            <button className={s.undoBtn} onClick={handleUndo} title="Отменить последнюю точку">↩</button>
          )}
        </div>
      )}

      {/* Map */}
      <div ref={containerRef} className={s.mapWrap} />

      {/* Sliders (trim mode only) */}
      {panelMode === "trim" && (
        <div className={s.sliders}>
          <div className={s.sliderRow}>
            <span className={s.dotGreen} />
            <span className={s.sliderLabel}>Начало</span>
            <input type="range" className={s.slider}
              min={0} max={pts.length - 2} value={startIdx}
              onChange={e => setStart(Math.min(Number(e.target.value), endIdx - 1))} />
            <span className={s.sliderVal}>{startIdx + 1} / {pts.length}</span>
          </div>
          <div className={s.sliderRow}>
            <span className={s.dotRed} />
            <span className={s.sliderLabel}>Конец</span>
            <input type="range" className={s.slider}
              min={1} max={pts.length - 1} value={endIdx}
              onChange={e => setEnd(Math.max(Number(e.target.value), startIdx + 1))} />
            <span className={s.sliderVal}>{endIdx + 1} / {pts.length}</span>
          </div>
        </div>
      )}

      {/* Draw mode info */}
      {panelMode === "draw" && (
        <div className={s.drawInfo}>
          {drawDir === "prepend" && "← До старта: кликайте на карте, чтобы добавить точки ДО начала маршрута (например, если начали движение раньше нажатия «Старт»)."}
          {drawDir === "append"  && "→ После финиша: кликайте на карте, чтобы добавить точки после конца маршрута."}
          {drawDir === "insert"  && "Вставить: кликайте рядом с маршрутом — точка вставится в ближайший отрезок."}
          {" "}Добавлено точек: {Math.abs(pts.length - points.length)}
        </div>
      )}

      {/* Live stats */}
      {liveStats && (
        <div className={s.stats}>
          <div className={s.stat}><span className={s.statVal}>{(liveStats.distanceM / 1000).toFixed(2)}</span><span className={s.statUnit}>км</span></div>
          <div className={s.stat}><span className={s.statVal}>{fmtDuration(liveStats.durationS)}</span><span className={s.statUnit}>время</span></div>
          <div className={s.stat}><span className={s.statVal}>{(liveStats.avgSpeed * 3.6).toFixed(1)}</span><span className={s.statUnit}>ср. км/ч</span></div>
          <div className={s.stat}><span className={s.statVal}>{(liveStats.maxSpeed * 3.6).toFixed(1)}</span><span className={s.statUnit}>макс. км/ч</span></div>
          {hasAlt && <div className={s.stat}><span className={s.statVal}>↑{liveStats.totalAscent}</span><span className={s.statUnit}>набор м</span></div>}
          {hasAlt && <div className={s.stat}><span className={s.statVal}>↓{liveStats.totalDescent}</span><span className={s.statUnit}>потеря м</span></div>}
        </div>
      )}

      {hasAlt && <ElevationProfile pts={selectedPts} />}

      {/* ── Time editor ──────────────────────────────────────────────────── */}
      <div className={s.teSection}>
        <button className={s.teToggle} onClick={() => setShowTimeEditor(v => !v)}>
          ⏱ Время точек {showTimeEditor ? "▲" : "▼"}
          <span className={s.teBadge}>{selectedPts.length}</span>
        </button>

        {showTimeEditor && (
          <div className={s.tePanel}>
            <div className={s.teHeader}>
              <span className={s.teColIdx}>#</span>
              <span className={s.teColTime}>Время от старта</span>
              <span className={s.teColDelta}>Δ пред.</span>
              <span className={s.teColDist}>Расст.</span>
              <span className={s.teColCoord}>Координаты</span>
            </div>
            <div className={s.teList}>
              {selectedPts.map((pt, rowIdx) => {
                const globalIdx = startIdx + rowIdx;
                const prevGlobal = globalIdx > 0 ? pts[globalIdx - 1] : undefined;
                const warning = rowIdx > 0 && pt.ts <= selectedPts[rowIdx - 1].ts;
                return (
                  <TimeEditorRow
                    key={globalIdx}
                    pt={pt}
                    rowIdx={rowIdx}
                    globalIdx={globalIdx}
                    baseTs={selectedPts[0].ts}
                    prevPt={prevGlobal}
                    warning={warning}
                    onCommit={handleTimeCommit}
                  />
                );
              })}
            </div>
            <div className={s.teHint}>
              Формат: <code>м:сс</code> или <code>ч:мм:сс</code> — Enter или клик вне поля для применения
            </div>
          </div>
        )}
      </div>

      {isDirty && (
        <div className={s.actions}>
          <button className={s.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Сохранение…" : "Сохранить маршрут и пересчитать"}
          </button>
          <button className={s.resetBtn} onClick={handleReset}>
            Сбросить все
          </button>
        </div>
      )}
      {errMsg && <div className={s.err}>Ошибка: {errMsg}</div>}
    </div>
  );
}
