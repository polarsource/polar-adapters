// Define mock values at the top level
const mockCustomerPortalUrl = "https://mock-customer-portal-url.com/";
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

import type { APIContext } from "astro";
import { describe, expect, it, vi } from "vitest";
import { Checkout } from "./checkout";

describe("Checkout middleware", () => {
  it("should redirect to checkout when productId is valid", async () => {
    const response = await Checkout({
      accessToken: "mock-access-token",
    })({
      url: new URL(
        new Request("http://localhost:3000/?productId=mock-product-id").url,
      ),
    } as APIContext);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe(
      mockCheckoutUrl,
    );
  });

  it("should redirect to checkout when productPriceId is valid", async () => {
    const response = await Checkout({
      accessToken: "mock-access-token",
    })({
      url: new URL(
        new Request(
          "http://localhost:3000/?productPriceId=mock-product-price-id",
        ).url,
      ),
    } as APIContext);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(302);
    expect((response as Response).headers.get("Location")).toBe(
      mockCheckoutUrl,
    );
  });

  it("should return 400 when productId and productPriceId are not defined", async () => {
    const response = await Checkout({
      accessToken: "mock-access-token",
    })({
      url: new URL(new Request("http://localhost:3000/").url),
    } as APIContext);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(400);
    expect(await (response as Response).json()).toEqual({
      error: "Missing productId or productPriceId in query params",
    });
  });
});
