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
import { CardPool, type PendingSlot } from "@/components/CardPool";
import { ItineraryCanvas } from "@/components/ItineraryCanvas";
import { ManualCardModal, type CardFormValue } from "@/components/ManualCardModal";
import { SLOT_HEIGHT_PX } from "@/lib/constants";
import { slotIndexToTime, fromLocalDateKey, formatDayLabel } from "@/lib/date-utils";

// Orchestrates the trip detail view: load trip, DnD (pool <-> canvas, move),
// resize, click-to-place, CRUD cards, and auto-sync with optimistic updates.
export function TripDetailClient({ tripId }: { tripId: string }) {
  const [trip, setTrip] = useState<TripWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<CardWithSlot | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<CardWithSlot | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pendingSlot, setPendingSlot] = useState<PendingSlot | null>(null);

  // PointerSensor handles mouse/trackpad drag on desktop. Touch devices do
  // NOT get drag (it was unreliable); mobile uses click-to-place instead.
  // PointerSensor ignores touch by default when no TouchSensor is present,
  // so taps on mobile fall through to the click handlers.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

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

  async function onDragEnd(e: DragEndEvent) {
    setActiveCard(null);
    if (!trip) return;
    const cardId = String(e.active.id).split(":")[1];
    const card = trip.cards.find((c) => c.id === cardId);
    if (!card) return;

    const overType = e.over?.data.current?.type;

    // Drop on pool area => unassign the card.
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
    const dayKey = e.over?.data.current?.day as string | undefined;
    if (!dayKey) return;
    const day = fromLocalDateKey(dayKey);
    const rect = e.over?.rect;
    let slotIndex = 0;
    if (rect) {
      // Use the pointer delta from drag start + the droppable's current rect.
      const pointerY = rect.top + (e.delta.y ?? 0);
      const offsetY = pointerY - rect.top;
      slotIndex = Math.max(0, Math.min(47, Math.floor(offsetY / SLOT_HEIGHT_PX)));
    }
    await placeCard(card, day, slotIndex);
  }

  // Shared place/move routine used by both drag-drop and click-to-place.
  async function placeCard(card: CardWithSlot, day: Date, slotIndex: number) {
    if (!trip) return;
    const startTime = slotIndexToTime(slotIndex);
    const durationMinutes = card.itinerarySlot?.durationMinutes ?? card.defaultDurationMinutes;
    const cardId = card.id;

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

  // Click-to-place flow: tapping an empty slot stores it as pending.
  function onSelectSlot(dayKey: string, slotIndex: number) {
    const day = fromLocalDateKey(dayKey);
    const label = `${formatDayLabel(day)} ${slotIndexToTime(slotIndex)}`;
    setPendingSlot({ dayKey, slotIndex, label });
  }

  // Then tapping a pool card places it at the pending slot.
  async function onPlaceFromPool(card: CardWithSlot) {
    if (!pendingSlot || !trip) return;
    const day = fromLocalDateKey(pendingSlot.dayKey);
    await placeCard(card, day, pendingSlot.slotIndex);
    setPendingSlot(null);
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
      if (!res.ok) throw new Error();
      // The server auto-fits the duration to the available gap, so sync the
      // actual persisted duration back into state (it may be smaller than
      // requested if it would have overlapped a neighbor).
      const updated = await res.json();
      if (updated?.durationMinutes !== undefined) {
        setTrip((cur) =>
          cur
            ? { ...cur, cards: cur.cards.map((c) => (c.id === cardId && c.itinerarySlot ? { ...c, itinerarySlot: { ...c.itinerarySlot, durationMinutes: updated.durationMinutes } } : c)) }
            : cur,
        );
      }
    } catch {
      // Revert to the previous duration on error.
      setTrip((cur) =>
        cur ? { ...cur, cards: cur.cards.map((c) => (c.id === cardId && c.itinerarySlot ? { ...c, itinerarySlot: { ...c.itinerarySlot, durationMinutes: prevDuration } } : c)) } : cur,
      );
      flash("Failed to resize card.");
    }
  }

  // Save a card. When the modal reported a slot duration, PATCH the slot too.
  async function saveCard(value: CardFormValue) {
    const editing = editingCard;
    if (editing) {
      const res = await fetch(`/api/cards/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: value.title,
          description: value.description,
          category: value.category,
          defaultDurationMinutes: value.defaultDurationMinutes,
          costLevel: value.costLevel,
          imageUrl: value.imageUrl,
        }),
      });
      if (!res.ok) throw new Error("Failed to update card");

      // If the modal edited a placed slot's duration, persist it via PATCH.
      if (value.slotDurationMinutes !== null && editing.itinerarySlot && editing.itinerarySlot.id !== "temp") {
        await fetch(`/api/itinerary/${editing.itinerarySlot.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ durationMinutes: value.slotDurationMinutes }),
        });
      }
    } else {
      const res = await fetch(`/api/trips/${tripId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: value.title,
          description: value.description,
          category: value.category,
          defaultDurationMinutes: value.defaultDurationMinutes,
          costLevel: value.costLevel,
          imageUrl: value.imageUrl,
        }),
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
        <header className="flex items-center justify-between border-b border-brand-800 bg-brand-700 px-3 py-2 text-white shadow-md sm:px-4 sm:py-2.5">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/" className="rounded p-1 hover:bg-white/10" aria-label="Back">
              <ArrowLeft size={18} />
            </Link>
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/20 sm:h-8 sm:w-8">
              <Plane size={14} />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight sm:text-base">{trip.title}</h1>
              <p className="inline-flex items-center gap-1 text-[10px] text-brand-100 sm:text-[11px]">
                <MapPin size={9} /> {trip.destination}
              </p>
            </div>
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <CardPool
            tripId={tripId}
            cards={poolCards}
            pendingSlot={pendingSlot}
            onAddManual={() => { setEditingCard(null); setManualOpen(true); }}
            onEditCard={(c) => { setEditingCard(c); setManualOpen(true); }}
            onDeleteCard={deleteCard}
            onPlaceCard={onPlaceFromPool}
            onCancelPending={() => setPendingSlot(null)}
            onGenerated={load}
          />
          <ItineraryCanvas
            startDate={trip.startDate}
            endDate={trip.endDate}
            cards={allCards}
            pendingSlot={pendingSlot}
            onSelectSlot={onSelectSlot}
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
            <div className="wiggle w-64 rounded-md border border-brand-300 bg-white p-2 text-sm font-medium text-slate-800 shadow-cardHover">
              {activeCard.title}
            </div>
          ) : null}
        </DragOverlay>
        <ManualCardModal
          open={manualOpen}
          onClose={() => setManualOpen(false)}
          onSubmit={saveCard}
          slotDuration={editingCard?.itinerarySlot?.durationMinutes}
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
