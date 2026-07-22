import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCardsFromAI } from "@/lib/openai";
import { daysCountBetween } from "@/lib/date-utils";
import { ok, notFound, fail, handleRoute } from "@/lib/api-utils";

type Params = { params: { id: string } };

/**
 * POST /api/trips/[id]/generate-cards
 * Ask the AI to generate recommendation cards for the trip destination and
 * bulk-insert them into the Card table (unassigned - they go to the pool).
 */
export async function POST(_request: Request, { params }: Params): Promise<NextResponse> {
  return handleRoute(async () => {
    const trip = await prisma.trip.findUnique({ where: { id: params.id } });
    if (!trip) return notFound("Trip not found");

    const daysCount = daysCountBetween(trip.startDate, trip.endDate);

    let aiCards;
    try {
      aiCards = await generateCardsFromAI(trip.destination, daysCount);
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generation failed";
      return fail(message, 502);
    }

    const created = await prisma.card.createMany({
      data: aiCards.map((c) => ({
        tripId: trip.id,
        title: c.title,
        description: c.description,
        category: c.category,
        defaultDurationMinutes: c.defaultDurationMinutes,
        costLevel: c.costLevel,
        imageUrl: c.imageUrl,
        isAiGenerated: true,
      })),
    });

    // Return the freshly created cards so the client can append them to the
    // pool without a full refetch.
    const cards = await prisma.card.findMany({
      where: { tripId: trip.id, isAiGenerated: true },
      orderBy: { createdAt: "desc" },
      take: created.count,
      include: { itinerarySlot: true },
    });

    return ok({ count: created.count, cards }, 201);
  });
}
