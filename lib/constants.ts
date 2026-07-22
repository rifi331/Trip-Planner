import type { CardCategory } from "@prisma/client";

/**
 * Central place for shared constants used across the API, the AI integration
 * and the frontend (timeline grid configuration).
 */

export const ALL_CATEGORIES: CardCategory[] = [
  "HISTORICAL",
  "UNIQUE",
  "INSTAGRAMMABLE",
  "TOURIST_ATTRACTION",
  "RESTAURANT",
  "STREET_FOOD",
  "NATURE",
  "MUSEUM",
];

/** Human readable labels for each card category, shown in the UI. */
export const CATEGORY_LABELS: Record<CardCategory, string> = {
  HISTORICAL: "Historical",
  UNIQUE: "Unique",
  INSTAGRAMMABLE: "Instagrammable",
  TOURIST_ATTRACTION: "Tourist Attraction",
  RESTAURANT: "Restaurant",
  STREET_FOOD: "Street Food",
  NATURE: "Nature",
  MUSEUM: "Museum",
};

/** A short helper description for the AI prompt and the manual card form. */
export const CATEGORY_DESCRIPTIONS: Record<CardCategory, string> = {
  HISTORICAL: "Historical sites and heritage landmarks",
  UNIQUE: "Unusual or one-of-a-kind places",
  INSTAGRAMMABLE: "Photogenic and highly instagrammable spots",
  TOURIST_ATTRACTION: "Popular must-see tourist attractions",
  RESTAURANT: "Restaurants and dining places",
  STREET_FOOD: "Street food stalls and local bites",
  NATURE: "Parks, beaches, mountains and natural scenery",
  MUSEUM: "Museums, galleries and cultural institutions",
};

// ---- Timeline grid configuration -------------------------------------------

/** Grid interval in minutes. The whole grid is built on 30-minute slots. */
export const SLOT_INTERVAL_MINUTES = 30;

/** Number of 30-minute slots in a full 24-hour day (00:00 - 23:30). */
export const SLOTS_PER_DAY = 48;

/** Hour the canvas auto-scrolls to on initial render. */
export const DEFAULT_FOCUS_HOUR = 8;

/** Pixel height of one 30-minute slot on the timeline grid. */
export const SLOT_HEIGHT_PX = 40;

/** Minimum allowed card duration in minutes (one slot). */
export const MIN_DURATION_MINUTES = 30;

/** Maximum allowed card duration in minutes (6 hours). */
export const MAX_DURATION_MINUTES = 360;

/** Cost level range (1-4) rendered as $ - $$$$. */
export const MIN_COST_LEVEL = 1;
export const MAX_COST_LEVEL = 4;

/** Default OpenAI model used for the card generator. */
export const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";

/** Number of cards the AI is asked to generate per trip. */
export const AI_CARDS_PER_TRIP = 24;
