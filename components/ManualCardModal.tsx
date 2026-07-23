"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { ALL_CATEGORIES, CATEGORY_LABELS, SLOT_INTERVAL_MINUTES, SLOTS_PER_DAY } from "@/lib/constants";
import { buildTimeLabels, slotIndexToTime, timeToSlotIndex } from "@/lib/date-utils";
import type { CardCategory } from "@prisma/client";

const TIME_OPTIONS = buildTimeLabels(); // 48 labels: "00:00" .. "23:30"

export interface SlotEditing {
  startTime: string;
  durationMinutes: number;
}

export interface CardFormValue {
  title: string;
  description: string;
  category: CardCategory;
  defaultDurationMinutes: number;
  costLevel: number;
  imageUrl: string | null;
  /** Present (non-null) when the modal edited the scheduled slot duration/start. */
  slotDurationMinutes: number | null;
  /** Present (non-null) when the modal edited the scheduled slot start time. */
  slotStartTime: string | null;
}

export interface ManualCardModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: CardFormValue) => Promise<void>;
  /** Called when the user clicks "Remove from schedule". */
  onUnassign?: () => Promise<void> | void;
  initial?: Partial<CardFormValue>;
  /** When set, the card is placed; the modal edits the slot's start + duration. */
  slot?: SlotEditing;
}

export function ManualCardModal({ open, onClose, onSubmit, onUnassign, initial, slot }: ManualCardModalProps) {
  const editingSlot = !!slot;
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [category, setCategory] = useState<CardCategory>(initial?.category ?? "TOURIST_ATTRACTION");
  // Duration: slot duration when placed, else the card default.
  const [duration, setDuration] = useState(
    slot ? slot.durationMinutes : initial?.defaultDurationMinutes ?? 60,
  );
  const [startTime, setStartTime] = useState(slot ? slot.startTime : "08:00");
  const [cost, setCost] = useState(initial?.costLevel ?? 2);
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset fields ONLY on the false->true open transition.
  const prevOpen = useRef(false);
  useEffect(() => {
    if (open && !prevOpen.current) {
      setTitle(initial?.title ?? "");
      setDescription(initial?.description ?? "");
      setCategory(initial?.category ?? "TOURIST_ATTRACTION");
      setDuration(slot ? slot.durationMinutes : initial?.defaultDurationMinutes ?? 60);
      setStartTime(slot ? slot.startTime : "08:00");
      setCost(initial?.costLevel ?? 2);
      setImageUrl(initial?.imageUrl ?? "");
      setError(null);
    }
    prevOpen.current = open;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slot]);

  // Computed end time = start + duration (clamped to 23:30 / end-of-day).
  const endTime = useMemo(() => {
    if (!editingSlot) return null;
    const startMin = timeToSlotIndex(startTime) * SLOT_INTERVAL_MINUTES;
    const endMin = Math.min(SLOTS_PER_DAY * SLOT_INTERVAL_MINUTES, startMin + duration);
    return slotIndexToTime(Math.floor(endMin / SLOT_INTERVAL_MINUTES));
  }, [editingSlot, startTime, duration]);

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
        slotDurationMinutes: editingSlot ? duration : null,
        slotStartTime: editingSlot ? startTime : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save card.");
    } finally {
      setBusy(false);
    }
  }

  async function handleUnassign() {
    if (!onUnassign) return;
    setBusy(true);
    setError(null);
    try {
      await onUnassign();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove from schedule.");
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
          {editingSlot && onUnassign && (
            <Button variant="danger" size="sm" onClick={handleUnassign} disabled={busy} className="mr-auto">
              <Trash2 size={13} /> Remove from schedule
            </Button>
          )}
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
          <L label={`${editingSlot ? "Scheduled duration" : "Duration"}: ${duration} min`}>
            <input type="range" min={30} max={360} step={30} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="w-full" />
          </L>
        </div>
        <L label={`Cost level: ${"$".repeat(cost)}`}>
          <input type="range" min={1} max={4} step={1} value={cost} onChange={(e) => setCost(Number(e.target.value))} className="w-full" />
        </L>
        {editingSlot && (
          <div className="grid grid-cols-2 gap-3 rounded-md border border-brand-200 bg-brand-50 p-2">
            <L label="Start time">
              <select
                className="cinput"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              >
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </L>
            <L label="End time (auto)">
              <input className="cinput bg-slate-50" value={endTime ?? ""} readOnly />
            </L>
            <p className="col-span-2 text-[11px] text-slate-500">
              The card will move to {startTime} when you save (duration auto-fits to avoid overlap).
            </p>
          </div>
        )}
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
