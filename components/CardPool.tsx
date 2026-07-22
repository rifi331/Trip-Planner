"use client";

import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus, Inbox, Layers } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PoolCard } from "@/components/PoolCard";
import { GenerateButton } from "@/components/GenerateButton";
import type { CardWithSlot } from "@/lib/types";

export interface CardPoolProps {
  tripId: string;
  cards: CardWithSlot[];
  onAddManual: () => void;
  onEditCard: (card: CardWithSlot) => void;
  onDeleteCard: (card: CardWithSlot) => void;
  onGenerated: () => Promise<void> | void;
}

// Trello-style left column: header with count + actions, then a stack of cards.
// The whole column is a drop target for unassigning (data-droppable="pool").
export function CardPool({ tripId, cards, onAddManual, onEditCard, onDeleteCard, onGenerated }: CardPoolProps) {
  const ids = cards.map((c) => `pool:${c.id}`);
  return (
    <aside
      id="card-pool"
      data-droppable="pool"
      className="flex h-full w-80 shrink-0 flex-col border-r border-slate-200 bg-slate-50"
    >
      <div className="border-b border-slate-200 bg-white px-3 py-2.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Layers size={15} className="text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-700">Pool</h2>
            <span className="rounded-full bg-slate-200 px-1.5 text-[10px] font-semibold text-slate-600">{cards.length}</span>
          </div>
        </div>
        <div className="space-y-2">
          <GenerateButton tripId={tripId} onGenerated={onGenerated} />
          <Button variant="secondary" size="sm" className="w-full" onClick={onAddManual}>
            <Plus size={14} /> Add Manual Card
          </Button>
        </div>
      </div>
      <div className="scrollbar-thin flex-1 overflow-y-auto p-3">
        {cards.length === 0 ? (
          <div className="mt-10 flex flex-col items-center gap-1 text-center text-xs text-slate-400">
            <Inbox size={28} />
            <span>No cards in the pool.<br />Generate some or add one manually.</span>
          </div>
        ) : (
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {cards.map((c) => (
                <PoolCard key={c.id} card={c} onEdit={onEditCard} onDelete={onDeleteCard} />
              ))}
            </div>
          </SortableContext>
        )}
      </div>
    </aside>
  );
}
