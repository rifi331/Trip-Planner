import OpenAI from "openai";
import type { CardCategory } from "@prisma/client";
import {
  ALL_CATEGORIES,
  AI_CARDS_PER_TRIP,
  DEFAULT_OPENAI_MODEL,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
  MIN_COST_LEVEL,
  MAX_COST_LEVEL,
  CATEGORY_DESCRIPTIONS,
} from "@/lib/constants";
import { clampDuration } from "@/lib/date-utils";

/**
 * AI integration: generate travel recommendation cards for a destination
 * using OpenAI's Structured Outputs (response_format json_schema) so the
 * model is guaranteed to return a valid array of cards matching our schema.
 */

export interface AICard {
  title: string;
  description: string;
  category: CardCategory;
  defaultDurationMinutes: number;
  costLevel: number;
  imageUrl: string;
}

/**
 * Build a no-key image URL for a place using loremflickr (query-based, returns
 * a real photo matching the keywords). gpt-4o-mini cannot fetch images itself,
 * so we synthesize a deterministic query from the place + destination.
 */
export function buildPlaceImageUrl(title: string, destination: string): string {
  const place = title.replace(/[^\p{L}\p{N}\s]/gu, "").trim().split(/\s+/).slice(0, 3).join(",");
  const dest = destination.replace(/[^\p{L}\p{N}\s,]/gu, "").trim().split(/[,\s]+/).slice(0, 2).join(",");
  const query = encodeURIComponent(`${place},${dest}`.toLowerCase());
  return `https://loremflickr.com/800/400/${query}`;
}

/**
 * Lazily build the OpenAI client so the server does not crash on boot if the
 * key is missing in environments that never call the generator.
 */
function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured on the server.");
  }
  return new OpenAI({ apiKey });
}

/**
 * JSON Schema passed to the OpenAI Structured Outputs feature. The model is
 * forced to emit an object that matches this schema exactly.
 */
function buildResponseSchema(categories?: CardCategory[]) {
  const allowedCategories = categories && categories.length > 0 ? categories : ALL_CATEGORIES;
  return {
    type: "object" as const,
    properties: {
      cards: {
        type: "array" as const,
        minItems: AI_CARDS_PER_TRIP,
        items: {
          type: "object" as const,
          properties: {
            title: { type: "string" as const },
            description: { type: "string" as const },
            category: {
              type: "string" as const,
              enum: allowedCategories,
            },
            defaultDurationMinutes: {
              type: "integer" as const,
              minimum: MIN_DURATION_MINUTES,
              maximum: MAX_DURATION_MINUTES,
            },
            costLevel: {
              type: "integer" as const,
              minimum: MIN_COST_LEVEL,
              maximum: MAX_COST_LEVEL,
            },
          },
          required: [
            "title",
            "description",
            "category",
            "defaultDurationMinutes",
            "costLevel",
          ],
          additionalProperties: false,
        },
      },
    },
    required: ["cards"],
    additionalProperties: false,
  };
}

function buildSystemPrompt(
  destination: string,
  daysCount: number,
  categories?: CardCategory[],
): string {
  const allowedCategories = categories && categories.length > 0 ? categories : ALL_CATEGORIES;
  const categoryGuide = allowedCategories
    .map((c) => `- ${c}: ${CATEGORY_DESCRIPTIONS[c]}`)
    .join("\n");
  const categoryConstraint =
    categories && categories.length > 0
      ? `IMPORTANT: ONLY use these categories the user selected: ${allowedCategories.join(", ")}. Do not use any other category.`
      : "Spread across all 8 categories.";

  return [
    "You are a professional local travel planner AI with deep on-the-ground knowledge.",
    `Generate ${AI_CARDS_PER_TRIP} distinct recommendation cards for ${destination}.`,
    `The trip lasts ${daysCount} day(s).`,
    "",
    "MIX of recommendations (roughly):",
    "- ~50% well-known attractions / must-sees.",
    "- ~50% HIDDEN GEMS - off-the-beaten-path spots, local favorites, family-run eateries,",
    "  quiet viewpoints, neighborhood walks and places mainly locals go to. Prioritize",
    "  authentic, lesser-known places a tourist would not easily find.",
    "",
    "Each card MUST use exactly one of these categories:",
    categoryGuide,
    categoryConstraint,
    "",
    "Rules:",
    "- defaultDurationMinutes must be a multiple of 30 between 30 and 360.",
    "- costLevel is an integer from 1 ($) to 4 ($$$$); hidden gems are often cheap.",
    "- titles must be specific real places or activities (not generic). Use the real local name.",
    "- descriptions must be a single concise sentence (max ~160 chars).",
    "- do NOT repeat the same place twice.",
    `- every place must realistically exist in or near ${destination}.`,
  ].join("\n");
}

/**
 * Call gpt-4o-mini to generate recommendation cards for a destination.
 *
 * @param destination The trip destination (city / country).
 * @param daysCount   Number of days the trip spans.
 * @param categories  Optional subset of categories to restrict the AI to.
 *                    When undefined, all categories are used.
 * @returns Array of validated, sanitized AICard objects ready for DB insert.
 */
export async function generateCardsFromAI(
  destination: string,
  daysCount: number,
  categories?: CardCategory[],
): Promise<AICard[]> {
  const client = getClient();
  const model = process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL;
  const safeDays = Math.max(1, daysCount);
  const allowedCategories = categories && categories.length > 0 ? categories : ALL_CATEGORIES;

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.8,
    messages: [
      { role: "system", content: buildSystemPrompt(destination, safeDays, categories) },
      {
        role: "user",
        content: `Generate ${AI_CARDS_PER_TRIP} travel recommendation cards (half must-see, half hidden gems locals love) for a ${safeDays}-day trip to ${destination}.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "travel_cards",
        strict: true,
        schema: buildResponseSchema(categories),
      },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("AI returned an empty response.");
  }

  const parsed = JSON.parse(raw) as { cards?: unknown };
  const list = Array.isArray(parsed.cards) ? parsed.cards : [];

  // Defensive sanitization: the schema is strict, but we clamp numbers and
  // normalize categories once more to guarantee DB-safe values.
  const cards: AICard[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const title = typeof c.title === "string" ? c.title.trim() : "";
    const description = typeof c.description === "string" ? c.description.trim() : "";
    const category = allowedCategories.includes(c.category as CardCategory)
      ? (c.category as CardCategory)
      : allowedCategories[0];
    const duration =
      typeof c.defaultDurationMinutes === "number"
        ? clampDuration(c.defaultDurationMinutes)
        : MIN_DURATION_MINUTES;
    const costLevel =
      typeof c.costLevel === "number" && c.costLevel >= MIN_COST_LEVEL && c.costLevel <= MAX_COST_LEVEL
        ? Math.round(c.costLevel)
        : 2;

    if (!title) continue;
    // AI cannot fetch images, so synthesize a no-key image URL per place.
    const imageUrl = buildPlaceImageUrl(title, destination);
    cards.push({ title, description, category, defaultDurationMinutes: duration, costLevel, imageUrl });
  }

  if (cards.length === 0) {
    throw new Error("AI did not return any usable cards.");
  }

  return cards;
}
