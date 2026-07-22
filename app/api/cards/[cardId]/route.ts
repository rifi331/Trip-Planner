import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateCardSchema } from "@/lib/validations";
import { ok, notFound, fail, parseOrFail, handleRoute } from "@/lib/api-utils";

type Params = { params: { cardId: string } };

/**
 * PUT /api/cards/[cardId]
 * Update a card (title, description, category, duration, cost level).
 */
export async function PUT(request: Request, { params }: Params): Promise<NextResponse> {
  return handleRoute(async () => {
    const existing = await prisma.card.findUnique({
      where: { id: params.cardId },
      select: { id: true },
    });
    if (!existing) return notFound("Card not found");

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Invalid JSON body");
    }

    const parsed = parseOrFail(updateCardSchema, body);
    if (!parsed.success) return parsed.response;

    const updated = await prisma.card.update({
      where: { id: params.cardId },
      data: parsed.data,
      include: { itinerarySlot: true },
    });
    return ok(updated);
  });
}

/**
 * DELETE /api/cards/[cardId]
 * Delete a card. The related ItinerarySlot is removed automatically
 * (onDelete: Cascade on Card <- ItinerarySlot).
 */
export async function DELETE(_request: Request, { params }: Params): Promise<NextResponse> {
  return handleRoute(async () => {
    const existing = await prisma.card.findUnique({
      where: { id: params.cardId },
      select: { id: true },
    });
    if (!existing) return notFound("Card not found");

    await prisma.card.delete({ where: { id: params.cardId } });
    return ok({ id: params.cardId, deleted: true });
  });
}
