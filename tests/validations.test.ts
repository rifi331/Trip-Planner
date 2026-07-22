import { describe, it, expect } from "vitest";
import {
  createTripSchema,
  updateTripSchema,
  createCardSchema,
  updateCardSchema,
  itinerarySlotInputSchema,
  batchItinerarySchema,
  patchSlotSchema,
} from "@/lib/validations";

describe("createTripSchema", () => {
  it("accepts a valid trip", () => {
    const r = createTripSchema.safeParse({
      title: "Kyoto",
      destination: "Japan",
      startDate: "2026-07-01",
      endDate: "2026-07-05",
    });
    expect(r.success).toBe(true);
  });
  it("rejects empty title", () => {
    expect(createTripSchema.safeParse({ title: "", destination: "x", startDate: "2026-07-01", endDate: "2026-07-01" }).success).toBe(false);
  });
  it("rejects missing fields", () => {
    expect(createTripSchema.safeParse({ title: "x" }).success).toBe(false);
  });
});

describe("updateTripSchema", () => {
  it("accepts partial updates", () => {
    expect(updateTripSchema.safeParse({ title: "New" }).success).toBe(true);
  });
  it("accepts an empty object", () => {
    expect(updateTripSchema.safeParse({}).success).toBe(true);
  });
});

describe("createCardSchema", () => {
  it("accepts a valid card and defaults duration + cost", () => {
    const r = createCardSchema.safeParse({ title: "Shrine", category: "HISTORICAL" });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.defaultDurationMinutes).toBe(30);
      expect(r.data.costLevel).toBe(2);
    }
  });
  it("clamps duration into range", () => {
    const r = createCardSchema.safeParse({ title: "x", category: "MUSEUM", defaultDurationMinutes: 500 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.defaultDurationMinutes).toBe(360);
  });
  it("rejects invalid category", () => {
    expect(createCardSchema.safeParse({ title: "x", category: "INVALID" }).success).toBe(false);
  });
  it("rejects cost level out of range", () => {
    expect(createCardSchema.safeParse({ title: "x", category: "MUSEUM", costLevel: 9 }).success).toBe(false);
  });
});

describe("updateCardSchema", () => {
  it("accepts partial", () => {
    expect(updateCardSchema.safeParse({ costLevel: 4 }).success).toBe(true);
  });
});

describe("itinerarySlotInputSchema / batchItinerarySchema", () => {
  const validSlot = {
    cardId: "123e4567-e89b-12d3-a456-426614174000",
    assignedDate: "2026-07-01",
    startTime: "08:00",
    durationMinutes: 60,
  };
  it("accepts a valid slot", () => {
    expect(itinerarySlotInputSchema.safeParse(validSlot).success).toBe(true);
  });
  it("rejects invalid startTime", () => {
    expect(itinerarySlotInputSchema.safeParse({ ...validSlot, startTime: "25:00" }).success).toBe(false);
  });
  it("rejects non-uuid cardId", () => {
    expect(itinerarySlotInputSchema.safeParse({ ...validSlot, cardId: "not-a-uuid" }).success).toBe(false);
  });
  it("batch requires at least one slot", () => {
    expect(batchItinerarySchema.safeParse({ slots: [] }).success).toBe(false);
  });
  it("batch accepts one valid slot", () => {
    expect(batchItinerarySchema.safeParse({ slots: [validSlot] }).success).toBe(true);
  });
});

describe("patchSlotSchema", () => {
  it("accepts all-empty (no-op)", () => {
    expect(patchSlotSchema.safeParse({}).success).toBe(true);
  });
  it("accepts resize only", () => {
    expect(patchSlotSchema.safeParse({ durationMinutes: 90 }).success).toBe(true);
  });
  it("clamps resize", () => {
    const r = patchSlotSchema.safeParse({ durationMinutes: 999 });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.durationMinutes).toBe(360);
  });
});
