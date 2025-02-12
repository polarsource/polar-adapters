import { describe, it, expect, vi } from "vitest";
import { FetchStrategy } from "./FetchStrategy";
import { Polar } from "@polar-sh/sdk";

describe("FetchStrategy", () => {
  const mockFetch = vi.fn();
  const customerId = "test-customer-id";

  const fetchStrategy = new FetchStrategy(mockFetch, new Polar()).ingest(
    "request",
    ({ url, method }) => ({ url, method }),
  );

  it("should call the fetch client with the correct parameters", async () => {
    const input = "https://example.com";
    const init = { method: "GET" };
    const response = new Response(null, { status: 200 });

    mockFetch.mockResolvedValueOnce(response);

    const wrappedFetch = fetchStrategy.client(customerId);
    const result = await wrappedFetch(input, init);

    expect(mockFetch).toHaveBeenCalledWith(input, init);
    expect(result).toBe(response);
  });
});
