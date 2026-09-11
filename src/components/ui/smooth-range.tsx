import { useEffect, useState } from "react";

/**
 * A range input that stays perfectly smooth while dragging even when
 * `onCommit` writes to Firestore/MQTT — value is tracked in local state
 * during the drag and only committed on release (mouse/touch/keyboard),
 * instead of round-tripping through a live-synced prop on every tick,
 * which is what made these sliders feel laggy/stepped before.
 */
export function SmoothRange({
  value,
  min,
  max,
  onCommit,
  className,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (value: number) => void;
  className?: string;
}) {
  const [local, setLocal] = useState(value);

  useEffect(() => setLocal(value), [value]);

  return (
    <input
      type="range"
      min={min}
      max={max}
      value={local}
      onChange={(event) => setLocal(Number(event.target.value))}
      onMouseUp={() => onCommit(local)}
      onTouchEnd={() => onCommit(local)}
      onKeyUp={() => onCommit(local)}
      className={className}
    />
  );
}
