import { describe, it, expect, vi, beforeEach } from "vitest";
import { Checkout } from "./checkout.js";
import type { RawRequest, RawResponse } from "encore.dev/api";

vi.mock("@polar-sh/sdk", () => ({
  Polar: vi.fn().mockImplementation(() => ({
    checkouts: {
      create: vi.fn().mockResolvedValue({
        url: "https://checkout.polar.sh/test",
      }),
    },
  })),
}));

describe("Checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if no products are provided", async () => {
    const checkout = Checkout({
      accessToken: "test-token",
      server: "sandbox",
    });

    const req = {
      headers: {
        host: "localhost",
      },
      url: "/checkout",
    } as RawRequest;

    const resp = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as RawResponse;

    await checkout(req, resp);

    expect(resp.writeHead).toHaveBeenCalledWith(400, {
      "Content-Type": "application/json",
    });
    expect(resp.end).toHaveBeenCalledWith(
      JSON.stringify({
        error: "Missing products in query params",
      }),
    );
  });

  it("should redirect to checkout URL with products", async () => {
    const checkout = Checkout({
      accessToken: "test-token",
      server: "sandbox",
    });

    const req = {
      headers: {
        host: "localhost",
      },
      url: "/checkout?products=prod-1&products=prod-2",
    } as RawRequest;

    const resp = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as RawResponse;

    await checkout(req, resp);

    expect(resp.writeHead).toHaveBeenCalledWith(302, {
      Location: expect.stringContaining("https://checkout.polar.sh/test"),
    });
    expect(resp.end).toHaveBeenCalled();
  });

  it("should create checkout handler with successUrl", () => {
    const checkout = Checkout({
      accessToken: "test-token",
      successUrl: "https://example.com/success",
      includeCheckoutId: true,
      server: "sandbox",
    });

    expect(checkout).toBeDefined();
    expect(typeof checkout).toBe("function");
  });

  it("should create checkout handler with theme parameter", () => {
    const checkout = Checkout({
      accessToken: "test-token",
      theme: "dark",
      server: "sandbox",
    });

    expect(checkout).toBeDefined();
    expect(typeof checkout).toBe("function");
  });

  it("should handle request with optional query parameters", async () => {
    const checkout = Checkout({
      accessToken: "test-token",
      server: "sandbox",
    });

    const req = {
      headers: {
        host: "localhost",
      },
      url: "/checkout?products=prod-1&customerEmail=test@example.com&seats=5",
    } as RawRequest;

    const resp = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as RawResponse;

    await checkout(req, resp);

    expect(resp.writeHead).toHaveBeenCalled();
    expect(resp.end).toHaveBeenCalled();
  });
});

