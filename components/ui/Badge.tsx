import React from "react";
import type { CardCategory } from "@prisma/client";
import { CATEGORY_LABELS } from "@/lib/constants";

// Category badge using the themed cat.* palette (tinted bg + border + text).
const STYLES: Record<CardCategory, string> = {
  HISTORICAL: "bg-amber-100 text-amber-800 border-amber-300",
  UNIQUE: "bg-violet-100 text-violet-800 border-violet-300",
  INSTAGRAMMABLE: "bg-pink-100 text-pink-800 border-pink-300",
  TOURIST_ATTRACTION: "bg-blue-100 text-blue-800 border-blue-300",
  RESTAURANT: "bg-red-100 text-red-800 border-red-300",
  STREET_FOOD: "bg-orange-100 text-orange-800 border-orange-300",
  NATURE: "bg-green-100 text-green-800 border-green-300",
  MUSEUM: "bg-teal-100 text-teal-800 border-teal-300",
};

export function CategoryBadge({ category }: { category: CardCategory }) {
  return (
    <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STYLES[category]}`}>
      {CATEGORY_LABELS[category]}
    </span>
  );
}
