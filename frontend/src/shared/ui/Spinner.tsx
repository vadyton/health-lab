import s from "./Spinner.module.scss";

export function Spinner({ size = 24 }: { size?: number }) {
  return (
    <span
      className={s.spinner}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Загрузка"
    />
  );
}
