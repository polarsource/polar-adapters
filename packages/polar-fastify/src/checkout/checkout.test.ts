// Define mock values at the top level
const mockCustomerPortalUrl = "https://mock-customer-portal-url.com";
const mockCheckoutUrl = "https://mock-checkout-url.com/";
const mockSessionCreate = vi
  .fn()
  .mockResolvedValue({ customerPortalUrl: mockCustomerPortalUrl });
const mockCheckoutCreate = vi.fn(() => ({ url: mockCheckoutUrl }));

// Mock the module before any imports
vi.mock("@polar-sh/sdk", async (importOriginal) => {
  class Polar {
    customerSessions = {
      create: mockSessionCreate,
    };

    checkouts = {
      create: mockCheckoutCreate,
    };
  }

  return {
    ...(await importOriginal()),
    Polar,
  };
});

import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { Checkout } from "./checkout";

describe("Checkout middleware", () => {
  it("should redirect to checkout when products is valid", async () => {
    const app = fastify();
    app.get(
      "/",
      Checkout({
        accessToken: "mock-access-token",
      }),
    );

    const response = await app.inject({
      url: "http://localhost/?products=mock-product-id",
      method: "GET",
    });

    expect(response.statusCode).toBe(302);
    expect(response.headers["location"]).toBe(mockCheckoutUrl);
  });

  it("should return 400 when products is not defined", async () => {
    const app = fastify();
    app.get(
      "/",
      Checkout({
        accessToken: "mock-access-token",
      }),
    );

    const response = await app.inject({
      url: "http://localhost/",
      method: "GET",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Missing products in query params",
    });
  });
});
