"use client";

import Link from "next/link";
import { Trash2, Pencil, MapPin, CalendarDays, Layers, Clock } from "lucide-react";
import type { Trip } from "@prisma/client";
import { Button } from "@/components/ui/Button";

export interface TripListItem extends Trip {
  _count: { cards: number; itinerarySlots: number };
}

export interface TripListProps {
  trips: TripListItem[];
  onEdit: (trip: TripListItem) => void;
  onDelete: (trip: TripListItem) => Promise<void>;
}

// Trello-style board of trip cards. Each card is a colored surface linking
// to the trip detail / timeline view.
export function TripList({ trips, onEdit, onDelete }: TripListProps) {
  if (trips.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white/60 p-12 text-center">
        <Layers size={32} className="text-slate-300" />
        <p className="text-sm font-medium text-slate-500">No trips yet</p>
        <p className="text-xs text-slate-400">Create your first trip to start planning.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {trips.map((trip) => (
        <div key={trip.id} className="card-surface group flex flex-col overflow-hidden">
          {/* Color header strip like a Trello card cover. */}
          <div className="h-2 bg-gradient-to-r from-brand-500 to-fuchsia-500" />
          <Link href={`/trips/${trip.id}`} className="flex flex-1 flex-col p-4">
            <h3 className="text-base font-semibold text-slate-800 group-hover:text-brand-700">{trip.title}</h3>
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={12} /> {trip.destination}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <CalendarDays size={12} /> {fmt(trip.startDate)} → {fmt(trip.endDate)}
            </div>
          </Link>
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2">
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Layers size={12} /> {trip._count.cards}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} /> {trip._count.itinerarySlots}
              </span>
            </div>
            <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <Button variant="ghost" size="sm" onClick={() => onEdit(trip)} aria-label="Edit trip">
                <Pencil size={14} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50"
                onClick={() => onDelete(trip)}
                aria-label="Delete trip"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function fmt(d: Date | string) {
  return new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
