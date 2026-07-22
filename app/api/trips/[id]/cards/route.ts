import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCardSchema } from "@/lib/validations";
import { ok, notFound, fail, parseOrFail, handleRoute } from "@/lib/api-utils";

type Params = { params: { id: string } };

/**
 * POST /api/trips/[id]/cards
 * Create a manual card authored by the user (isAiGenerated = false).
 */
export async function POST(request: Request, { params }: Params): Promise<NextResponse> {
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

    const parsed = parseOrFail(createCardSchema, body);
    if (!parsed.success) return parsed.response;

    const card = await prisma.card.create({
      data: {
        tripId: trip.id,
        title: parsed.data.title,
        description: parsed.data.description ?? null,
        category: parsed.data.category,
        defaultDurationMinutes: parsed.data.defaultDurationMinutes,
        costLevel: parsed.data.costLevel,
        imageUrl: parsed.data.imageUrl ?? null,
        isAiGenerated: false,
      },
      include: { itinerarySlot: true },
    });

    return ok(card, 201);
  });
}
