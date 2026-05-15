import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useMemo } from "react";
import type { Spo2Sample } from "@/entities/spo2/model/types";

type Range = "day" | "week" | "month" | "year";

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

function downsample<T>(arr: T[], level: number): T[] {
  if (level <= 0 || arr.length === 0) return arr;
  const step = Math.pow(2, level);
  const result: T[] = [];
  for (let i = 0; i < arr.length; i += step) result.push(arr[i]);
  if (result[result.length - 1] !== arr[arr.length - 1]) result.push(arr[arr.length - 1]);
  return result;
}

interface Props {
  samples: Spo2Sample[];
  range?: Range;
  densityLevel?: number;
}

export function Spo2Chart({ samples, range = "day", densityLevel = 0 }: Props) {
  const data = useMemo(() => {
    const ds = downsample(samples, densityLevel);
    return ds.map(s => ({ label: fmtLabel(s.time, range), spo2: s.spo2 }));
  }, [samples, range, densityLevel]);

  const tickInterval = Math.max(0, Math.floor(data.length / 10) - 1);
  const minVal = data.length ? Math.min(...data.map(d => d.spo2)) : 90;
  const yMin = Math.max(80, minVal - 3);

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval || "preserveStartEnd"} />
        <YAxis domain={[yMin, 100]} tick={{ fontSize: 11 }} width={40}
          tickFormatter={v => `${v}%`} />
        <Tooltip
          contentStyle={{ fontSize: 12, background: "var(--color-surface)", borderColor: "var(--color-border)" }}
          formatter={(v: number) => [`${v}%`, "SpO2"]}
        />
        <ReferenceLine y={95} stroke="#ed8936" strokeDasharray="4 2"
          label={{ value: "95%", position: "insideTopRight", fontSize: 10, fill: "#ed8936" }} />
        <Line type="monotone" dataKey="spo2" stroke="#6b46c1" strokeWidth={1.5}
          dot={false} activeDot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
