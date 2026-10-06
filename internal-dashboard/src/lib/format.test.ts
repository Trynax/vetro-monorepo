import { describe, expect, it } from "vitest";

import { formatAprRange, formatDuration } from "./format";

describe("formatDuration", function () {
  it("floors sub-minute durations to <1m", function () {
    expect(formatDuration(0)).toBe("<1m");
    expect(formatDuration(59)).toBe("<1m");
  });

  it("formats minutes", function () {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(45 * 60 + 30)).toBe("45m");
  });

  it("formats minutes right up to the hour boundary", function () {
    expect(formatDuration(59 * 60 + 59)).toBe("59m");
    expect(formatDuration(90 * 60)).toBe("1h 30m");
  });

  it("formats hours with minutes", function () {
    expect(formatDuration(3 * 3600 + 12 * 60)).toBe("3h 12m");
    expect(formatDuration(3600)).toBe("1h");
  });

  it("formats hours right up to the day boundary", function () {
    expect(formatDuration(23 * 3600 + 59 * 60)).toBe("23h 59m");
  });

  it("formats days with hours, dropping minutes", function () {
    expect(formatDuration(2 * 86400 + 4 * 3600 + 59 * 60)).toBe("2d 4h");
    expect(formatDuration(86400)).toBe("1d");
  });

  it("drops sub-hour remainders once days are present", function () {
    expect(formatDuration(86400 + 30 * 60)).toBe("1d");
    expect(formatDuration(10 * 86400 + 5 * 3600)).toBe("10d 5h");
  });

  it("treats negative durations as sub-minute", function () {
    expect(formatDuration(-30)).toBe("<1m");
    expect(formatDuration(-3600)).toBe("<1m");
  });
});

describe("formatAprRange", function () {
  it("shows a single value when there is no boost spread", function () {
    expect(formatAprRange({ max: 2, min: 2 })).toBe("2.00%");
  });

  it("shows the boost range", function () {
    expect(formatAprRange({ max: 5, min: 2 })).toBe("2.00% → 5.00%");
  });

  it("shows the minimum alone when the maximum is lower", function () {
    expect(formatAprRange({ max: 0, min: 1.5 })).toBe("1.50%");
  });
});
