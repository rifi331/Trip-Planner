import { z } from "zod";
import type { CardCategory } from "@prisma/client";
import {
  MIN_COST_LEVEL,
  MAX_COST_LEVEL,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  ALL_CATEGORIES,
} from "@/lib/constants";
import { isValidTimeString, clampDuration } from "@/lib/date-utils";

// Strict enum tuple so Zod infers the literal CardCategory union instead of
// a generic string.
const CATEGORY_ENUM = z.enum(
  ALL_CATEGORIES as [CardCategory, ...CardCategory[]],
);

/** Reusable time string validator ("HH:mm"). */
const timeString = z
  .string()
  .refine(isValidTimeString, { message: 'startTime must be "HH:mm" (00:00 - 23:30)' });

/** Reusable duration validator - multiple of 30, clamped to [30, 360]. */
const duration = z
  .number()
  .int()
  .transform((v) => clampDuration(v))
  .refine((v) => v >= MIN_DURATION_MINUTES && v <= MAX_DURATION_MINUTES, {
    message: `durationMinutes must be between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES}`,
  });

/** Reusable cost level validator (1-4). */
const costLevel = z
  .number()
  .int()
  .min(MIN_COST_LEVEL)
  .max(MAX_COST_LEVEL)
  .default(2);

// ---- Trip ------------------------------------------------------------------

export const createTripSchema = z.object({
  title: z.string().min(1).max(200),
  destination: z.string().min(1).max(200),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export const updateTripSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  destination: z.string().min(1).max(200).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type CreateTripInput = z.infer<typeof createTripSchema>;
export type UpdateTripInput = z.infer<typeof updateTripSchema>;

// ---- Card ------------------------------------------------------------------

// Optional image URL (any http(s) string). Manual cards may set one.
const imageUrlField = z
  .string()
  .url()
  .optional()
  .nullable()
  .transform((v) => (v ? v.trim() : null));

export const createCardSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  category: CATEGORY_ENUM,
  defaultDurationMinutes: z
    .number()
    .int()
    .transform((v) => clampDuration(v))
    .default(MIN_DURATION_MINUTES),
  costLevel,
  imageUrl: imageUrlField,
});

export const updateCardSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: CATEGORY_ENUM.optional(),
  defaultDurationMinutes: z
    .number()
    .int()
    .transform((v) => clampDuration(v))
    .optional(),
  costLevel: z.number().int().min(MIN_COST_LEVEL).max(MAX_COST_LEVEL).optional(),
  imageUrl: imageUrlField.optional(),
});

export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;

// ---- Itinerary -------------------------------------------------------------

/** A single slot payload for batch save (POST /api/trips/[id]/itinerary). */
export const itinerarySlotInputSchema = z.object({
  cardId: z.string().uuid(),
  assignedDate: z.coerce.date(),
  startTime: timeString,
  durationMinutes: duration,
});

export const batchItinerarySchema = z.object({
  slots: z.array(itinerarySlotInputSchema).min(1),
});

/** PATCH payload for a single slot (resize / move). */
export const patchSlotSchema = z.object({
  assignedDate: z.coerce.date().optional(),
  startTime: timeString.optional(),
  durationMinutes: duration.optional(),
});

export type ItinerarySlotInput = z.infer<typeof itinerarySlotInputSchema>;
export type BatchItineraryInput = z.infer<typeof batchItinerarySchema>;
export type PatchSlotInput = z.infer<typeof patchSlotSchema>;
