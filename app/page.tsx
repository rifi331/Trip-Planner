"use client";

import { useEffect, useState } from "react";
import { Plus, Plane, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { TripForm } from "@/components/TripForm";
import { TripList, type TripListItem } from "@/components/TripList";
import type { Trip } from "@prisma/client";

type TripWithCount = Trip & { _count: { cards: number; itinerarySlots: number } };

// Home page: Teams-like top bar + Trello-style board of trips.
export default function HomePage() {
  const [trips, setTrips] = useState<TripListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<TripListItem | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trips");
      if (!res.ok) throw new Error("Failed to load trips");
      setTrips((await res.json()) as TripWithCount[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createTrip(value: { title: string; destination: string; startDate: string; endDate: string }) {
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Failed to create trip");
    }
    await load();
  }

  async function updateTrip(
    id: string,
    value: { title: string; destination: string; startDate: string; endDate: string },
  ) {
    const res = await fetch(`/api/trips/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(value),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error || "Failed to update trip");
    }
    await load();
  }

  async function deleteTrip(trip: TripListItem) {
    if (!confirm(`Delete trip "${trip.title}"? This removes all its cards and schedule.`)) return;
    const res = await fetch(`/api/trips/${trip.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error || "Failed to delete trip");
      return;
    }
    await load();
  }

  return (
    <div className="min-h-screen">
      {/* Teams-style top app bar. */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-brand-800 bg-brand-700 px-6 py-3 text-white shadow-md">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/20">
            <Plane size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Travel Planner</h1>
            <p className="text-[11px] text-brand-100">Card-based AI itinerary generator</p>
          </div>
        </div>
        <Button variant="ai" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> New Trip
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-5 flex items-center gap-2 text-slate-600">
          <Sparkles size={16} className="text-brand-500" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">Your Trips</h2>
        </div>

        {loading && <p className="text-sm text-slate-500">Loading trips...</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!loading && !error && (
          <TripList trips={trips} onEdit={(t) => setEditing(t)} onDelete={deleteTrip} />
        )}
      </main>

      <TripForm open={createOpen} onClose={() => setCreateOpen(false)} onSubmit={createTrip} submitLabel="Create" />
      <TripForm
        open={!!editing}
        onClose={() => setEditing(null)}
        onSubmit={async (v) => {
          if (!editing) throw new Error("No trip selected");
          await updateTrip(editing.id, v);
        }}
        initial={
          editing
            ? {
                title: editing.title,
                destination: editing.destination,
                startDate: toDateInput(editing.startDate),
                endDate: toDateInput(editing.endDate),
              }
            : undefined
        }
        submitLabel="Update"
      />
    </div>
  );
}

function toDateInput(d: Date | string) {
  const date = new Date(d);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
