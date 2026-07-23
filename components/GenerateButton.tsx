"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/lib/constants";
import type { CardCategory } from "@prisma/client";

export interface GenerateButtonProps {
  tripId: string;
  onGenerated: () => Promise<void> | void;
}

// Generate button with a multi-select category filter. All categories are
// selected by default; the chosen subset is sent to the API so the AI only
// returns cards in those categories.
export function GenerateButton({ tripId, onGenerated }: GenerateButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CardCategory[]>([...ALL_CATEGORIES]);
  const [expanded, setExpanded] = useState(false);

  function toggle(cat: CardCategory) {
    setSelected((cur) =>
      cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat],
    );
  }

  async function generate() {
    if (selected.length === 0) {
      setError("Select at least one category.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/generate-cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: selected }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "AI generation failed");
      await onGenerated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <Button variant="ai" onClick={generate} disabled={busy} className="w-full">
        <Sparkles size={16} />
        {busy ? "Generating..." : "Generate AI Cards"}
      </Button>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 w-full text-center text-[11px] text-slate-500 hover:text-slate-700"
      >
        {expanded ? "Hide" : "Filter"} categories ({selected.length}/{ALL_CATEGORIES.length})
      </button>
      {expanded && (
        <div className="mt-1 flex flex-wrap gap-1">
          {ALL_CATEGORIES.map((cat) => {
            const on = selected.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => toggle(cat)}
                className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  on
                    ? "border-brand-400 bg-brand-100 text-brand-800"
                    : "border-slate-200 bg-white text-slate-400"
                }`}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      )}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
