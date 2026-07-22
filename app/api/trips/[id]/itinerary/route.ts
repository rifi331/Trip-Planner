import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { batchItinerarySchema } from "@/lib/validations";
import { findConflictingSlot, findInternalBatchConflict } from "@/lib/overlap";
import { atLocalMidnight } from "@/lib/date-utils";
import { ok, notFound, fail, conflict, parseOrFail, handleRoute } from "@/lib/api-utils";

type Params = { params: { id: string } };

/**
 * POST /api/trips/[id]/itinerary
 * Batch save / move card positions on the timeline.
 *
 * For every slot in the payload we upsert the ItinerarySlot for the card
 * (cardId is @unique, so one card maps to at most one slot). Before writing,
 * we reject the whole batch if any slot overlaps an existing slot or another
 * slot in the same batch on the same day.
 */
export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  return handleRoute(async () => {
    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      select: { id: true, startDate: true, endDate: true },
    });
    if (!trip) return notFound("Trip not found");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Invalid JSON body");
    }

    const parsed = parseOrFail(batchItinerarySchema, body);
    if (!parsed.success) return parsed.response;
    const { slots } = parsed.data;

    // All cards must belong to this trip.
    const cardIds = slots.map((s) => s.cardId);
    const ownedCards = await prisma.card.findMany({
      where: { id: { in: cardIds }, tripId: trip.id },
      select: { id: true },
    });
    const ownedIds = new Set(ownedCards.map((c) => c.id));
    if (cardIds.some((id) => !ownedIds.has(id))) {
      return fail("One or more cards do not belong to this trip.", 400);
    }

    // All slots must fall inside the trip date range.
    for (const slot of slots) {
      const day = atLocalMidnight(slot.assignedDate);
      if (day < atLocalMidnight(trip.startDate) || day > atLocalMidnight(trip.endDate)) {
        return fail("Assigned date is outside the trip date range.", 400);
      }
    }

    // 1. Internal conflicts inside the batch itself.
    const internalConflict = findInternalBatchConflict(slots);
    if (internalConflict) return conflict(internalConflict);

    // 2. Conflicts with already-placed slots (excluding the cards in this batch).
    for (const slot of slots) {
      const conflictSlot = await findConflictingSlot({
        tripId: trip.id,
        cardId: slot.cardId,
        assignedDate: slot.assignedDate,
        startTime: slot.startTime,
        durationMinutes: slot.durationMinutes,
      });
      if (conflictSlot) {
        return conflict(
          `Card ${slot.cardId} overlaps an existing slot starting at ${conflictSlot.startTime}.`,
        );
      }
    }

    // Persist atomically: upsert every slot in one transaction.
    const result = await prisma.$transaction(
      slots.map((slot) =>
        prisma.itinerarySlot.upsert({
          where: { cardId: slot.cardId },
          create: {
            tripId: trip.id,
            cardId: slot.cardId,
            assignedDate: atLocalMidnight(slot.assignedDate),
            startTime: slot.startTime,
            durationMinutes: slot.durationMinutes,
          },
          update: {
            assignedDate: atLocalMidnight(slot.assignedDate),
            startTime: slot.startTime,
            durationMinutes: slot.durationMinutes,
          },
        }),
      ),
    );

    return ok({ saved: result.length, slots: result });
  });
}

/**
 * DELETE /api/trips/[id]/itinerary
 * Unassign one or more cards from the timeline (send them back to the pool).
 * Body: { cardIds: string[] } OR { cardId: string }.
 */
export async function DELETE(request: Request, { params }: Params): Promise<NextResponse> {
  return handleRoute(async () => {
    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      select: { id: true },
    });
    if (!trip) return notFound("Trip not found");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Invalid JSON body");
    }

    const payload = (body ?? {}) as Record<string, unknown>;
    const cardIds = Array.isArray(payload.cardIds)
      ? (payload.cardIds as unknown[]).filter((x): x is string => typeof x === "string")
      : typeof payload.cardId === "string"
        ? [payload.cardId]
        : [];

    if (cardIds.length === 0) {
      return fail("Provide cardIds (string[]) or cardId (string) to unassign.", 400);
    }

    const deleted = await prisma.itinerarySlot.deleteMany({
      where: { tripId: trip.id, cardId: { in: cardIds } },
    });

    return ok({ unassigned: deleted.count });
  });
}
