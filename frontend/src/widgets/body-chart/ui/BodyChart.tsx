import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { BodySample } from "@/entities/body/model/types";

type Range = "month" | "year" | "all";

interface Props {
  samples: BodySample[];
  metric:  keyof Omit<BodySample, "time">;
  label:   string;
  unit:    string;
  color:   string;
  range:   Range;
}

function fmtLabel(time: number, range: Range): string {
  const d = new Date(time * 1000);
  if (range === "month") {
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getFullYear()).slice(2)}`;
}

export function BodyChart({ samples, metric, label, unit, color, range }: Props) {
  const data = samples
    .filter(s => s[metric] != null)
    .map(s => ({
      label:  fmtLabel(s.time, range),
      value:  s[metric] as number,
    }));

  if (!data.length) return null;

  const values = data.map(d => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max((max - min) * 0.15, 1);
  const tickInterval = Math.max(0, Math.floor(data.length / 8) - 1);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval || "preserveStartEnd"} />
        <YAxis
          tick={{ fontSize: 11 }}
          width={48}
          domain={[Math.floor(min - pad), Math.ceil(max + pad)]}
          tickFormatter={v => `${Number(v.toFixed(1))}`}
        />
        <Tooltip
          contentStyle={{ fontSize: 12, background: "var(--color-surface)", borderColor: "var(--color-border)" }}
          formatter={(v: number) => [`${Number(v.toFixed(1))} ${unit}`, label]}
        />
        <Legend formatter={() => label} />
        <Line
          type="monotone"
          dataKey="value"
          name={label}
          stroke={color}
          strokeWidth={2}
          dot={data.length <= 60}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
