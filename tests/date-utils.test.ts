import { describe, it, expect } from "vitest";
import {
  slotIndexToTime,
  timeToSlotIndex,
  timeToMinutes,
  buildTimeLabels,
  isValidTimeString,
  clampDuration,
  eachDayOfRange,
  daysCountBetween,
  atLocalMidnight,
  isSameDay,
  intervalsOverlap,
} from "@/lib/date-utils";

describe("slotIndexToTime", () => {
  it("converts slot 0 to 00:00", () => {
    expect(slotIndexToTime(0)).toBe("00:00");
  });
  it("converts slot 17 to 08:30", () => {
    expect(slotIndexToTime(17)).toBe("08:30");
  });
  it("converts the last slot 47 to 23:30", () => {
    expect(slotIndexToTime(47)).toBe("23:30");
  });
  it("clamps negative indices to 00:00", () => {
    expect(slotIndexToTime(-5)).toBe("00:00");
  });
  it("clamps indices beyond range to 23:30", () => {
    expect(slotIndexToTime(99)).toBe("23:30");
  });
});

describe("timeToSlotIndex", () => {
  it("maps 00:00 to slot 0", () => {
    expect(timeToSlotIndex("00:00")).toBe(0);
  });
  it("maps 08:30 to slot 17", () => {
    expect(timeToSlotIndex("08:30")).toBe(17);
  });
  it("maps 23:30 to slot 47", () => {
    expect(timeToSlotIndex("23:30")).toBe(47);
  });
});

describe("timeToMinutes", () => {
  it("converts 01:30 to 90 minutes", () => {
    expect(timeToMinutes("01:30")).toBe(90);
  });
  it("treats malformed input as 0", () => {
    expect(timeToMinutes("abc")).toBe(0);
  });
});

describe("buildTimeLabels", () => {
  it("returns 48 labels", () => {
    expect(buildTimeLabels()).toHaveLength(48);
  });
  it("starts at 00:00 and ends at 23:30", () => {
    const labels = buildTimeLabels();
    expect(labels[0]).toBe("00:00");
    expect(labels[47]).toBe("23:30");
  });
});

describe("isValidTimeString", () => {
  it("accepts HH:mm in range", () => {
    expect(isValidTimeString("00:00")).toBe(true);
    expect(isValidTimeString("23:59")).toBe(true);
    expect(isValidTimeString("08:30")).toBe(true);
  });
  it("rejects out-of-range hours", () => {
    expect(isValidTimeString("24:00")).toBe(false);
  });
  it("rejects out-of-range minutes", () => {
    expect(isValidTimeString("08:60")).toBe(false);
  });
  it("rejects malformed strings", () => {
    expect(isValidTimeString("8:30")).toBe(false);
    expect(isValidTimeString("")).toBe(false);
    expect(isValidTimeString("abcd")).toBe(false);
  });
});

describe("clampDuration", () => {
  it("snaps to nearest 30", () => {
    expect(clampDuration(45)).toBe(60);
    expect(clampDuration(44)).toBe(30);
  });
  it("enforces minimum 30", () => {
    expect(clampDuration(0)).toBe(30);
    expect(clampDuration(10)).toBe(30);
  });
  it("enforces maximum 360", () => {
    expect(clampDuration(400)).toBe(360);
    expect(clampDuration(9999)).toBe(360);
  });
  it("leaves valid multiples unchanged", () => {
    expect(clampDuration(60)).toBe(60);
    expect(clampDuration(360)).toBe(360);
  });
});

describe("eachDayOfRange / daysCountBetween", () => {
  it("returns inclusive day list", () => {
    const days = eachDayOfRange(new Date(2026, 0, 1), new Date(2026, 0, 3));
    expect(days).toHaveLength(3);
  });
  it("returns a single day when start === end", () => {
    const days = eachDayOfRange(new Date(2026, 0, 1), new Date(2026, 0, 1));
    expect(days).toHaveLength(1);
  });
  it("swaps inverted ranges to a single start day", () => {
    const days = eachDayOfRange(new Date(2026, 0, 5), new Date(2026, 0, 1));
    expect(days).toHaveLength(1);
  });
  it("daysCountBetween matches list length", () => {
    expect(daysCountBetween(new Date(2026, 0, 1), new Date(2026, 0, 10))).toBe(10);
  });
});

describe("atLocalMidnight / isSameDay", () => {
  it("drops the time component", () => {
    const d = new Date(2026, 5, 15, 13, 45, 9);
    const m = atLocalMidnight(d);
    expect(m.getHours()).toBe(0);
    expect(m.getMinutes()).toBe(0);
  });
  it("isSameDay ignores time", () => {
    const a = new Date(2026, 5, 15, 1, 0);
    const b = new Date(2026, 5, 15, 23, 59);
    expect(isSameDay(a, b)).toBe(true);
  });
  it("isSameDay detects different days", () => {
    const a = new Date(2026, 5, 15);
    const b = new Date(2026, 5, 16);
    expect(isSameDay(a, b)).toBe(false);
  });
});

describe("intervalsOverlap", () => {
  it("detects partial overlap", () => {
    expect(intervalsOverlap({ startMin: 60, endMin: 120 }, { startMin: 90, endMin: 150 })).toBe(true);
  });
  it("treats touching edges as NOT overlapping", () => {
    expect(intervalsOverlap({ startMin: 60, endMin: 120 }, { startMin: 120, endMin: 180 })).toBe(false);
  });
  it("detects full containment", () => {
    expect(intervalsOverlap({ startMin: 60, endMin: 300 }, { startMin: 120, endMin: 180 })).toBe(true);
  });
  it("returns false for disjoint intervals", () => {
    expect(intervalsOverlap({ startMin: 0, endMin: 60 }, { startMin: 120, endMin: 180 })).toBe(false);
  });
});
