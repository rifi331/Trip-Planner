"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ALL_CATEGORIES } from "@/lib/constants";
import { CATEGORY_LABELS } from "@/lib/constants";
import type { CardCategory } from "@prisma/client";

export interface CardFormValue {
  title: string;
  description: string;
  category: CardCategory;
  defaultDurationMinutes: number;
  costLevel: number;
  imageUrl: string | null;
}

export interface ManualCardModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: CardFormValue) => Promise<void>;
  initial?: Partial<CardFormValue>;
}

// Modal to create or edit a single card manually.
export function ManualCardModal({ open, onClose, onSubmit, initial }: ManualCardModalProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<CardCategory>(initial?.category ?? "TOURIST_ATTRACTION");
  const [duration, setDuration] = useState(initial?.defaultDurationMinutes ?? 60);
  const [cost, setCost] = useState(initial?.costLevel ?? 2);
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset fields ONLY on the false->true open transition. Re-running on every
  // render (because `initial` is a fresh object each time) was resetting the
  // duration/cost sliders back to their start value while dragging them.
  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setCategory(initial?.category ?? "TOURIST_ATTRACTION");
      setDuration(initial?.defaultDurationMinutes ?? 60);
      setCost(initial?.costLevel ?? 2);
      setImageUrl(initial?.imageUrl ?? "");
      setError(null);
    }
    prevOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        defaultDurationMinutes: duration,
        costLevel: cost,
        imageUrl: imageUrl.trim() || null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save card.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit Card" : "Add Manual Card"}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button type="submit" size="sm" form="card-form" disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
        </>
      }
    >
      <form id="card-form" onSubmit={submit} className="space-y-3">
        <L label="Title">
          <input className="cinput" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fushimi Inari Shrine" />
        </L>
        <L label="Description">
          <textarea className="cinput" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </L>
        <L label="Image URL (optional)">
          <input
            className="cinput"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://example.com/photo.jpg"
          />
        </L>
        <div className="grid grid-cols-2 gap-3">
          <L label="Category">
            <select className="cinput" value={category} onChange={(e) => setCategory(e.target.value as CardCategory)}>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
              ))}
            </select>
          </L>
          <L label={`Duration: ${duration} min`}>
            <input type="range" min={30} max={360} step={30} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full" />
          </L>
        </div>
        <L label={`Cost level: ${"$".repeat(cost)}`}>
          <input type="range" min={1} max={4} step={1} value={cost} onChange={(e) => setCost(Number(e.target.value))} className="w-full" />
        </L>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
      <style jsx>{`
        .cinput{width:100%;border-radius:6px;border:1px solid rgb(203 213 225);padding:.5rem .625rem;font-size:.875rem;background:white}
        .cinput:focus{outline:2px solid rgb(148 163 184)}
      `}</style>
    </Modal>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
