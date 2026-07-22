"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import type { CardWithSlot } from "@/lib/types";
import { SLOTS_PER_DAY, SLOT_HEIGHT_PX } from "@/lib/constants";
import { buildTimeLabels, timeToSlotIndex, formatDayLabel } from "@/lib/date-utils";
import { PlacedCard } from "@/components/PlacedCard";

export interface TimelineColumnProps {
  day: Date;
  cards: CardWithSlot[];
  onEditCard: (card: CardWithSlot) => void;
  onDeleteCard: (card: CardWithSlot) => void;
  onResize: (cardId: string, newDurationMinutes: number) => void;
}

const TIME_LABELS = buildTimeLabels();

// One day column in the Teams-like schedule view.
export function TimelineColumn({ day, cards, onEditCard, onDeleteCard, onResize }: TimelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `day:${day.toISOString()}`,
    data: { type: "day", day: day.toISOString() },
  });

  const placed = cards.filter((c) => c.itinerarySlot);

  return (
    <div className="flex shrink-0 flex-col">
      {/* Sticky day header like a calendar column title. */}
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-2 py-1.5 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-600">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day.getDay()]}
        </div>
        <div className="text-sm font-bold text-slate-800">{day.getDate()}</div>
        <div className="text-[10px] text-slate-400">{["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][day.getMonth()]}</div>
      </div>
      <div
        ref={setNodeRef}
        className={`relative ${isOver ? "bg-brand-50" : "bg-white"}`}
        style={{ width: "180px", height: SLOTS_PER_DAY * SLOT_HEIGHT_PX }}
      >
        {/* Horizontal grid lines + hour labels. */}
        {TIME_LABELS.map((label, i) => (
          <div
            key={label}
            className="pointer-events-none absolute left-0 right-0 border-t border-slate-100"
            style={{ top: i * SLOT_HEIGHT_PX }}
          >
            {i % 2 === 0 && (
              <span className="absolute left-1 -top-2 text-[9px] font-medium text-slate-400">{label}</span>
            )}
          </div>
        ))}
        {/* Working-hours band (08:00-20:00) for a Teams calendar feel. */}
        <div
          className="pointer-events-none absolute inset-x-0 bg-slate-50/60"
          style={{ top: 16 * SLOT_HEIGHT_PX, height: (24 - 16) * SLOT_HEIGHT_PX }}
        />
        {placed.map((card) => (
          <PlacedCard
            key={card.id}
            card={card}
            slotIndex={timeToSlotIndex(card.itinerarySlot!.startTime)}
            onEdit={onEditCard}
            onDelete={onDeleteCard}
            onResize={onResize}
          />
        ))}
      </div>
    </div>
  );
}
