"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Inbox, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PoolCard } from "@/components/PoolCard";
import { GenerateButton } from "@/components/GenerateButton";
import type { CardWithSlot } from "@/lib/types";

export interface PendingSlot {
  dayKey: string;
  slotIndex: number;
  label: string;
}

export interface CardPoolProps {
  tripId: string;
  cards: CardWithSlot[];
  pendingSlot: PendingSlot | null;
  onAddManual: () => void;
  onEditCard: (card: CardWithSlot) => void;
  onDeleteCard: (card: CardWithSlot) => void;
  onPlaceCard: (card: CardWithSlot) => void;
  onCancelPending: () => void;
  onGenerated: () => Promise<void> | void;
}

// Left sidebar: pool of unassigned cards + generate/add actions. Registered as
// a real dnd-kit droppable so dragging a placed card back here unassigns it.
export function CardPool({
  tripId,
  cards,
  pendingSlot,
  onAddManual,
  onEditCard,
  onDeleteCard,
  onPlaceCard,
  onCancelPending,
  onGenerated,
}: CardPoolProps) {
  const ids = cards.map((c) => `pool:${c.id}`);
  const { setNodeRef, isOver } = useDroppable({ id: "pool", data: { type: "pool" } });

  return (
    <aside className="flex h-full w-44 shrink-0 flex-col border-r border-slate-200 bg-slate-50 sm:w-80">
      <div className="border-b border-slate-200 bg-white px-2 py-2 sm:px-3 sm:py-2.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers size={15} className="text-brand-600" />
            <h2 className="text-xs font-semibold text-slate-700 sm:text-sm">Pool</h2>
            <span className="rounded-full bg-slate-200 px-1.5 text-[10px] font-semibold text-slate-600">
              {cards.length}
            </span>
          </div>
        </div>
        <div className="space-y-2">
          <GenerateButton tripId={tripId} onGenerated={onGenerated} />
          <Button variant="secondary" size="sm" className="w-full" onClick={onAddManual}>
            <Plus size={14} /> Add Card
          </Button>
        </div>
      </div>

      {pendingSlot && (
        <div className="flex items-center justify-between gap-1 border-b border-brand-200 bg-brand-50 px-2 py-1.5 text-[11px] text-brand-800">
          <span className="truncate">Place at {pendingSlot.label}</span>
          <button onClick={onCancelPending} className="shrink-0 font-semibold text-brand-600 hover:underline">
            Cancel
          </button>
        </div>
      )}

      <div
        ref={setNodeRef}
        className={`scrollbar-thin flex-1 overflow-y-auto p-2 sm:p-3 ${isOver ? "bg-brand-100" : ""}`}
      >
        {cards.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-1 text-center text-xs text-slate-400">
            <Inbox size={28} />
            <span>No cards in the pool.<br />Generate some or add one manually.</span>
          </div>
        ) : (
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {cards.map((c) => (
                <PoolCard
                  key={c.id}
                  card={c}
                  pickMode={!!pendingSlot}
                  onEdit={onEditCard}
                  onDelete={onDeleteCard}
                  onPick={onPlaceCard}
                />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </aside>
  );
}
