import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateCardsFromAI } from "@/lib/openai";
import { daysCountBetween } from "@/lib/date-utils";
import { ok, notFound, fail, handleRoute } from "@/lib/api-utils";
import { ALL_CATEGORIES } from "@/lib/constants";
import type { CardCategory } from "@prisma/client";

type Params = { params: { id: string } };

/**
 * POST /api/trips/[id]/generate-cards
 * Ask the AI to generate recommendation cards for the trip destination and
 * bulk-insert them into the Card table (unassigned - they go to the pool).
 *
 * Optional body: { categories?: CardCategory[] } to restrict the AI to a
 * subset of categories. Defaults to all categories.
 */
export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
  return handleRoute(async () => {
    const trip = await prisma.trip.findUnique({ where: { id: params.id } });
    if (!trip) return notFound("Trip not found");

    // Parse optional category filter from the body.
    let categories: CardCategory[] | undefined;
    try {
      const body = await request.json();
      if (Array.isArray(body?.categories) && body.categories.length > 0) {
        const valid = body.categories.filter((c: unknown): c is CardCategory =>
          ALL_CATEGORIES.includes(c as CardCategory),
        );
        categories = valid.length > 0 ? valid : undefined;
      }
    } catch {
      // No body or invalid JSON is fine — generate across all categories.
    }

    const daysCount = daysCountBetween(trip.startDate, trip.endDate);

    let aiCards;
    try {
      aiCards = await generateCardsFromAI(trip.destination, daysCount, categories);
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI generation failed";
      return fail(message, 502);
    }

    // Skip duplicates: only insert cards whose title does not already exist in
    // this trip (case-insensitive). This makes re-clicking "Generate" additive
    // for genuinely new places instead of piling on duplicates.
    const existingTitles = new Set(
      (await prisma.card.findMany({
        where: { tripId: trip.id },
        select: { title: true },
      })).map((c) => c.title.trim().toLowerCase()),
    );
    const newCards = aiCards.filter(
      (c) => !existingTitles.has(c.title.trim().toLowerCase()),
    );

    if (newCards.length === 0) {
      return ok({ count: 0, cards: [], skipped: aiCards.length }, 200);
    }

    const created = await prisma.card.createMany({
      data: newCards.map((c) => ({
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

    const cards = await prisma.card.findMany({
      where: { tripId: trip.id, isAiGenerated: true },
      orderBy: { createdAt: "desc" },
      take: created.count,
      include: { itinerarySlot: true },
    });

    return ok({ count: created.count, cards, skipped: aiCards.length - newCards.length }, 201);
  });
}
