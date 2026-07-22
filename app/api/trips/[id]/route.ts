import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateTripSchema } from "@/lib/validations";
import { ok, notFound, fail, parseOrFail, handleRoute } from "@/lib/api-utils";

type Params = { params: { id: string } };

/**
 * GET /api/trips/[id]
 * Fetch a single trip including all of its cards and placed itinerary slots.
 */
export async function GET(_request: Request, { params }: Params): Promise<NextResponse> {
  return handleRoute(async () => {
    const trip = await prisma.trip.findUnique({
      where: { id: params.id },
      include: {
        cards: {
          orderBy: { createdAt: "asc" },
          include: { itinerarySlot: true },
        },
        itinerarySlots: {
          orderBy: { startTime: "asc" },
        },
      },
    });

    if (!trip) return notFound("Trip not found");
    return ok(trip);
  });
}

/**
 * PUT /api/trips/[id]
 * Update trip details (title, destination, dates).
 */
export async function PUT(request: Request, { params }: Params): Promise<NextResponse> {
  return handleRoute(async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Invalid JSON body");
    }

    const parsed = parseOrFail(updateTripSchema, body);
    if (!parsed.success) return parsed.response;

    // Cross-field date validation when both are present.
    const existing = await prisma.trip.findUnique({
      where: { id: params.id },
      select: { startDate: true, endDate: true },
    });
    if (!existing) return notFound("Trip not found");

    const startDate = parsed.data.startDate ?? existing.startDate;
    const endDate = parsed.data.endDate ?? existing.endDate;
    if (endDate < startDate) {
      return fail("endDate must be on or after startDate", 400);
    }

    const updated = await prisma.trip.update({
      where: { id: params.id },
      data: parsed.data,
    });
    return ok(updated);
  });
}

/**
 * DELETE /api/trips/[id]
 * Delete a trip. Cards and ItinerarySlots are removed automatically because
 * the schema declares onDelete: Cascade on those relations.
 */
export async function DELETE(_request: Request, { params }: Params): Promise<NextResponse> {
  return handleRoute(async () => {
    const existing = await prisma.trip.findUnique({ where: { id: params.id } });
    if (!existing) return notFound("Trip not found");

    await prisma.trip.delete({ where: { id: params.id } });
    return ok({ id: params.id, deleted: true });
  });
}
