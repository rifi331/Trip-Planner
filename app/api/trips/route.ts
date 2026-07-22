import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createTripSchema } from "@/lib/validations";
import { ok, created, fail, parseOrFail, handleRoute } from "@/lib/api-utils";

/**
 * GET /api/trips
 * Return all trips, most recently updated first. Cards and slots counts are
 * included for quick display in the trip list without a second round-trip.
 */
export async function GET(): Promise<NextResponse> {
  return handleRoute(async () => {
    const trips = await prisma.trip.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        _count: {
          select: { cards: true, itinerarySlots: true },
        },
      },
    });
    return ok(trips);
  });
}

/**
 * POST /api/trips
 * Create a new trip.
 */
export async function POST(request: Request): Promise<NextResponse> {
  return handleRoute(async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return fail("Invalid JSON body");
    }

    const parsed = parseOrFail(createTripSchema, body);
    if (!parsed.success) return parsed.response;
    const { title, destination, startDate, endDate } = parsed.data;

    if (endDate < startDate) {
      return fail("endDate must be on or after startDate", 400);
    }

    const trip = await prisma.trip.create({
      data: { title, destination, startDate, endDate },
    });
    return created(trip);
  });
}
