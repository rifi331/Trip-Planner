import type { Card, ItinerarySlot, Trip } from "@prisma/client";

// Shared client-side types derived from the Prisma payload shapes returned by
// the API. Keeping them in one place avoids importing @prisma/client into
// browser bundles.

export type CardWithSlot = Card & { itinerarySlot: ItinerarySlot | null };
export type TripWithRelations = Trip & { cards: CardWithSlot[]; itinerarySlots: ItinerarySlot[] };
