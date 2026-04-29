import { describe, it, expect, vi, beforeEach } from "vitest";
import { Webhooks } from "./webhooks.js";
import type { RawRequest, RawResponse } from "encore.dev/api";
import { Readable } from "node:stream";

vi.mock("@polar-sh/sdk/webhooks", () => {
  class WebhookVerificationError extends Error {
    constructor() {
      super("Webhook verification failed");
      this.name = "WebhookVerificationError";
    }
  }

  return {
    validateEvent: vi.fn((body: string) => {
      const parsed = JSON.parse(body);
      if (parsed.type === "invalid") {
        throw new WebhookVerificationError();
      }
      return parsed;
    }),
    WebhookVerificationError,
  };
});

describe("Webhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockRequest = (body: string, headers: Record<string, string> = {}): RawRequest => {
    const readable = Readable.from([Buffer.from(body)]);
    return Object.assign(readable, {
      headers: {
        "webhook-id": headers["webhook-id"] || "test-id",
        "webhook-timestamp": headers["webhook-timestamp"] || "1234567890",
        "webhook-signature": headers["webhook-signature"] || "test-sig",
        ...headers,
      },
      url: "/webhooks",
    }) as RawRequest;
  };

  it("should return 403 for invalid webhook signature", async () => {
    const webhook = Webhooks({
      webhookSecret: "test-secret",
    });

    const req = createMockRequest(JSON.stringify({ type: "invalid" }));

    const resp = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as RawResponse;

    await webhook(req, resp);

    expect(resp.writeHead).toHaveBeenCalledWith(403, {
      "Content-Type": "application/json",
    });
    expect(resp.end).toHaveBeenCalledWith(
      JSON.stringify({ received: false }),
    );
  });

  it("should return 200 for valid webhook", async () => {
    const webhook = Webhooks({
      webhookSecret: "test-secret",
    });

    const req = createMockRequest(
      JSON.stringify({ type: "checkout.created", data: { id: "test-id" } }),
    );

    const resp = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as RawResponse;

    await webhook(req, resp);

    expect(resp.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "application/json",
    });
    expect(resp.end).toHaveBeenCalledWith(
      JSON.stringify({ received: true }),
    );
  });

  it("should call onPayload handler when provided", async () => {
    const onPayload = vi.fn().mockResolvedValue(undefined);

    const webhook = Webhooks({
      webhookSecret: "test-secret",
      onPayload,
    });

    const req = createMockRequest(
      JSON.stringify({ type: "checkout.created", data: { id: "test-id" } }),
    );

    const resp = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as RawResponse;

    await webhook(req, resp);

    expect(onPayload).toHaveBeenCalled();
    expect(resp.writeHead).toHaveBeenCalledWith(200, {
      "Content-Type": "application/json",
    });
  });

  it("should create webhook handler with specific event handlers", () => {
    const onCheckoutCreated = vi.fn().mockResolvedValue(undefined);
    const onOrderPaid = vi.fn().mockResolvedValue(undefined);
    const onSubscriptionActive = vi.fn().mockResolvedValue(undefined);

    const webhook = Webhooks({
      webhookSecret: "test-secret",
      onCheckoutCreated,
      onOrderPaid,
      onSubscriptionActive,
    });

    expect(webhook).toBeDefined();
    expect(typeof webhook).toBe("function");
  });

  it("should support all webhook event types", () => {
    const handlers = {
      onCheckoutCreated: vi.fn().mockResolvedValue(undefined),
      onCheckoutUpdated: vi.fn().mockResolvedValue(undefined),
      onOrderCreated: vi.fn().mockResolvedValue(undefined),
      onOrderUpdated: vi.fn().mockResolvedValue(undefined),
      onOrderPaid: vi.fn().mockResolvedValue(undefined),
      onOrderRefunded: vi.fn().mockResolvedValue(undefined),
      onRefundCreated: vi.fn().mockResolvedValue(undefined),
      onRefundUpdated: vi.fn().mockResolvedValue(undefined),
      onSubscriptionCreated: vi.fn().mockResolvedValue(undefined),
      onSubscriptionUpdated: vi.fn().mockResolvedValue(undefined),
      onSubscriptionActive: vi.fn().mockResolvedValue(undefined),
      onSubscriptionCanceled: vi.fn().mockResolvedValue(undefined),
      onSubscriptionRevoked: vi.fn().mockResolvedValue(undefined),
      onSubscriptionUncanceled: vi.fn().mockResolvedValue(undefined),
      onProductCreated: vi.fn().mockResolvedValue(undefined),
      onProductUpdated: vi.fn().mockResolvedValue(undefined),
      onOrganizationUpdated: vi.fn().mockResolvedValue(undefined),
      onBenefitCreated: vi.fn().mockResolvedValue(undefined),
      onBenefitUpdated: vi.fn().mockResolvedValue(undefined),
      onBenefitGrantCreated: vi.fn().mockResolvedValue(undefined),
      onBenefitGrantUpdated: vi.fn().mockResolvedValue(undefined),
      onBenefitGrantRevoked: vi.fn().mockResolvedValue(undefined),
      onCustomerCreated: vi.fn().mockResolvedValue(undefined),
      onCustomerUpdated: vi.fn().mockResolvedValue(undefined),
      onCustomerDeleted: vi.fn().mockResolvedValue(undefined),
      onCustomerStateChanged: vi.fn().mockResolvedValue(undefined),
    };

    const webhook = Webhooks({
      webhookSecret: "test-secret",
      ...handlers,
    });

    expect(webhook).toBeDefined();
    expect(typeof webhook).toBe("function");
  });
});

