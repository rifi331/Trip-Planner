import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { patchSlotSchema } from "@/lib/validations";
import { findConflictingSlot } from "@/lib/overlap";
import { atLocalMidnight } from "@/lib/date-utils";
import { ok, notFound, fail, conflict, parseOrFail, handleRoute } from "@/lib/api-utils";

type Params = { params: { slotId: string } };

/**
 * PATCH /api/itinerary/[slotId]
 * Precision update for a single slot: resize (durationMinutes) and/or move
 * (startTime / assignedDate). Used by the live drag and resize interactions.
 *
 * Overlap is checked against every other slot of the trip on the resulting day.
 */
export async function PATCH(request: Request, { params }: Params): Promise<NextResponse> {
  return handleRoute(async () => {
    const existing = await prisma.itinerarySlot.findUnique({
      where: { id: params.slotId },
      include: { trip: { select: { id: true, startDate: true, endDate: true } } },
    });
    if (!existing) return notFound("Itinerary slot not found");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Invalid JSON body");
    }

    const parsed = parseOrFail(patchSlotSchema, body);
    if (!parsed.success) return parsed.response;

    const assignedDate = parsed.data.assignedDate
      ? atLocalMidnight(parsed.data.assignedDate)
      : existing.assignedDate;
    const startTime = parsed.data.startTime ?? existing.startTime;
    const durationMinutes = parsed.data.durationMinutes ?? existing.durationMinutes;

    // Assigned date must stay inside the trip range.
    if (
      atLocalMidnight(assignedDate) < atLocalMidnight(existing.trip.startDate) ||
      atLocalMidnight(assignedDate) > atLocalMidnight(existing.trip.endDate)
    ) {
      return fail("Assigned date is outside the trip date range.", 400);
    }

    const conflictSlot = await findConflictingSlot({
      tripId: existing.tripId,
      cardId: existing.cardId,
      assignedDate,
      startTime,
      durationMinutes,
      excludeSlotId: existing.id,
    });
    if (conflictSlot) {
      return conflict(
        `This card overlaps another slot starting at ${conflictSlot.startTime}.`,
      );
    }

    const updated = await prisma.itinerarySlot.update({
      where: { id: params.slotId },
      data: { assignedDate, startTime, durationMinutes },
      include: { card: true },
    });

    return ok(updated);
  });
}
