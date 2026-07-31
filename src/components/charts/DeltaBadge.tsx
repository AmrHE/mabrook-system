import { TrendingDown, TrendingUp } from "lucide-react";
import type { Delta } from "./constants";

/** Small trend pill (green ↑ / red ↓ with a percentage). Renders nothing when flat or absent. */
export default function DeltaBadge({ delta, className = "" }: { delta?: Delta | null; className?: string }) {
  if (!delta || delta.dir === "flat") return null;
  const up = delta.dir === "up";
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-xs font-medium ${
        up ? "text-green-600" : "text-red-600"
      } ${className}`}
    >
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {delta.pct}%
    </span>
  );
}
