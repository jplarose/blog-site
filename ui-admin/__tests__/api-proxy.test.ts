import { afterEach, describe, expect, it, vi } from "vitest";

import { proxyApiRequest } from "@/lib/api-proxy";

describe("proxyApiRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("forwards multipart request bytes without decoding them as text", async () => {
    const bytes = new Uint8Array([0, 255, 1, 2, 3]);
    const backendFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: "https://media.example/image.png" }), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", backendFetch);
    const request = new Request("http://localhost/api/media/images", {
      method: "POST",
      headers: {
        "content-type": "multipart/form-data; boundary=test-boundary",
      },
      body: bytes,
    });

    await proxyApiRequest(request, "/api/media/images");

    const init = backendFetch.mock.calls[0]?.[1] as RequestInit;
    expect(new Uint8Array(init.body as ArrayBuffer)).toEqual(bytes);
    expect((init.headers as Headers).get("content-type")).toContain(
      "boundary=test-boundary",
    );
  });
});
