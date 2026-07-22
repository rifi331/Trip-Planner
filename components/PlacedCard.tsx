"use client";

import React, { useCallback, useRef } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Trash2, Clock, GripVertical } from "lucide-react";
import type { CardCategory } from "@prisma/client";
import type { CardWithSlot } from "@/lib/types";
import { SLOT_HEIGHT_PX, MIN_DURATION_MINUTES, MAX_DURATION_MINUTES } from "@/lib/constants";
import { CategoryBadge } from "@/components/ui/Badge";
import { CostLevelDots } from "@/components/ui/CostLevelDots";
import { CardImage } from "@/components/ui/CardImage";

// Event-block style card on the Teams-like calendar.
const CAT_STYLE: Record<CardCategory, { bg: string; border: string; bar: string; text: string }> = {
  HISTORICAL: { bg: "#fffbeb", border: "#fbbf24", bar: "#d97706", text: "#92400e" },
  UNIQUE: { bg: "#f5f3ff", border: "#c4b5fd", bar: "#7c3aed", text: "#5b21b6" },
  INSTAGRAMMABLE: { bg: "#fdf2f8", border: "#f9a8d4", bar: "#db2777", text: "#9d174d" },
  TOURIST_ATTRACTION: { bg: "#eff6ff", border: "#93c5fd", bar: "#2563eb", text: "#1e40af" },
  RESTAURANT: { bg: "#fef2f2", border: "#fca5a5", bar: "#dc2626", text: "#991b1b" },
  STREET_FOOD: { bg: "#fff7ed", border: "#fdba74", bar: "#ea580c", text: "#9a3412" },
  NATURE: { bg: "#f0fdf4", border: "#86efac", bar: "#16a34a", text: "#166534" },
  MUSEUM: { bg: "#f0fdfa", border: "#5eead4", bar: "#0d9488", text: "#115e59" },
};

export interface PlacedCardProps {
  card: CardWithSlot;
  slotIndex: number;
  onEdit: (card: CardWithSlot) => void;
  onDelete: (card: CardWithSlot) => void;
  onResize: (cardId: string, newDurationMinutes: number) => void;
}

export function PlacedCard({ card, slotIndex, onEdit, onDelete, onResize }: PlacedCardProps) {
  const slot = card.itinerarySlot;
  const duration = slot?.durationMinutes ?? card.defaultDurationMinutes;
  const top = slotIndex * SLOT_HEIGHT_PX;
  const height = (duration / 30) * SLOT_HEIGHT_PX;
  const s = CAT_STYLE[card.category];

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `canvas:${card.id}`,
    data: { type: "canvas", cardId: card.id },
  });

  const startYPx = useRef(0);
  const startDuration = useRef(duration);

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      startYPx.current = e.clientY;
      startDuration.current = duration;
      document.body.classList.add("resizing-active");
      const move = (ev: PointerEvent) => {
        const deltaPx = ev.clientY - startYPx.current;
        const deltaMin = Math.round(deltaPx / SLOT_HEIGHT_PX) * 30;
        const next = Math.max(MIN_DURATION_MINUTES, Math.min(MAX_DURATION_MINUTES, startDuration.current + deltaMin));
        if (next !== startDuration.current) onResize(card.id, next);
        startDuration.current = next;
      };
      const up = () => {
        document.body.classList.remove("resizing-active");
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [card.id, duration, onResize],
  );

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        top,
        height: Math.max(height, SLOT_HEIGHT_PX - 4),
        backgroundColor: s.bg,
        borderColor: s.border,
        color: s.text,
      }}
      className={`group absolute left-1 right-1 z-10 flex flex-col overflow-hidden rounded-md border-l-4 border shadow-card ${isDragging ? "opacity-40" : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start justify-between gap-1 p-1.5">
        <div className="flex min-w-0 items-start gap-1">
          <GripVertical size={11} className="mt-0.5 shrink-0 opacity-40" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight">{card.title}</p>
            <p className="inline-flex items-center gap-0.5 text-[10px] opacity-80">
              <Clock size={9} /> {slot?.startTime} · {duration}m
            </p>
          </div>
        </div>
        <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onEdit(card); }} className="opacity-60 hover:opacity-100" aria-label="Edit">
            <Pencil size={10} />
          </button>
          <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onDelete(card); }} className="opacity-60 hover:opacity-100" aria-label="Delete">
            <Trash2 size={10} />
          </button>
        </div>
      </div>
      {height >= 120 && card.imageUrl && (
        <CardImage
          imageUrl={card.imageUrl}
          category={card.category}
          alt={card.title}
          className="mx-1 mb-1 h-10 w-auto rounded"
        />
      )}
      {height >= 80 && (
        <div className="mt-auto flex items-center justify-between gap-1 px-1.5 pb-1">
          <CategoryBadge category={card.category} />
          <CostLevelDots level={card.costLevel} />
        </div>
      )}
      <div
        onPointerDown={onResizeStart}
        className="resize-handle absolute inset-x-0 bottom-0 h-2 hover:bg-black/10"
        aria-label="Resize duration"
      />
    </div>
  );
}
