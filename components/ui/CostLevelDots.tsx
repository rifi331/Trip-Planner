import React from "react";
import { MAX_COST_LEVEL } from "@/lib/constants";

// Render cost level 1-4 as filled vs dim dollar signs.
export function CostLevelDots({ level }: { level: number }) {
  const clamped = Math.max(1, Math.min(MAX_COST_LEVEL, Math.round(level)));
  return (
    <span className="text-xs font-semibold text-emerald-600" aria-label={`cost level ${clamped}`}>
      {"$".repeat(clamped)}
      <span className="text-slate-300">{"$".repeat(MAX_COST_LEVEL - clamped)}</span>
    </span>
  );
}
