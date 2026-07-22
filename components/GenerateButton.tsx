"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface GenerateButtonProps {
  tripId: string;
  onGenerated: () => Promise<void> | void;
}

export function GenerateButton({ tripId, onGenerated }: GenerateButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/generate-cards`, { method: "POST" });
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
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
