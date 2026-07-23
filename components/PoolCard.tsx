"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Trash2, GripVertical, Clock, MapPin } from "lucide-react";
import type { CardCategory } from "@prisma/client";
import type { CardWithSlot } from "@/lib/types";
import { CategoryBadge } from "@/components/ui/Badge";
import { CostLevelDots } from "@/components/ui/CostLevelDots";
import { CardImage } from "@/components/ui/CardImage";

const ACCENT: Record<CardCategory, string> = {
  HISTORICAL: "#d97706",
  UNIQUE: "#7c3aed",
  INSTAGRAMMABLE: "#db2777",
  TOURIST_ATTRACTION: "#2563eb",
  RESTAURANT: "#dc2626",
  STREET_FOOD: "#ea580c",
  NATURE: "#16a34a",
  MUSEUM: "#0d9488",
};

export interface PoolCardProps {
  card: CardWithSlot;
  pickMode: boolean;
  onEdit: (card: CardWithSlot) => void;
  onDelete: (card: CardWithSlot) => void;
  onPick: (card: CardWithSlot) => void;
}

export function PoolCard({ card, pickMode, onEdit, onDelete, onPick }: PoolCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `pool:${card.id}`,
    data: { type: "pool", cardId: card.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, borderLeftColor: ACCENT[card.category] }}
      className={`group relative flex items-stretch overflow-hidden rounded-md bg-white shadow-card ${
        isDragging ? "wiggle opacity-40" : ""
      } ${pickMode ? "ring-2 ring-brand-400" : ""}`}
    >
      <div className="w-1.5 shrink-0" style={{ backgroundColor: ACCENT[card.category] }} />
      <div className="flex min-w-0 flex-1 gap-0">
        {/* Large drag handle. In pick-mode the whole card is tappable to place. */}
        <button
          type="button"
          className={`flex w-6 shrink-0 cursor-grab items-center justify-center text-slate-300 hover:text-slate-500 active:cursor-grabbing ${
            pickMode ? "hidden" : ""
          }`}
          {...attributes}
          {...listeners}
          aria-label="Drag card"
        >
          <GripVertical size={16} />
        </button>
        <button
          type="button"
          onClick={() => pickMode && onPick(card)}
          className={`min-w-0 flex-1 p-1.5 text-left ${pickMode ? "cursor-pointer" : "cursor-default"}`}
          disabled={!pickMode}
        >
          {card.imageUrl && (
            <CardImage imageUrl={card.imageUrl} category={card.category} alt={card.title} className="h-14 w-full rounded-md sm:h-20" />
          )}
          <div className="mt-1 flex items-start justify-between gap-1">
            <p className="truncate text-xs font-medium text-slate-800 sm:text-sm">{card.title}</p>
            {pickMode && <MapPin size={12} className="mt-0.5 shrink-0 text-brand-500" />}
          </div>
          {card.description && <p className="line-clamp-2 text-[10px] text-slate-500 sm:text-xs">{card.description}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <CategoryBadge category={card.category} />
            <CostLevelDots level={card.costLevel} />
            <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
              <Clock size={10} /> {card.defaultDurationMinutes}m
            </span>
          </div>
        </button>
        {!pickMode && (
          <div className="flex shrink-0 flex-col gap-1 px-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button onClick={() => onEdit(card)} className="text-slate-300 hover:text-slate-700" aria-label="Edit card">
              <Pencil size={12} />
            </button>
            <button onClick={() => onDelete(card)} className="text-red-300 hover:text-red-600" aria-label="Delete card">
              <Trash2 size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
