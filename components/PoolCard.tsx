"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Trash2, GripVertical, Clock } from "lucide-react";
import type { CardCategory } from "@prisma/client";
import type { CardWithSlot } from "@/lib/types";
import { CategoryBadge } from "@/components/ui/Badge";
import { CostLevelDots } from "@/components/ui/CostLevelDots";
import { CardImage } from "@/components/ui/CardImage";

// Left accent border color per category (Trello card label strip).
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
  onEdit: (card: CardWithSlot) => void;
  onDelete: (card: CardWithSlot) => void;
}

export function PoolCard({ card, onEdit, onDelete }: PoolCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `pool:${card.id}`,
    data: { type: "pool", cardId: card.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, borderLeftColor: ACCENT[card.category] }}
      className={`group flex items-stretch overflow-hidden rounded-md bg-white shadow-card ${isDragging ? "opacity-40" : ""}`}
    >
      {/* accent strip */}
      <div className="w-1.5 shrink-0" style={{ backgroundColor: ACCENT[card.category] }} />
      <div className="flex min-w-0 flex-1 gap-0">
        <button
          className="flex cursor-grab items-center px-1 text-slate-300 hover:text-slate-500"
          {...attributes}
          {...listeners}
          aria-label="Drag card"
        >
          <GripVertical size={14} />
        </button>
        <div className="min-w-0 flex-1">
          {card.imageUrl && (
            <CardImage imageUrl={card.imageUrl} category={card.category} alt={card.title} className="h-20 w-full rounded-md" />
          )}
          <div className="p-2">
            <div className="flex items-start justify-between gap-1">
              <p className="truncate text-sm font-medium text-slate-800">{card.title}</p>
              <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button onClick={() => onEdit(card)} className="text-slate-300 hover:text-slate-700" aria-label="Edit card">
                  <Pencil size={12} />
                </button>
                <button onClick={() => onDelete(card)} className="text-red-300 hover:text-red-600" aria-label="Delete card">
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
            {card.description && <p className="line-clamp-2 text-xs text-slate-500">{card.description}</p>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <CategoryBadge category={card.category} />
              <CostLevelDots level={card.costLevel} />
              <span className="inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                <Clock size={10} /> {card.defaultDurationMinutes}m
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
