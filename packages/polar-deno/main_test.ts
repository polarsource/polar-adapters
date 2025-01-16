// Mock Polar SDK
const mockCheckoutUrl = "https://mock-checkout-url.com";
const mockCustomerPortalUrl = "https://mock-customer-portal-url.com";

import { assertSpyCalls, spy } from "https://deno.land/std/testing/mock.ts";
import { assertEquals } from "https://deno.land/std/assert/mod.ts";
import { describe, it } from "https://deno.land/std/testing/bdd.ts";
import { Checkout, CustomerPortal, Webhooks } from "./main.ts";


describe("Checkout", () => {
  it("should return 400 if productId is missing", async () => {
    const checkout = Checkout({ accessToken: "test-token" });
    const request = new Request("https://example.com");
    const response = await checkout(request);

    assertEquals(response.status, 400);
    const body = await response.json();
    assertEquals(body.error, "Missing productId in query params");
  });

  it("should redirect to checkout URL on successful creation", async () => {
    const checkout = Checkout({ accessToken: "test-token" });
    const request = new Request("https://example.com?productId=123");
    const response = await checkout(request);

    const url = new URL(response.headers.get("location") ?? "");

    assertEquals(response.status, 302);
    assertEquals(url.origin, mockCheckoutUrl);
  });
});

describe("CustomerPortal", () => {
  it("should return 400 if customerId is not provided", async () => {
    const portal = CustomerPortal({
      accessToken: "test-token",
      getCustomerId: () => new Promise((resolve) => resolve("")),
    });

    const request = new Request("https://example.com");
    const response = await portal(request);

    assertEquals(response.status, 400);
    const body = await response.json();
    assertEquals(body.error, "customerId not defined");
  });

  it("should redirect to customer portal URL on success", async () => {
    const portal = CustomerPortal({
      accessToken: "test-token",
      getCustomerId: () => new Promise((resolve) => resolve("customer-123")),
    });

    const request = new Request("https://example.com");
    const response = await portal(request);

    const url = new URL(response.headers.get("location") ?? "");

    assertEquals(response.status, 302);
    assertEquals(url.origin, mockCustomerPortalUrl);

  });
});

describe("Webhooks", () => {
  const webhookSecret = "test-webhook-secret";
  const validSignature = "valid-signature";

  it("should call onPayload with the payload", async () => {
    const onPayload = (): Promise<void> => new Promise((resolve) => resolve());
    const onPayloadSpy = spy(onPayload);
    const webhook = Webhooks({
      webhookSecret,
      onPayload: onPayloadSpy,
    });

    const request = new Request("https://example.com", {
      method: "POST",
      headers: {
        "webhook-id": "123",
        "webhook-timestamp": Date.now().toString(),
        "webhook-signature": validSignature,
      },
      body: JSON.stringify({ type: "test.event" }),
    });

    const response = await webhook(request);
    const body = await response.json();
    assertEquals(body.received, true);
    assertSpyCalls(onPayloadSpy, 1);
  });

  it("should handle webhook payload successfully", async () => {
    const webhook = Webhooks({
      webhookSecret,
      onPayload: () => new Promise((resolve) => {
        resolve();
      }),
    });

    // Note: In a real test, you'd need to generate a valid signature
    const request = new Request("https://example.com", {
      method: "POST",
      headers: {
        "webhook-id": "123",
        "webhook-timestamp": Date.now().toString(),
        "webhook-signature": validSignature,
      },
      body: JSON.stringify({ type: "test.event" }),
    });

    const response = await webhook(request);
    assertEquals(response.status, 200);
    const body = await response.json();
    assertEquals(body.received, true);
  });
});
