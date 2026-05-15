export interface HrSample { time: number; bpm: number; }

export type MergeStrategy =
  | "fill_gaps"
  | "prefer_external"
  | "external_only"
  | "mi_band_only";

export const STRATEGIES: { id: MergeStrategy; label: string; desc: string }[] = [
  {
    id: "fill_gaps",
    label: "Mi Band + заполнить пробелы нагрудным",
    desc: "Берёт данные Mi Band как основу, вставляет показания нагрудного датчика в промежутки > 2 мин без данных.",
  },
  {
    id: "prefer_external",
    label: "Нагрудный датчик + заполнить пробелы Mi Band",
    desc: "Нагрудный датчик в приоритете (выше точность), Mi Band закрывает периоды без нагрудного.",
  },
  {
    id: "external_only",
    label: "Только нагрудный датчик",
    desc: "Использовать исключительно данные загруженного файла.",
  },
  {
    id: "mi_band_only",
    label: "Только Mi Band",
    desc: "Оставить только оригинальные данные браслета.",
  },
];

export function mergeHr(
  miBand: HrSample[],
  external: HrSample[],
  strategy: MergeStrategy,
  gapThreshold = 120,
): HrSample[] {
  const sort = (a: HrSample[]) => [...a].sort((x, y) => x.time - y.time);

  if (strategy === "mi_band_only")  return sort(miBand);
  if (strategy === "external_only") return sort(external);

  const base   = sort(strategy === "prefer_external" ? external : miBand);
  const filler = sort(strategy === "prefer_external" ? miBand   : external);

  const extra: HrSample[] = [];

  // Fill gaps inside base
  for (let i = 1; i < base.length; i++) {
    if (base[i].time - base[i - 1].time > gapThreshold) {
      filler
        .filter(s => s.time > base[i - 1].time && s.time < base[i].time)
        .forEach(s => extra.push(s));
    }
  }
  // Extend before/after base
  if (base.length > 0) {
    filler.filter(s => s.time < base[0].time).forEach(s => extra.push(s));
    filler.filter(s => s.time > base[base.length - 1].time).forEach(s => extra.push(s));
  } else {
    extra.push(...filler);
  }

  const seen = new Set(base.map(s => s.time));
  return sort([...base, ...extra.filter(s => !seen.has(s.time))]);
}

export function hrStats(samples: HrSample[]) {
  if (!samples.length) return { avg: 0, min: 0, max: 0 };
  const bpms = samples.map(s => s.bpm);
  return {
    avg: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length),
    min: Math.min(...bpms),
    max: Math.max(...bpms),
  };
}

/** Downsample to at most maxPoints for chart rendering */
export function downsample(samples: HrSample[], maxPoints = 600): HrSample[] {
  if (samples.length <= maxPoints) return samples;
  const step = Math.ceil(samples.length / maxPoints);
  return samples.filter((_, i) => i % step === 0);
}
