import { prisma } from "@/lib/prisma";
import {
  atLocalMidnight,
  isSameDay,
  timeToMinutes,
  intervalsOverlap,
  clampDuration,
} from "@/lib/date-utils";
import { SLOT_INTERVAL_MINUTES, MIN_DURATION_MINUTES, SLOTS_PER_DAY } from "@/lib/constants";
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

/**
 * Compute the effective start time and maximum duration (a multiple of 30,
 * >= 30) that a card can occupy on the given day WITHOUT overlapping any
 * existing slot. Used to auto-shrink/auto-shift a card to fit the available
 * gap instead of rejecting the placement.
 *
 * If the requested start falls inside an already-running slot, the start is
 * pushed forward to the end of that slot before computing the available gap.
 * If the gap is too small to even fit the minimum (30 min), the minimum is
 * returned anyway — the caller may then decide whether to reject.
 */
export async function fitMaxDuration(args: {
  tripId: string;
  cardId: string;
  assignedDate: Date;
  startTime: string;
  requestedDuration: number;
  excludeSlotId?: string;
}): Promise<{ startTime: string; durationMinutes: number }> {
  const day = atLocalMidnight(args.assignedDate);
  const requestedStart = timeToMinutes(args.startTime);
  const endOfDay = SLOTS_PER_DAY * SLOT_INTERVAL_MINUTES; // 1440

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

  // Compute the intervals occupied by other cards on this day.
  const others: { startMin: number; endMin: number }[] = [];
  for (const slot of sameDaySlots) {
    if (!isSameDay(atLocalMidnight(slot.assignedDate), day)) continue;
    if (slot.id === args.excludeSlotId) continue;
    if (slot.cardId === args.cardId) continue;
    const s = timeToMinutes(slot.startTime);
    others.push({ startMin: s, endMin: s + slot.durationMinutes });
  }

  // If the requested start falls inside an existing slot, push the start
  // forward to just after that slot ends (snap to next 30-min boundary).
  let effectiveStart = requestedStart;
  for (const o of others) {
    if (effectiveStart >= o.startMin && effectiveStart < o.endMin) {
      effectiveStart = Math.max(effectiveStart, o.endMin);
    }
  }

  // Find the soonest start of any slot that begins at/after the effective
  // start (the "ceiling" of the available gap).
  let ceiling = endOfDay;
  for (const o of others) {
    if (o.startMin > effectiveStart && o.startMin < ceiling) {
      ceiling = o.startMin;
    }
    // Also handle a slot that still overlaps the pushed-forward start.
    if (o.startMin <= effectiveStart && o.endMin > effectiveStart && o.endMin < ceiling) {
      ceiling = o.endMin;
    }
  }

  const available = ceiling - effectiveStart; // minutes available in the gap
  const requested = clampDuration(args.requestedDuration);

  // Snap down to the nearest 30, but never below the minimum.
  const fitted = Math.max(
    MIN_DURATION_MINUTES,
    Math.floor(Math.min(available, requested) / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES,
  );
  // Convert the effective start (minutes) back to "HH:mm".
  const h = Math.floor(effectiveStart / 60);
  const m = effectiveStart % 60;
  const startTimeStr = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  return { startTime: startTimeStr, durationMinutes: clampDuration(fitted) };
}

