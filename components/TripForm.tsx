"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export interface TripFormValue {
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
}

export interface TripFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (value: TripFormValue) => Promise<void>;
  initial?: Partial<TripFormValue>;
  submitLabel?: string;
}

// Reusable form for creating or editing a trip. Returns dates as yyyy-mm-dd
// strings so the parent can POST them directly (the API coerces to Date).
export function TripForm({ open, onClose, onSubmit, initial, submitLabel = "Save" }: TripFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [destination, setDestination] = useState(initial?.destination ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!title.trim() || !destination.trim() || !startDate || !endDate) {
      setError("All fields are required.");
      return;
    }
    if (endDate < startDate) {
      setError("End date must be on or after the start date.");
      return;
    }
    setBusy(true);
    try {
      await onSubmit({ title: title.trim(), destination: destination.trim(), startDate, endDate });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save trip.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? "Edit Trip" : "New Trip"}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" size="sm" form="trip-form" disabled={busy}>
            {busy ? "Saving..." : submitLabel}
          </Button>
        </>
      }
    >
      <form id="trip-form" onSubmit={submit} className="space-y-3">
        <Field label="Title">
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Summer in Kyoto"
          />
        </Field>
        <Field label="Destination">
          <input
            className="input"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Kyoto, Japan"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input type="date" className="input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End date">
            <input type="date" className="input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </form>
      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 6px;
          border: 1px solid rgb(203 213 225);
          padding: 0.5rem 0.625rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: 2px solid rgb(148 163 184);
          outline-offset: 0;
        }
      `}</style>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}
