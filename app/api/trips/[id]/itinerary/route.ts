import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { batchItinerarySchema } from "@/lib/validations";
import { fitMaxDuration } from "@/lib/overlap";
import { atLocalMidnight } from "@/lib/date-utils";
import { ok, notFound, fail, parseOrFail, handleRoute } from "@/lib/api-utils";

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

    // Auto-fit each slot's duration so it fits the gap before the next card
    // on that day (instead of rejecting with 409). The requested duration is
    // kept when there is room; otherwise it is shrunk to the nearest 30 min.
    // Process sequentially so each fit accounts for the previous one.
    const fitted: { cardId: string; assignedDate: Date; startTime: string; durationMinutes: number }[] = [];
    for (const slot of slots) {
      const fit = await fitMaxDuration({
        tripId: trip.id,
        cardId: slot.cardId,
        assignedDate: slot.assignedDate,
        startTime: slot.startTime,
        requestedDuration: slot.durationMinutes,
      });
      fitted.push({
        cardId: slot.cardId,
        assignedDate: atLocalMidnight(slot.assignedDate),
        startTime: fit.startTime, // may be pushed forward to avoid an overlap
        durationMinutes: fit.durationMinutes,
      });
      // Persist this fitted slot immediately so the next iteration sees it.
      await prisma.itinerarySlot.upsert({
        where: { cardId: slot.cardId },
        create: {
          tripId: trip.id,
          cardId: slot.cardId,
          assignedDate: atLocalMidnight(slot.assignedDate),
          startTime: fit.startTime,
          durationMinutes: fit.durationMinutes,
        },
        update: {
          assignedDate: atLocalMidnight(slot.assignedDate),
          startTime: fit.startTime,
          durationMinutes: fit.durationMinutes,
        },
      });
    }

    // Re-read the final state to return to the client.
    const result = await prisma.itinerarySlot.findMany({
      where: { tripId: trip.id, cardId: { in: fitted.map((f) => f.cardId) } },
    });

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
