import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";
import type { SleepSummary } from "@/entities/sleep/model/types";

export interface SleepChartPoint {
  date: string;
  deep: number;
  rem: number;
  light: number;
  total: number;
  score?: number;
}

type Period = "week" | "month" | "year";

function groupByWeek(records: SleepSummary[]): SleepChartPoint[] {
  const weeks = new Map<string, SleepSummary[]>();
  for (const r of records) {
    const d = new Date(r.bedtime * 1000);
    const dow = d.getUTCDay();
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key)!.push(r);
  }
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
  return Array.from(weeks.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, recs]) => ({
      date:  new Date(key + "T12:00:00Z").toLocaleDateString("ru", { month: "short", day: "numeric" }),
      deep:  +(avg(recs.map(r => r.deepDuration))  / 60).toFixed(1),
      rem:   +(avg(recs.map(r => r.remDuration))   / 60).toFixed(1),
      light: +(avg(recs.map(r => r.lightDuration)) / 60).toFixed(1),
      total: +(avg(recs.map(r => r.totalDuration)) / 60).toFixed(1),
    }));
}

export function buildChartData(summary: SleepSummary[], period: Period, anchorTs?: number): SleepChartPoint[] {
  const anchor = anchorTs ?? Math.floor(Date.now() / 1000);
  const showDays = period === "week" ? 7 : period === "month" ? 30 : 365;
  const cutoff = anchor - showDays * 86400;
  const inRange = [...summary].filter(r => r.bedtime >= cutoff && r.bedtime <= anchor + 86400).reverse();

  if (period === "year") {
    return inRange.map(r => ({
      date:  new Date(r.bedtime * 1000).toLocaleDateString("ru", { month: "short", day: "numeric" }),
      deep:  +(r.deepDuration  / 60).toFixed(1),
      rem:   +(r.remDuration   / 60).toFixed(1),
      light: +(r.lightDuration / 60).toFixed(1),
      total: +(r.totalDuration / 60).toFixed(1),
      score: r.score,
    }));
  }

  return inRange.map(r => ({
    date:  new Date(r.bedtime * 1000).toLocaleDateString("ru", { month: "short", day: "numeric" }),
    deep:  +(r.deepDuration  / 60).toFixed(1),
    rem:   +(r.remDuration   / 60).toFixed(1),
    light: +(r.lightDuration / 60).toFixed(1),
    total: +(r.totalDuration / 60).toFixed(1),
    score: r.score,
  }));
}

interface Props {
  data: SleepChartPoint[];
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value || 0), 0);
  return (
    <div style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.fill, marginBottom: 2 }}>
          {p.name}: {p.value}ч
        </div>
      ))}
      <div style={{ marginTop: 4, borderTop: "1px solid var(--color-border)", paddingTop: 4, color: "var(--color-text)", fontWeight: 600 }}>
        Всего: {total.toFixed(1)}ч
      </div>
    </div>
  );
};

export function SleepHistoryChart({ data }: Props) {
  if (!data.length) return null;

  const isLarge = data.length > 60;
  const interval = data.length > 20 ? Math.floor(data.length / 10) : 0;
  const chartHeight = isLarge ? 240 : 200;

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart data={data} barCategoryGap={isLarge ? "5%" : "20%"} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--color-muted)" }}
          tickLine={false}
          axisLine={false}
          interval={interval}
        />
        <YAxis
          tickFormatter={v => `${v}ч`}
          tick={{ fontSize: 11, fill: "var(--color-muted)" }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-bg)" }} />
        <Bar dataKey="deep"  stackId="a" fill="#2b6cb0" name="Глубокий" />
        <Bar dataKey="rem"   stackId="a" fill="#805ad5" name="REM" />
        <Bar dataKey="light" stackId="a" fill="#90cdf4" name="Лёгкий" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
