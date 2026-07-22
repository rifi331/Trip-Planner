import { prisma } from "@/lib/prisma";
import {
  atLocalMidnight,
  isSameDay,
  timeToMinutes,
  intervalsOverlap,
} from "@/lib/date-utils";
import type { ItinerarySlotInput } from "@/lib/validations";

/**
 * Overlap detection for itinerary slots.
 *
 * A trip's timeline is a single column per day, so two placed cards on the
 * same day cannot overlap in time. We never allow stacking (no parallel
 * scheduling), therefore any overlap is a 409 Conflict.
 */

export interface ExistingSlot {
  id: string;
  cardId: string;
  assignedDate: Date;
  startTime: string;
  durationMinutes: number;
}

/**
 * Check whether placing/updating a slot would overlap an existing slot on the
 * same day. The slot being edited (excludeSlotId / excludeCardId) is ignored.
 *
 * Returns the conflicting slot, or null if there is no conflict.
 */
export async function findConflictingSlot(args: {
  tripId: string;
  cardId: string;
  assignedDate: Date;
  startTime: string;
  durationMinutes: number;
  excludeSlotId?: string;
}): Promise<ExistingSlot | null> {
  const day = atLocalMidnight(args.assignedDate);

  // Fetch every slot on that day for the trip; the day-grid is small enough
  // that loading the whole day is cheaper than a complicated SQL filter.
  const sameDaySlots = await prisma.itinerarySlot.findMany({
    where: { tripId: args.tripId },
    select: {
      id: true,
      cardId: true,
      assignedDate: true,
      startTime: true,
      durationMinutes: true,
    },
  });

  const target = {
    startMin: timeToMinutes(args.startTime),
    endMin: timeToMinutes(args.startTime) + args.durationMinutes,
  };

  for (const slot of sameDaySlots) {
    if (!isSameDay(atLocalMidnight(slot.assignedDate), day)) continue;
    if (slot.id === args.excludeSlotId) continue;
    if (slot.cardId === args.cardId) continue; // same card - not a conflict

    const other = {
      startMin: timeToMinutes(slot.startTime),
      endMin: timeToMinutes(slot.startTime) + slot.durationMinutes,
    };

    if (intervalsOverlap(target, other)) {
      return slot;
    }
  }

  return null;
}

/**
 * Validate a batch of slots for internal overlaps (two slots in the batch
 * that would collide with each other on the same day).
 */
export function findInternalBatchConflict(slots: ItinerarySlotInput[]): string | null {
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i];
      const b = slots[j];
      if (a.cardId === b.cardId) continue;
      if (!isSameDay(atLocalMidnight(a.assignedDate), atLocalMidnight(b.assignedDate))) continue;

      const ia = {
        startMin: timeToMinutes(a.startTime),
        endMin: timeToMinutes(a.startTime) + a.durationMinutes,
      };
      const ib = {
        startMin: timeToMinutes(b.startTime),
        endMin: timeToMinutes(b.startTime) + b.durationMinutes,
      };

      if (intervalsOverlap(ia, ib)) {
        return `Cards ${a.cardId} and ${b.cardId} overlap on the same day.`;
      }
    }
  }
  return null;
}
