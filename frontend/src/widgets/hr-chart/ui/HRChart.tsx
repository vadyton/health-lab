import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import { useMemo } from "react";
import type { HrSample } from "@/entities/heart-rate/model/types";

type Range = "day" | "week" | "month" | "year";

// ── Label formatting ───────────────────────────────────────────────────────

function fmtLabel(time: number, range: Range): string {
  const d = new Date(time * 1000);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  switch (range) {
    case "day":   return `${hh}:${mm}`;
    case "week":  return `${dd}.${mo} ${hh}:${mm}`;
    case "month": return `${dd}.${mo} ${hh}:00`;
    case "year":  return `${dd}.${mo}`;
  }
}

// ── Downsampling ───────────────────────────────────────────────────────────

/** Keep every N-th point (N = 2^level). Level 0 = all points. */
function downsample<T>(arr: T[], level: number): T[] {
  if (level <= 0 || arr.length === 0) return arr;
  const step = Math.pow(2, level);
  const result: T[] = [];
  for (let i = 0; i < arr.length; i += step) result.push(arr[i]);
  if (result[result.length - 1] !== arr[arr.length - 1]) result.push(arr[arr.length - 1]);
  return result;
}

// ── Main chart component ───────────────────────────────────────────────────

interface Props {
  samples: HrSample[];
  compareSamples?: HrSample[];
  compareLabel?: string;
  range?: Range;
  densityLevel?: number; // 0 = 100%, 1 = 50%, 2 = 25%, 3 = 12.5%, 4 = 6.25%
}

export function HRChart({ samples, compareSamples, compareLabel, range = "day", densityLevel = 0 }: Props) {
  const primary = useMemo(() => {
    const downsampled = downsample(samples, densityLevel);
    return downsampled.map(s => ({ label: fmtLabel(s.time, range), bpm: s.bpm }));
  }, [samples, range, densityLevel]);

  const compare = useMemo(() => {
    if (!compareSamples?.length) return null;
    const downsampled = downsample(compareSamples, densityLevel);
    return downsampled.map(s => ({ label: fmtLabel(s.time, range), bpm: s.bpm }));
  }, [compareSamples, range, densityLevel]);

  const data = primary.map((p, i) => ({
    label: p.label,
    bpm:   p.bpm,
    cmp:   compare?.[i]?.bpm,
  }));

  const tickInterval = Math.max(0, Math.floor(data.length / 12) - 1);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10 }}
          interval={tickInterval || "preserveStartEnd"}
        />
        <YAxis domain={["auto", "auto"]} tick={{ fontSize: 11 }} width={36} />
        <Tooltip
          contentStyle={{ fontSize: 12, background: "var(--color-surface)", borderColor: "var(--color-border)" }}
          formatter={(v: number, name: string) => [
            `${v} уд/мин`,
            name === "bpm" ? "Текущий период" : (compareLabel ?? "Предыдущий период"),
          ]}
        />
        {compare && (
          <Legend formatter={v => v === "bpm" ? "Текущий" : (compareLabel ?? "Предыдущий")} />
        )}
        <Line type="monotone" dataKey="bpm" stroke="#e53e3e" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
        {compare && (
          <Line type="monotone" dataKey="cmp" stroke="#e53e3e" strokeWidth={1.5}
            dot={false} strokeDasharray="4 3" strokeOpacity={0.5} />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}

// Keep legacy exports for activityPage HRDayChart usage
export function HRDayChart({ samples, compareSamples, compareLabel, windowMin = 1 }: {
  samples: HrSample[];
  compareSamples?: HrSample[];
  compareLabel?: string;
  windowMin?: number;
}) {
  const level = windowMin <= 1 ? 0 : Math.round(Math.log2(windowMin));
  return (
    <HRChart
      samples={samples}
      compareSamples={compareSamples}
      compareLabel={compareLabel}
      range="day"
      densityLevel={level}
    />
  );
}

export function HRAggChart(_props: unknown) { return null; }
