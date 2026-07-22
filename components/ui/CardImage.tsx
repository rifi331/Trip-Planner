"use client";

import React, { useState } from "react";
import { ImageOff } from "lucide-react";
import type { CardCategory } from "@prisma/client";

// Placeholder background per category when no image / load fails.
const PLACEHOLDER: Record<CardCategory, string> = {
  HISTORICAL: "bg-amber-100 text-amber-400",
  UNIQUE: "bg-violet-100 text-violet-400",
  INSTAGRAMMABLE: "bg-pink-100 text-pink-400",
  TOURIST_ATTRACTION: "bg-blue-100 text-blue-400",
  RESTAURANT: "bg-red-100 text-red-400",
  STREET_FOOD: "bg-orange-100 text-orange-400",
  NATURE: "bg-green-100 text-green-400",
  MUSEUM: "bg-teal-100 text-teal-400",
};

export interface CardImageProps {
  imageUrl?: string | null;
  category: CardCategory;
  alt: string;
  className?: string;
}

// Renders the card image, falling back to a category-colored placeholder
// with an icon if there is no URL or the image fails to load.
export function CardImage({ imageUrl, category, alt, className = "" }: CardImageProps) {
  const [failed, setFailed] = useState(false);
  const showImage = imageUrl && !failed;

  if (!showImage) {
    return (
      <div className={`flex items-center justify-center ${PLACEHOLDER[category]} ${className}`}>
        <ImageOff size={20} />
      </div>
    );
  }

  return (
    <img
      src={imageUrl as string}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`object-cover ${className}`}
    />
  );
}
