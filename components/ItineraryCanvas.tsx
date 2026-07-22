"use client";

import React, { useEffect, useRef } from "react";
import { CalendarDays } from "lucide-react";
import type { CardWithSlot } from "@/lib/types";
import { DEFAULT_FOCUS_HOUR, SLOT_HEIGHT_PX } from "@/lib/constants";
import { eachDayOfRange, asDate } from "@/lib/date-utils";
import { TimelineColumn } from "@/components/TimelineColumn";

export interface ItineraryCanvasProps {
  startDate: Date | string;
  endDate: Date | string;
  cards: CardWithSlot[];
  onEditCard: (card: CardWithSlot) => void;
  onDeleteCard: (card: CardWithSlot) => void;
  onResize: (cardId: string, newDurationMinutes: number) => void;
}

// Right pane: horizontal day columns + vertical 30-min time grid.
export function ItineraryCanvas({ startDate, endDate, cards, onEditCard, onDeleteCard, onResize }: ItineraryCanvasProps) {
  const days = eachDayOfRange(startDate, endDate);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the default focus hour (08:00) on mount.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = DEFAULT_FOCUS_HOUR * 2 * SLOT_HEIGHT_PX;
    }
  }, []);

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-slate-50">
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-2">
        <CalendarDays size={15} className="text-brand-600" />
        <h2 className="text-sm font-semibold text-slate-700">Schedule</h2>
        <span className="text-xs text-slate-400">· drag cards from the pool onto a time slot</span>
      </div>
      <div ref={scrollRef} className="scrollbar-thin flex-1 overflow-auto">
        <div className="flex">
          {days.map((day) => {
            const dayCards = cards.filter(
              (c) => c.itinerarySlot && asDate(c.itinerarySlot.assignedDate).toDateString() === day.toDateString(),
            );
            return (
              <TimelineColumn
                key={day.toISOString()}
                day={day}
                cards={dayCards}
                onEditCard={onEditCard}
                onDeleteCard={onDeleteCard}
                onResize={onResize}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
