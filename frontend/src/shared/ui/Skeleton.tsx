import s from "./Skeleton.module.scss";

interface Props {
  width?:     string;
  height?:    string;
  rounded?:   boolean;
  className?: string;
}

export function Skeleton({ width = "100%", height = "16px", rounded, className }: Props) {
  return (
    <div
      className={`${s.skeleton} ${rounded ? s.rounded : ""} ${className ?? ""}`}
      style={{ width, height }}
    />
  );
}

// Convenience presets
export function SkeletonText({ lines = 1, className }: { lines?: number; className?: string }) {
  return (
    <div className={`${s.textBlock} ${className ?? ""}`}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height="14px" width={i === lines - 1 && lines > 1 ? "70%" : "100%"} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`${s.card} ${className ?? ""}`}>
      <Skeleton height="28px" width="60%" />
      <Skeleton height="12px" width="80%" />
    </div>
  );
}
