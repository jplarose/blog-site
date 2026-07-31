import { describe, expect, it } from "vitest";

import { datetimeLocalToIso, isStrictlyFuture } from "@/lib/posts/schedule";

describe("datetimeLocalToIso", () => {
  it("converts a datetime-local value to an ISO instant", () => {
    const iso = datetimeLocalToIso("2027-06-01T10:30");
    expect(iso).not.toBeNull();
    expect(new Date(iso!).toString()).not.toBe("Invalid Date");
  });

  it("returns null for an empty value", () => {
    expect(datetimeLocalToIso("")).toBeNull();
  });

  it("returns null for an unparsable value", () => {
    expect(datetimeLocalToIso("not-a-date")).toBeNull();
  });
});

describe("isStrictlyFuture", () => {
  const now = new Date("2027-01-01T00:00:00.000Z");

  it("is true for an instant after now", () => {
    expect(isStrictlyFuture("2027-01-01T00:00:01.000Z", now)).toBe(true);
  });

  it("is false for an instant equal to now", () => {
    expect(isStrictlyFuture("2027-01-01T00:00:00.000Z", now)).toBe(false);
  });

  it("is false for an instant before now", () => {
    expect(isStrictlyFuture("2026-12-31T23:59:59.000Z", now)).toBe(false);
  });

  it("is false for null", () => {
    expect(isStrictlyFuture(null, now)).toBe(false);
  });

  it("is false for an unparsable value", () => {
    expect(isStrictlyFuture("garbage", now)).toBe(false);
  });
});
