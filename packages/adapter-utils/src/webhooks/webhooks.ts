import { validateEvent } from "@polar-sh/sdk/webhooks";
import type {
  WebhookCheckoutCreatedPayload,
  WebhookCheckoutUpdatedPayload,
  WebhookOrderCreatedPayload,
  WebhookSubscriptionCreatedPayload,
  WebhookSubscriptionUpdatedPayload,
  WebhookSubscriptionActivePayload,
  WebhookSubscriptionCanceledPayload,
  WebhookSubscriptionRevokedPayload,
  WebhookProductCreatedPayload,
  WebhookProductUpdatedPayload,
  WebhookOrganizationUpdatedPayload,
  WebhookBenefitCreatedPayload,
  WebhookBenefitUpdatedPayload,
  WebhookBenefitGrantCreatedPayload,
  WebhookBenefitGrantUpdatedPayload,
  WebhookBenefitGrantRevokedPayload,
} from "@polar-sh/sdk/models/components";
import { Entitlements } from "../entitlement/entitlement";

export interface WebhooksConfig {
  webhookSecret: string;
  entitlements?: typeof Entitlements;
  onPayload?: (payload: ReturnType<typeof validateEvent>) => Promise<void>;
  onCheckoutCreated?: (payload: WebhookCheckoutCreatedPayload) => Promise<void>;
  onCheckoutUpdated?: (payload: WebhookCheckoutUpdatedPayload) => Promise<void>;
  onOrderCreated?: (payload: WebhookOrderCreatedPayload) => Promise<void>;
  onSubscriptionCreated?: (
    payload: WebhookSubscriptionCreatedPayload,
  ) => Promise<void>;
  onSubscriptionUpdated?: (
    payload: WebhookSubscriptionUpdatedPayload,
  ) => Promise<void>;
  onSubscriptionActive?: (
    payload: WebhookSubscriptionActivePayload,
  ) => Promise<void>;
  onSubscriptionCanceled?: (
    payload: WebhookSubscriptionCanceledPayload,
  ) => Promise<void>;
  onSubscriptionRevoked?: (
    payload: WebhookSubscriptionRevokedPayload,
  ) => Promise<void>;
  onProductCreated?: (payload: WebhookProductCreatedPayload) => Promise<void>;
  onProductUpdated?: (payload: WebhookProductUpdatedPayload) => Promise<void>;
  onOrganizationUpdated?: (
    payload: WebhookOrganizationUpdatedPayload,
  ) => Promise<void>;
  onBenefitCreated?: (payload: WebhookBenefitCreatedPayload) => Promise<void>;
  onBenefitUpdated?: (payload: WebhookBenefitUpdatedPayload) => Promise<void>;
  onBenefitGrantCreated?: (
    payload: WebhookBenefitGrantCreatedPayload,
  ) => Promise<void>;
  onBenefitGrantUpdated?: (
    payload: WebhookBenefitGrantUpdatedPayload,
  ) => Promise<void>;
  onBenefitGrantRevoked?: (
    payload: WebhookBenefitGrantRevokedPayload,
  ) => Promise<void>;
}

export const handleWebhookPayload = async (
  payload: ReturnType<typeof validateEvent>,
  { webhookSecret, entitlements, onPayload, ...eventHandlers }: WebhooksConfig,
) => {
  const promises: Promise<void>[] = [];

  if (onPayload) {
    promises.push(onPayload(payload));
  }

  switch (payload.type) {
    case "checkout.created":
      if (eventHandlers.onCheckoutCreated) {
        promises.push(eventHandlers.onCheckoutCreated(payload));
      }
      break;
    case "checkout.updated":
      if (eventHandlers.onCheckoutUpdated) {
        promises.push(eventHandlers.onCheckoutUpdated(payload));
      }
      break;
    case "order.created":
      if (eventHandlers.onOrderCreated) {
        promises.push(eventHandlers.onOrderCreated(payload));
      }
      break;
    case "subscription.created":
      if (eventHandlers.onSubscriptionCreated) {
        promises.push(eventHandlers.onSubscriptionCreated(payload));
      }
      break;
    case "subscription.updated":
      if (eventHandlers.onSubscriptionUpdated) {
        promises.push(eventHandlers.onSubscriptionUpdated(payload));
      }
      break;
    case "subscription.active":
      if (eventHandlers.onSubscriptionActive) {
        promises.push(eventHandlers.onSubscriptionActive(payload));
      }
      break;
    case "subscription.canceled":
      if (eventHandlers.onSubscriptionCanceled) {
        promises.push(eventHandlers.onSubscriptionCanceled(payload));
      }
      break;
    case "subscription.revoked":
      if (eventHandlers.onSubscriptionRevoked) {
        promises.push(eventHandlers.onSubscriptionRevoked(payload));
      }
      break;
    case "product.created":
      if (eventHandlers.onProductCreated) {
        promises.push(eventHandlers.onProductCreated(payload));
      }
      break;
    case "product.updated":
      if (eventHandlers.onProductUpdated) {
        promises.push(eventHandlers.onProductUpdated(payload));
      }
      break;
    case "organization.updated":
      if (eventHandlers.onOrganizationUpdated) {
        promises.push(eventHandlers.onOrganizationUpdated(payload));
      }
      break;
    case "benefit.created":
      if (eventHandlers.onBenefitCreated) {
        promises.push(eventHandlers.onBenefitCreated(payload));
      }
      break;
    case "benefit.updated":
      if (eventHandlers.onBenefitUpdated) {
        promises.push(eventHandlers.onBenefitUpdated(payload));
      }
      break;
    case "benefit_grant.created":
      if (eventHandlers.onBenefitGrantCreated) {
        promises.push(eventHandlers.onBenefitGrantCreated(payload));
      }
      break;
    case "benefit_grant.updated":
      if (eventHandlers.onBenefitGrantUpdated) {
        promises.push(eventHandlers.onBenefitGrantUpdated(payload));
      }
      break;
    case "benefit_grant.revoked":
      if (eventHandlers.onBenefitGrantRevoked) {
        promises.push(eventHandlers.onBenefitGrantRevoked(payload));
      }
  }

  switch (payload.type) {
    case "benefit_grant.created":
    case "benefit_grant.revoked":
      if (entitlements) {
        for (const handler of entitlements.handlers) {
          promises.push(handler(payload));
        }
      }
  }

  return Promise.all(promises);
};
