import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma so findConflictingSlot runs without a database.
vi.mock("@/lib/prisma", () => {
  let store: {
    id: string;
    cardId: string;
    assignedDate: Date;
    startTime: string;
    durationMinutes: number;
  }[] = [];
  return {
    prisma: {
      itinerarySlot: {
        findMany: vi.fn(async () => store),
        __setStore: (s: typeof store) => { store = s; },
      },
    },
  };
});

import { prisma } from "@/lib/prisma";
import { findConflictingSlot, findInternalBatchConflict, fitMaxDuration } from "@/lib/overlap";
import type { ItinerarySlotInput } from "@/lib/validations";

// Helper to set the mock DB rows for the next findConflictingSlot call.
function setStore(rows: { id: string; cardId: string; day: string; start: string; dur: number }[]) {
  (
    prisma.itinerarySlot as unknown as { __setStore: (s: unknown[]) => void }
  ).__setStore(
    rows.map((r) => ({
      id: r.id,
      cardId: r.cardId,
      assignedDate: new Date(r.day),
      startTime: r.start,
      durationMinutes: r.dur,
    })),
  );
}

const baseDay = "2026-07-01";
const cardA = "card-a";
const cardB = "card-b";

describe("findConflictingSlot", () => {
  beforeEach(() => setStore([]));

  it("returns null when no other slots exist", async () => {
    setStore([]);
    const r = await findConflictingSlot({
      tripId: "t1",
      cardId: cardA,
      assignedDate: new Date(baseDay),
      startTime: "08:00",
      durationMinutes: 60,
    });
    expect(r).toBeNull();
  });

  it("returns null when the only existing slot is the same card", async () => {
    setStore([{ id: "s1", cardId: cardA, day: baseDay, start: "08:00", dur: 60 }]);
    const r = await findConflictingSlot({
      tripId: "t1",
      cardId: cardA,
      assignedDate: new Date(baseDay),
      startTime: "09:00",
      durationMinutes: 60,
    });
    expect(r).toBeNull();
  });

  it("detects an overlap with a different card on the same day", async () => {
    setStore([{ id: "s1", cardId: cardB, day: baseDay, start: "08:30", dur: 60 }]);
    const r = await findConflictingSlot({
      tripId: "t1",
      cardId: cardA,
      assignedDate: new Date(baseDay),
      startTime: "09:00",
      durationMinutes: 60,
    });
    expect(r).not.toBeNull();
    expect(r?.id).toBe("s1");
  });

  it("treats touching edges as not overlapping", async () => {
    setStore([{ id: "s1", cardId: cardB, day: baseDay, start: "08:00", dur: 60 }]); // ends 09:00
    const r = await findConflictingSlot({
      tripId: "t1",
      cardId: cardA,
      assignedDate: new Date(baseDay),
      startTime: "09:00", // starts exactly when the other ends
      durationMinutes: 60,
    });
    expect(r).toBeNull();
  });

  it("ignores slots on a different day", async () => {
    setStore([{ id: "s1", cardId: cardB, day: "2026-07-02", start: "09:00", dur: 60 }]);
    const r = await findConflictingSlot({
      tripId: "t1",
      cardId: cardA,
      assignedDate: new Date(baseDay),
      startTime: "09:00",
      durationMinutes: 60,
    });
    expect(r).toBeNull();
  });

  it("respects excludeSlotId", async () => {
    setStore([{ id: "s1", cardId: cardB, day: baseDay, start: "09:00", dur: 60 }]);
    const r = await findConflictingSlot({
      tripId: "t1",
      cardId: cardA,
      assignedDate: new Date(baseDay),
      startTime: "09:00",
      durationMinutes: 60,
      excludeSlotId: "s1",
    });
    expect(r).toBeNull();
  });
});

describe("findInternalBatchConflict", () => {
  function slot(cardId: string, start: string, dur: number, day = baseDay): ItinerarySlotInput {
    return {
      cardId,
      assignedDate: new Date(day),
      startTime: start,
      durationMinutes: dur,
    } as ItinerarySlotInput;
  }

  it("returns null when slots are on different days", () => {
    const r = findInternalBatchConflict([
      slot(cardA, "09:00", 60, baseDay),
      slot(cardB, "09:00", 60, "2026-07-02"),
    ]);
    expect(r).toBeNull();
  });

  it("returns null when slots touch but do not overlap", () => {
    const r = findInternalBatchConflict([slot(cardA, "08:00", 60), slot(cardB, "09:00", 60)]);
    expect(r).toBeNull();
  });

  it("detects an overlap between two slots in the batch", () => {
    const r = findInternalBatchConflict([slot(cardA, "08:00", 90), slot(cardB, "09:00", 60)]);
    expect(r).toContain("overlap");
  });

  it("ignores the same card appearing twice", () => {
    const r = findInternalBatchConflict([slot(cardA, "08:00", 120), slot(cardA, "09:00", 60)]);
    expect(r).toBeNull();
  });
});
