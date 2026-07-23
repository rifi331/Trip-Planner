"use client";

import React from "react";
import { useDroppable } from "@dnd-kit/core";
import type { CardWithSlot } from "@/lib/types";
import { SLOTS_PER_DAY, SLOT_HEIGHT_PX } from "@/lib/constants";
import { buildTimeLabels, timeToSlotIndex, toLocalDateKey, formatDayLabel } from "@/lib/date-utils";
import { PlacedCard } from "@/components/PlacedCard";

export interface TimelineColumnProps {
  day: Date;
  cards: CardWithSlot[];
  pendingSlot: { dayKey: string; slotIndex: number } | null;
  onSelectSlot: (dayKey: string, slotIndex: number) => void;
  onEditCard: (card: CardWithSlot) => void;
  onDeleteCard: (card: CardWithSlot) => void;
  onResize: (cardId: string, newDurationMinutes: number) => void;
}

const TIME_LABELS = buildTimeLabels();
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// One day column. Day identity is carried as a timezone-safe "YYYY-MM-DD" key
// (toLocalDateKey) instead of toISOString() to avoid the off-by-one day bug.
export function TimelineColumn({
  day,
  cards,
  pendingSlot,
  onSelectSlot,
  onEditCard,
  onDeleteCard,
  onResize,
}: TimelineColumnProps) {
  const dayKey = toLocalDateKey(day);
  const { setNodeRef, isOver } = useDroppable({
    id: `day:${dayKey}`,
    data: { type: "day", day: dayKey },
  });

  const placed = cards.filter((c) => c.itinerarySlot);
  // Quick lookup of which slot indices are occupied (so empty slots are tappable).
  const occupied = new Set(placed.map((c) => timeToSlotIndex(c.itinerarySlot!.startTime)));

  return (
    <div className="flex shrink-0 flex-col">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-2 py-1.5 text-center">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-brand-600 sm:text-[10px]">
          {WEEKDAYS[day.getDay()]}
        </div>
        <div className="text-sm font-bold text-slate-800">{day.getDate()}</div>
        <div className="text-[10px] text-slate-400">{MONTHS[day.getMonth()]}</div>
      </div>
      <div
        ref={setNodeRef}
        className={`relative ${isOver ? "bg-brand-50" : "bg-white"}`}
        style={{ width: "120px", height: SLOTS_PER_DAY * SLOT_HEIGHT_PX }}
      >
        {/* Working-hours band 08:00-20:00 for a calendar feel. */}
        <div
          className="pointer-events-none absolute inset-x-0 bg-slate-50/60"
          style={{ top: 16 * SLOT_HEIGHT_PX, height: (24 - 16) * SLOT_HEIGHT_PX }}
        />
        {/* Grid lines + hour labels + tappable empty slots. */}
        {TIME_LABELS.map((label, i) => {
          const isPending = pendingSlot?.dayKey === dayKey && pendingSlot?.slotIndex === i;
          return (
            <React.Fragment key={label}>
              <div
                className="pointer-events-none absolute left-0 right-0 border-t border-slate-100"
                style={{ top: i * SLOT_HEIGHT_PX }}
              >
                {i % 2 === 0 && (
                  <span className="absolute left-1 -top-2 text-[9px] font-medium text-slate-400">
                    {label}
                  </span>
                )}
              </div>
              {/* Tappable empty slot (click-to-place flow). Hidden if occupied. */}
              {!occupied.has(i) && (
                <button
                  type="button"
                  onClick={() => onSelectSlot(dayKey, i)}
                  className={`absolute left-0 right-0 border-t border-transparent transition-colors hover:bg-brand-100/50 ${
                    isPending ? "bg-brand-200/70 ring-1 ring-inset ring-brand-400" : ""
                  }`}
                  style={{ top: i * SLOT_HEIGHT_PX, height: SLOT_HEIGHT_PX }}
                  aria-label={`Select ${label} on ${formatDayLabel(day)}`}
                />
              )}
            </React.Fragment>
          );
        })}
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
