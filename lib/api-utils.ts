import { NextResponse } from "next/server";
import { ZodError } from "zod";

/**
 * Shared helpers for API route handlers so every endpoint returns consistent,
 * well-typed JSON responses and error envelopes.
 */

/** Standard JSON success response (200 by default). */
export function ok<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/** 201 Created response. */
export function created<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

/** Generic error response with a stable shape: { error: string, details? }. */
export function fail(
  message: string,
  status: number = 400,
  details?: unknown,
): NextResponse {
  return NextResponse.json({ error: message, details }, { status });
}

/** 404 Not Found helper. */
export function notFound(message = "Resource not found"): NextResponse {
  return fail(message, 404);
}

/** 409 Conflict helper (used by the overlap checker). */
export function conflict(message = "Conflict"): NextResponse {
  return fail(message, 409);
}

/**
 * Wrap a Zod parse call so validation errors map to a clean 400 response
 * instead of throwing a raw 500.
 */
export function parseOrFail<T>(
  schema: { parse: (input: unknown) => T },
  input: unknown,
): { success: true; data: T } | { success: false; response: NextResponse } {
  try {
    const data = schema.parse(input);
    return { success: true, data };
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        success: false,
        response: fail("Validation failed", 400, err.flatten()),
      };
    }
    return { success: false, response: fail("Invalid input", 400) };
  }
}

/**
 * Central try/catch wrapper for route handlers. Any unexpected error becomes
 * a clean 500 JSON response, with the real error logged server-side.
 */
export async function handleRoute<T>(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    console.error("[api] unhandled error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return fail(message, 500);
  }
}
