import {
  WebhookVerificationError,
  validateEvent,
} from "@polar-sh/sdk/webhooks";
import type { RawRequest, RawResponse } from "encore.dev/api";

export interface WebhooksConfig {
  webhookSecret: string;
  onPayload?: (payload: ReturnType<typeof validateEvent>) => Promise<void>;
  onCheckoutCreated?: (payload: any) => Promise<void>;
  onCheckoutUpdated?: (payload: any) => Promise<void>;
  onOrderCreated?: (payload: any) => Promise<void>;
  onOrderUpdated?: (payload: any) => Promise<void>;
  onOrderPaid?: (payload: any) => Promise<void>;
  onOrderRefunded?: (payload: any) => Promise<void>;
  onRefundCreated?: (payload: any) => Promise<void>;
  onRefundUpdated?: (payload: any) => Promise<void>;
  onSubscriptionCreated?: (payload: any) => Promise<void>;
  onSubscriptionUpdated?: (payload: any) => Promise<void>;
  onSubscriptionActive?: (payload: any) => Promise<void>;
  onSubscriptionCanceled?: (payload: any) => Promise<void>;
  onSubscriptionRevoked?: (payload: any) => Promise<void>;
  onSubscriptionUncanceled?: (payload: any) => Promise<void>;
  onProductCreated?: (payload: any) => Promise<void>;
  onProductUpdated?: (payload: any) => Promise<void>;
  onOrganizationUpdated?: (payload: any) => Promise<void>;
  onBenefitCreated?: (payload: any) => Promise<void>;
  onBenefitUpdated?: (payload: any) => Promise<void>;
  onBenefitGrantCreated?: (payload: any) => Promise<void>;
  onBenefitGrantUpdated?: (payload: any) => Promise<void>;
  onBenefitGrantRevoked?: (payload: any) => Promise<void>;
  onCustomerCreated?: (payload: any) => Promise<void>;
  onCustomerUpdated?: (payload: any) => Promise<void>;
  onCustomerDeleted?: (payload: any) => Promise<void>;
  onCustomerStateChanged?: (payload: any) => Promise<void>;
}

export const Webhooks = ({
  webhookSecret,
  onPayload,
  ...eventHandlers
}: WebhooksConfig) => {
  return async (req: RawRequest, resp: RawResponse) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const requestBody = Buffer.concat(chunks).toString("utf-8");

    const webhookHeaders: Record<string, string> = {
      "webhook-id": req.headers["webhook-id"] as string,
      "webhook-timestamp": req.headers["webhook-timestamp"] as string,
      "webhook-signature": req.headers["webhook-signature"] as string,
    };

    let webhookPayload: ReturnType<typeof validateEvent>;
    try {
      webhookPayload = validateEvent(
        requestBody,
        webhookHeaders,
        webhookSecret,
      );
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        resp.writeHead(403, { "Content-Type": "application/json" });
        resp.end(JSON.stringify({ received: false }));
        return;
      }

      resp.writeHead(500, { "Content-Type": "application/json" });
      resp.end(JSON.stringify({ error: "Internal server error" }));
      return;
    }

    const promises: Promise<void>[] = [];

    if (onPayload) {
      promises.push(onPayload(webhookPayload));
    }

    switch (webhookPayload.type) {
      case "checkout.created":
        if (eventHandlers.onCheckoutCreated) {
          promises.push(eventHandlers.onCheckoutCreated(webhookPayload));
        }
        break;
      case "checkout.updated":
        if (eventHandlers.onCheckoutUpdated) {
          promises.push(eventHandlers.onCheckoutUpdated(webhookPayload));
        }
        break;
      case "order.created":
        if (eventHandlers.onOrderCreated) {
          promises.push(eventHandlers.onOrderCreated(webhookPayload));
        }
        break;
      case "order.updated":
        if (eventHandlers.onOrderUpdated) {
          promises.push(eventHandlers.onOrderUpdated(webhookPayload));
        }
        break;
      case "order.paid":
        if (eventHandlers.onOrderPaid) {
          promises.push(eventHandlers.onOrderPaid(webhookPayload));
        }
        break;
      case "subscription.created":
        if (eventHandlers.onSubscriptionCreated) {
          promises.push(eventHandlers.onSubscriptionCreated(webhookPayload));
        }
        break;
      case "subscription.updated":
        if (eventHandlers.onSubscriptionUpdated) {
          promises.push(eventHandlers.onSubscriptionUpdated(webhookPayload));
        }
        break;
      case "subscription.active":
        if (eventHandlers.onSubscriptionActive) {
          promises.push(eventHandlers.onSubscriptionActive(webhookPayload));
        }
        break;
      case "subscription.canceled":
        if (eventHandlers.onSubscriptionCanceled) {
          promises.push(eventHandlers.onSubscriptionCanceled(webhookPayload));
        }
        break;
      case "subscription.uncanceled":
        if (eventHandlers.onSubscriptionUncanceled) {
          promises.push(eventHandlers.onSubscriptionUncanceled(webhookPayload));
        }
        break;
      case "subscription.revoked":
        if (eventHandlers.onSubscriptionRevoked) {
          promises.push(eventHandlers.onSubscriptionRevoked(webhookPayload));
        }
        break;
      case "product.created":
        if (eventHandlers.onProductCreated) {
          promises.push(eventHandlers.onProductCreated(webhookPayload));
        }
        break;
      case "product.updated":
        if (eventHandlers.onProductUpdated) {
          promises.push(eventHandlers.onProductUpdated(webhookPayload));
        }
        break;
      case "organization.updated":
        if (eventHandlers.onOrganizationUpdated) {
          promises.push(eventHandlers.onOrganizationUpdated(webhookPayload));
        }
        break;
      case "benefit.created":
        if (eventHandlers.onBenefitCreated) {
          promises.push(eventHandlers.onBenefitCreated(webhookPayload));
        }
        break;
      case "benefit.updated":
        if (eventHandlers.onBenefitUpdated) {
          promises.push(eventHandlers.onBenefitUpdated(webhookPayload));
        }
        break;
      case "benefit_grant.created":
        if (eventHandlers.onBenefitGrantCreated) {
          promises.push(eventHandlers.onBenefitGrantCreated(webhookPayload));
        }
        break;
      case "benefit_grant.updated":
        if (eventHandlers.onBenefitGrantUpdated) {
          promises.push(eventHandlers.onBenefitGrantUpdated(webhookPayload));
        }
        break;
      case "benefit_grant.revoked":
        if (eventHandlers.onBenefitGrantRevoked) {
          promises.push(eventHandlers.onBenefitGrantRevoked(webhookPayload));
        }
        break;
      case "customer.created":
        if (eventHandlers.onCustomerCreated) {
          promises.push(eventHandlers.onCustomerCreated(webhookPayload));
        }
        break;
      case "customer.updated":
        if (eventHandlers.onCustomerUpdated) {
          promises.push(eventHandlers.onCustomerUpdated(webhookPayload));
        }
        break;
      case "customer.deleted":
        if (eventHandlers.onCustomerDeleted) {
          promises.push(eventHandlers.onCustomerDeleted(webhookPayload));
        }
        break;
      case "customer.state_changed":
        if (eventHandlers.onCustomerStateChanged) {
          promises.push(eventHandlers.onCustomerStateChanged(webhookPayload));
        }
        break;
      case "order.refunded":
        if (eventHandlers.onOrderRefunded) {
          promises.push(eventHandlers.onOrderRefunded(webhookPayload));
        }
        break;
      case "refund.created":
        if (eventHandlers.onRefundCreated) {
          promises.push(eventHandlers.onRefundCreated(webhookPayload));
        }
        break;
      case "refund.updated":
        if (eventHandlers.onRefundUpdated) {
          promises.push(eventHandlers.onRefundUpdated(webhookPayload));
        }
        break;
    }

    await Promise.all(promises);

    resp.writeHead(200, { "Content-Type": "application/json" });
    resp.end(JSON.stringify({ received: true }));
  };
};
