import {
  SLOT_INTERVAL_MINUTES,
  SLOTS_PER_DAY,
  MIN_DURATION_MINUTES,
  MAX_DURATION_MINUTES,
} from "@/lib/constants";

/**
 * Date & time helpers for the timeline grid and overlap detection.
 * All times on the grid are represented as "HH:mm" strings.
 */

/** Format a 0-47 slot index into a "HH:mm" string (e.g. 17 -> "08:30"). */
export function slotIndexToTime(slotIndex: number): string {
  const clamped = Math.max(0, Math.min(SLOTS_PER_DAY - 1, slotIndex));
  const totalMinutes = clamped * SLOT_INTERVAL_MINUTES;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** Convert a "HH:mm" string into a 0-47 slot index. */
export function timeToSlotIndex(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const hours = Number.isFinite(h) ? h : 0;
  const minutes = Number.isFinite(m) ? m : 0;
  return Math.floor((hours * 60 + minutes) / SLOT_INTERVAL_MINUTES);
}

/** Convert a "HH:mm" string into total minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  const hours = Number.isFinite(h) ? h : 0;
  const minutes = Number.isFinite(m) ? m : 0;
  return hours * 60 + minutes;
}

/** Build the full list of 48 "HH:mm" slot labels for one day column. */
export function buildTimeLabels(): string[] {
  return Array.from({ length: SLOTS_PER_DAY }, (_, i) => slotIndexToTime(i));
}

/** Validate a "HH:mm" string. */
export function isValidTimeString(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

/**
 * Normalize a duration to the closest valid multiple of 30 minutes,
 * clamped to the [30, 360] range.
 */
export function clampDuration(durationMinutes: number): number {
  const snapped = Math.round(durationMinutes / SLOT_INTERVAL_MINUTES) * SLOT_INTERVAL_MINUTES;
  return Math.max(MIN_DURATION_MINUTES, Math.min(MAX_DURATION_MINUTES, snapped));
}

/** Coerce a Date | string | number into a Date (defensive against JSON). */
export function asDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * Generate an array of local Date objects (one per day, inclusive) between
 * two dates. Each Date is set to local midnight of that day.
 * Inputs are coerced defensively because API JSON carries dates as strings.
 */
export function eachDayOfRange(startDate: Date | string, endDate: Date | string): Date[] {
  const s = asDate(startDate);
  const e = asDate(endDate);
  const start = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const end = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  if (end < start) return [start];

  const days: Date[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/** Number of inclusive days between two dates (minimum 1). */
export function daysCountBetween(startDate: Date | string, endDate: Date | string): number {
  return eachDayOfRange(startDate, endDate).length;
}

/** Normalize any date to local midnight (drops the time component). */
export function atLocalMidnight(date: Date | string): Date {
  const d = asDate(date);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Return true if both dates refer to the same calendar day. */
export function isSameDay(a: Date | string, b: Date | string): boolean {
  const x = asDate(a);
  const y = asDate(b);
  return (
    x.getFullYear() === y.getFullYear() &&
    x.getMonth() === y.getMonth() &&
    x.getDate() === y.getDate()
  );
}

/** Format a Date as a short, locale-independent label (e.g. "Mon, 24 Jun"). */
export function formatDayLabel(date: Date): string {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${weekdays[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]}`;
}

export interface Interval {
  /** Start time in minutes since midnight. */
  startMin: number;
  /** End time in minutes since midnight (start + duration). */
  endMin: number;
}

/** Return true if two minute-intervals overlap (touching edges are allowed). */
export function intervalsOverlap(a: Interval, b: Interval): boolean {
  return a.startMin < b.endMin && b.startMin < a.endMin;
}
