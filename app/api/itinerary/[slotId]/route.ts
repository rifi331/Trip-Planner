import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { patchSlotSchema } from "@/lib/validations";
import { fitMaxDuration } from "@/lib/overlap";
import { atLocalMidnight } from "@/lib/date-utils";
import { ok, notFound, fail, parseOrFail, handleRoute } from "@/lib/api-utils";

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

    // Auto-fit the duration so it fits the gap before the next card on the
    // resulting day, instead of rejecting with 409 on overlap. If the resize
    // requested more than the gap allows, it shrinks to fit.
    const fitted = await fitMaxDuration({
      tripId: existing.tripId,
      cardId: existing.cardId,
      assignedDate,
      startTime,
      requestedDuration: durationMinutes,
      excludeSlotId: existing.id,
    });

    const updated = await prisma.itinerarySlot.update({
      where: { id: params.slotId },
      data: { assignedDate, startTime: fitted.startTime, durationMinutes: fitted.durationMinutes },
      include: { card: true },
    });

    return ok(updated);
  });
}
