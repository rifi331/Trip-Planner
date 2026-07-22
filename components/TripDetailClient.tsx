"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ArrowLeft, MapPin, Plane } from "lucide-react";
import type { TripWithRelations } from "@/lib/types";
import type { CardWithSlot } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { CardPool } from "@/components/CardPool";
import { ItineraryCanvas } from "@/components/ItineraryCanvas";
import { ManualCardModal, type CardFormValue } from "@/components/ManualCardModal";
import { SLOT_HEIGHT_PX } from "@/lib/constants";
import { slotIndexToTime, atLocalMidnight } from "@/lib/date-utils";

// Orchestrates the trip detail view: load trip, DnD (pool <-> canvas, move),
// resize, CRUD cards, and auto-sync to the API with optimistic updates.
export function TripDetailClient({ tripId }: { tripId: string }) {
  const [trip, setTrip] = useState<TripWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<CardWithSlot | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardWithSlot | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pointerY, setPointerY] = useState(0);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) throw new Error("Failed to load trip");
      setTrip((await res.json()) as TripWithRelations);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  const poolCards = useMemo(() => (trip?.cards ?? []).filter((c) => !c.itinerarySlot), [trip]);
  const allCards = useMemo(() => trip?.cards ?? [], [trip]);

  function flash(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2500);
  }

  function onDragStart(e: DragStartEvent) {
    const cardId = String(e.active.id).split(":")[1];
    setActiveCard(trip?.cards.find((c) => c.id === cardId) ?? null);
  }

  // Track the live pointer Y so we can compute the target slot on drop.
  useEffect(() => {
    const onMove = (e: PointerEvent) => setPointerY(e.clientY);
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  async function onDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    if (!trip) return;
    const cardId = String(e.active.id).split(":")[1];
    const card = trip.cards.find((c) => c.id === cardId);
    if (!card) return;

    // Drop on pool area => unassign.
    const overType = e.over?.data.current?.type;
    if (overType === "pool") {
      if (!card.itinerarySlot) return;
      const prev = trip;
      setTrip({ ...trip, cards: trip.cards.map((c) => (c.id === cardId ? { ...c, itinerarySlot: null } : c)) });
      try {
        const res = await fetch(`/api/trips/${tripId}/itinerary`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cardIds: [cardId] }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setTrip(prev);
        flash("Failed to unassign card.");
      }
      return;
    }

    // Drop on a day column => place/move at the slot under the pointer.
    const dayIso = e.over?.data.current?.day as string | undefined;
    if (!dayIso) return;
    const day = atLocalMidnight(new Date(dayIso));
    const rect = e.over?.rect;
    let slotIndex = 0;
    if (rect) {
      const offsetY = pointerY - rect.top;
      slotIndex = Math.max(0, Math.min(47, Math.floor(offsetY / SLOT_HEIGHT_PX)));
    }
    const startTime = slotIndexToTime(slotIndex);
    const durationMinutes = card.itinerarySlot?.durationMinutes ?? card.defaultDurationMinutes;

    const prev = trip;
    setTrip({
      ...trip,
      cards: trip.cards.map((c) =>
        c.id === cardId
          ? {
              ...c,
              itinerarySlot: {
                id: c.itinerarySlot?.id ?? "temp",
                tripId,
                cardId: c.id,
                assignedDate: day,
                startTime,
                durationMinutes,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            }
          : c,
      ),
    });

    try {
      const res = await fetch(`/api/trips/${tripId}/itinerary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots: [{ cardId, assignedDate: day, startTime, durationMinutes }] }),
      });
      if (res.status === 409) {
        setTrip(prev);
        flash("That slot overlaps another card.");
        return;
      }
      if (!res.ok) throw new Error();
      const j = await res.json();
      const saved = j.slots?.[0];
      if (saved) {
        setTrip((cur) =>
          cur ? { ...cur, cards: cur.cards.map((c) => (c.id === cardId && c.itinerarySlot ? { ...c, itinerarySlot: saved } : c)) } : cur,
        );
      }
    } catch {
      setTrip(prev);
      flash("Failed to place card.");
    }
  }

  async function onResize(cardId: string, newDurationMinutes: number) {
    if (!trip) return;
    const card = trip.cards.find((c) => c.id === cardId);
    const slot = card?.itinerarySlot;
    if (!slot || slot.id === "temp") return;
    const prevDuration = slot.durationMinutes;
    setTrip({
      ...trip,
      cards: trip.cards.map((c) =>
        c.id === cardId && c.itinerarySlot ? { ...c, itinerarySlot: { ...c.itinerarySlot, durationMinutes: newDurationMinutes } } : c,
      ),
    });
    try {
      const res = await fetch(`/api/itinerary/${slot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ durationMinutes: newDurationMinutes }),
      });
      if (res.status === 409) {
        flash("Resized card overlaps a neighbor.");
        setTrip((cur) =>
          cur ? { ...cur, cards: cur.cards.map((c) => (c.id === cardId && c.itinerarySlot ? { ...c, itinerarySlot: { ...c.itinerarySlot, durationMinutes: prevDuration } } : c)) } : cur,
        );
        return;
      }
      if (!res.ok) throw new Error();
    } catch {
      flash("Failed to resize card.");
    }
  }

  async function saveCard(value: CardFormValue) {
    if (editingCard) {
      const res = await fetch(`/api/cards/${editingCard.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (!res.ok) throw new Error("Failed to update card");
    } else {
      const res = await fetch(`/api/trips/${tripId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      if (!res.ok) throw new Error("Failed to create card");
    }
    await load();
  }

  async function deleteCard(card: CardWithSlot) {
    if (!confirm(`Delete card "${card.title}"?`)) return;
    const res = await fetch(`/api/cards/${card.id}`, { method: "DELETE" });
    if (!res.ok) { flash("Failed to delete card."); return; }
    await load();
  }

  if (loading) return <main className="p-8 text-sm text-slate-500">Loading trip...</main>;
  if (error) return <main className="p-8 text-sm text-red-600">{error}</main>;
  if (!trip) return null;

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <main className="flex h-screen flex-col">
        {/* Teams-style header. */}
        <header className="flex items-center justify-between border-b border-brand-800 bg-brand-700 px-4 py-2.5 text-white shadow-md">
          <div className="flex items-center gap-3">
            <Link href="/" className="rounded p-1 hover:bg-white/10" aria-label="Back">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/20">
              <Plane size={16} />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">{trip.title}</h1>
              <p className="inline-flex items-center gap-1 text-[11px] text-brand-100">
                <MapPin size={10} /> {trip.destination}
              </p>
            </div>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <CardPool
            tripId={tripId}
            cards={poolCards}
            onAddManual={() => { setEditingCard(null); setManualOpen(true); }}
            onEditCard={(c) => { setEditingCard(c); setManualOpen(true); }}
            onDeleteCard={deleteCard}
            onGenerated={load}
          />
          <ItineraryCanvas
            startDate={trip.startDate}
            endDate={trip.endDate}
            cards={allCards}
            onEditCard={(c) => { setEditingCard(c); setManualOpen(true); }}
            onDeleteCard={deleteCard}
            onResize={onResize}
          />
        </div>
        {toast && (
          <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-md bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}
        <DragOverlay>
          {activeCard ? (
            <div className="w-64 rounded-md border border-brand-300 bg-white p-2 text-sm font-medium text-slate-800 shadow-cardHover">
              {activeCard.title}
            </div>
          ) : null}
        </DragOverlay>
        <ManualCardModal
          open={manualOpen}
          onClose={() => setManualOpen(false)}
          onSubmit={saveCard}
          initial={
            editingCard
              ? {
                  title: editingCard.title,
                  description: editingCard.description ?? "",
                  category: editingCard.category,
                  defaultDurationMinutes: editingCard.defaultDurationMinutes,
                  costLevel: editingCard.costLevel,
                  imageUrl: editingCard.imageUrl ?? "",
                }
              : undefined
          }
        />
      </main>
    </DndContext>
  );
}
