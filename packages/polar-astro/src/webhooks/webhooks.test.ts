vi.mock("@polar-sh/sdk/webhooks", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    WebhookVerificationError: vi.fn(),
    validateEvent: vi.fn((v) => JSON.parse(v)),
  };
});

import { describe, expect, it, vi } from "vitest";
import { Webhooks } from "./webhooks";
import { APIContext } from "astro";

describe("Webhooks middleware", () => {
  it("should call onPayload with the payload", async () => {
    const onPayload = vi.fn();

    const response = await Webhooks({
      webhookSecret: "mock-secret",
      onPayload,
    })({
      request: new Request("http://localhost:3000/", {
        method: "POST",
        body: JSON.stringify({ event: "mock-event", data: "mock-data" }),
        headers: {
          "webhook-id": "mock-id",
          "webhook-timestamp": "mock-timestamp",
          "webhook-signature": "mock-signature",
        },
      }),
    } as APIContext);

    expect(response).toBeInstanceOf(Response);
    expect(onPayload).toHaveBeenCalledWith({
      event: "mock-event",
      data: "mock-data",
    });
    expect((response as Response).status).toBe(200);
    expect(await (response as Response).json()).toEqual({ received: true });
  });

  it("should acknowledge the webhook", async () => {
    const onPayload = vi.fn();

    const response = await Webhooks({
      webhookSecret: "mock-secret",
      onPayload,
    })({
      request: new Request("http://localhost:3000/", {
        method: "POST",
        body: JSON.stringify({ event: "mock-event", data: "mock-data" }),
        headers: {
          "webhook-id": "mock-id",
          "webhook-timestamp": "mock-timestamp",
          "webhook-signature": "mock-signature",
        },
      }),
    } as APIContext);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(200);
    expect(onPayload).toHaveBeenCalledWith({
      event: "mock-event",
      data: "mock-data",
    });
    expect(await (response as Response).json()).toEqual({ received: true });
  });

  it("should return 405 when the method is not POST", async () => {
    const response = await Webhooks({
      webhookSecret: "mock-secret",
      onPayload: vi.fn(),
    })({
      request: new Request("http://localhost:3000/"),
    } as APIContext);

    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(405);
    expect(await (response as Response).json()).toEqual({
      message: "Method not allowed",
    });
  });
});
