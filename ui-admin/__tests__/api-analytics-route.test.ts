import { describe, expect, it, vi } from "vitest";

const proxyApiRequest = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

vi.mock("@/lib/api-proxy", () => ({
  proxyApiRequest: (...args: unknown[]) => proxyApiRequest(...args),
}));

describe("GET /api/analytics/summary", () => {
  it("proxies to the backend analytics summary endpoint", async () => {
    const { GET } = await import("@/app/api/analytics/summary/route");
    const request = new Request("http://localhost/api/analytics/summary?days=30");

    await GET(request);

    expect(proxyApiRequest).toHaveBeenCalledWith(request, "/api/analytics/summary");
  });
});
