import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api";
import { friendlyErrorMessage } from "@/lib/taxonomy/errorMessage";

describe("friendlyErrorMessage", () => {
  it("passes through the server's message for 400 validation errors", () => {
    const error = new ApiError(400, "API error 400: Category slug is required.");
    expect(friendlyErrorMessage(error, "fallback")).toBe("Category slug is required.");
  });

  it("passes through the server's message for 404 not-found errors", () => {
    const error = new ApiError(404, "API error 404: Category was not found.");
    expect(friendlyErrorMessage(error, "fallback")).toBe("Category was not found.");
  });

  it("passes through the server's message for 409 duplicate/referenced conflicts", () => {
    const error = new ApiError(409, "API error 409: A tag with this slug already exists.");
    expect(friendlyErrorMessage(error, "fallback")).toBe("A tag with this slug already exists.");
  });

  it("falls back to the generic message for unexpected statuses like 500", () => {
    const error = new ApiError(500, "API error 500: Internal Server Error");
    expect(friendlyErrorMessage(error, "fallback")).toBe("fallback");
  });

  it("surfaces a plain Error's own message (e.g. a network failure)", () => {
    expect(friendlyErrorMessage(new Error("network down"), "fallback")).toBe("network down");
  });

  it("falls back to the generic message for a non-Error value", () => {
    expect(friendlyErrorMessage("boom", "fallback")).toBe("fallback");
  });
});
