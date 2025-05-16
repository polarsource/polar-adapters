vi.mock("@polar-sh/sdk/webhooks", async (importOriginal) => {
  return {
    ...(await importOriginal()),
    WebhookVerificationError: vi.fn(),
    validateEvent: vi.fn((v) => JSON.parse(v)),
  };
});

import Elysia from "elysia";
import { describe, expect, it, vi } from "vitest";
import { Webhooks } from "./webhooks";

describe("Webhooks middleware", () => {
  it("should call onPayload with the payload", async () => {
    const app = new Elysia();
    const mockOnPayload = vi.fn();

    app.post(
      "*",
      Webhooks({
        webhookSecret: "mock-secret",
        onPayload: mockOnPayload,
      }),
    );

    const payload = { event: "mock-event", data: "mock-data" };

    const response = await app.handle(
      new Request("http://localhost/", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "webhook-id": "mock-id",
          "webhook-timestamp": "mock-timestamp",
          "webhook-signature": "mock-signature",
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(mockOnPayload).toHaveBeenCalledWith(payload);
  });

  it("should acknowledge the webhook", async () => {
    const app = new Elysia();
    const mockOnPayload = vi.fn();

    app.post(
      "*",
      Webhooks({
        webhookSecret: "mock-secret",
        onPayload: mockOnPayload,
      }),
    );

    const payload = { event: "mock-event", data: "mock-data" };

    const response = await app.handle(
      new Request("http://localhost/", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: {
          "webhook-id": "mock-id",
          "webhook-timestamp": "mock-timestamp",
          "webhook-signature": "mock-signature",
        },
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
  });
});
