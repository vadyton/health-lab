import { SPORT_OPTIONS } from "./sportOptions";

export function sportLabel(category: string): string {
  const found = SPORT_OPTIONS.find((o) => o.id === category);
  if (found) return found.label;
  // Fallback: capitalise underscored id
  return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sportEnglish(category: string): string {
  const found = SPORT_OPTIONS.find((o) => o.id === category);
  if (found) return found.en;
  return category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function sportIcon(category: string): string {
  const found = SPORT_OPTIONS.find((o) => o.id === category);
  return found?.icon ?? "🏅";
}
