/** Circular progress (0..1). Used on download buttons. */
export function ProgressRing({ value, size = 36, stroke = 3 }: { value: number; size?: number; stroke?: number }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <svg className="progress-ring" width={size} height={size} role="progressbar" aria-valuemin={0} aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}>
      <circle className="progress-ring__track" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} />
      <circle className="progress-ring__value" cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped)} strokeLinecap="round" />
    </svg>
  );
}
