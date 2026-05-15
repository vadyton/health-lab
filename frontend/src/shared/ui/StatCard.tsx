import s from "./StatCard.module.scss";

interface Props {
  label: string;
  value: string | number;
  unit?: string;
  icon?: string;
  color?: string;
  /** Force column span. If omitted, auto-calculated from value length. */
  span?: 1 | 2 | 3;
}

function autoSpan(value: string | number, unit?: string): 1 | 2 | 3 {
  const len = String(value).length + (unit ? unit.length + 1 : 0);
  if (len > 18) return 3;
  if (len > 10) return 2;
  return 1;
}

export function StatCard({ label, value, unit, icon, color, span }: Props) {
  const cols = span ?? autoSpan(value, unit);
  return (
    <div
      className={s.card}
      style={{
        ...(color ? { borderTopColor: color } : {}),
        ...(cols > 1 ? { gridColumn: `span ${cols}` } : {}),
      }}
    >
      {icon && <span className={s.icon}>{icon}</span>}
      <div className={s.value}>
        {value}
        {unit && <span className={s.unit}>{unit}</span>}
      </div>
      <div className={s.label}>{label}</div>
    </div>
  );
}
