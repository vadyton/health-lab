import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import type { StepsSample } from "@/entities/steps/model/types";

type Range = "day" | "week" | "month" | "year";

function fmtLabel(time: number, range: Range): string {
  const d = new Date(time * 1000);
  if (range === "day") {
    return `${String(d.getHours()).padStart(2, "0")}:00`;
  }
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface Props {
  samples: StepsSample[];
  compareSamples?: StepsSample[];
  compareLabel?: string;
  range: Range;
}

export function StepsChart({ samples, compareSamples, compareLabel, range }: Props) {
  const data = samples.map((s, i) => ({
    label: fmtLabel(s.time, range),
    steps: s.steps,
    cmp: compareSamples?.[i]?.steps ?? undefined,
  }));

  const tickInterval = Math.max(0, Math.floor(data.length / 10) - 1);
  const hasCmp = (compareSamples?.length ?? 0) > 0;

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }} barGap={2}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={tickInterval || "preserveStartEnd"} />
        <YAxis tick={{ fontSize: 11 }} width={50} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
        <Tooltip
          contentStyle={{ fontSize: 12, background: "var(--color-surface)", borderColor: "var(--color-border)" }}
          formatter={(v: number, name: string) => [
            v.toLocaleString("ru-RU") + " шагов",
            name === "steps" ? "Текущий период" : (compareLabel ?? "Предыдущий период"),
          ]}
        />
        {hasCmp && <Legend formatter={v => v === "steps" ? "Текущий" : (compareLabel ?? "Предыдущий")} />}
        <Bar dataKey="steps" name="steps" fill="#4299e1" radius={[3, 3, 0, 0]} maxBarSize={hasCmp ? 20 : 40} />
        {hasCmp && (
          <Bar dataKey="cmp" name="cmp" fill="#bee3f8" radius={[3, 3, 0, 0]} maxBarSize={20} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
