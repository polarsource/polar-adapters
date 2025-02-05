import { validateEvent } from "@polar-sh/sdk/webhooks";
import { WebhookBenefitCreatedPayload } from '@polar-sh/sdk/models/components/webhookbenefitcreatedpayload';
import { WebhookBenefitGrantCreatedPayload } from "@polar-sh/sdk/models/components/webhookbenefitgrantcreatedpayload";
import { WebhookBenefitGrantRevokedPayload } from "@polar-sh/sdk/models/components/webhookbenefitgrantrevokedpayload";
import { WebhookBenefitGrantUpdatedPayload } from "@polar-sh/sdk/models/components/webhookbenefitgrantupdatedpayload";
import { WebhookBenefitUpdatedPayload } from "@polar-sh/sdk/models/components/webhookbenefitupdatedpayload";
import { WebhookCheckoutCreatedPayload } from "@polar-sh/sdk/models/components/webhookcheckoutcreatedpayload";
import { WebhookCheckoutUpdatedPayload } from "@polar-sh/sdk/models/components/webhookcheckoutupdatedpayload";
import { WebhookOrderCreatedPayload } from "@polar-sh/sdk/models/components/webhookordercreatedpayload";
import { WebhookOrderRefundedPayload } from "@polar-sh/sdk/models/components/webhookorderrefundedpayload";
import { WebhookOrganizationUpdatedPayload } from "@polar-sh/sdk/models/components/webhookorganizationupdatedpayload";
import { WebhookProductCreatedPayload } from "@polar-sh/sdk/models/components/webhookproductcreatedpayload";
import { WebhookProductUpdatedPayload } from "@polar-sh/sdk/models/components/webhookproductupdatedpayload";
import { WebhookRefundCreatedPayload } from "@polar-sh/sdk/models/components/webhookrefundcreatedpayload";
import { WebhookRefundUpdatedPayload } from "@polar-sh/sdk/models/components/webhookrefundupdatedpayload";
import { WebhookSubscriptionActivePayload } from "@polar-sh/sdk/models/components/webhooksubscriptionactivepayload";
import { WebhookSubscriptionCanceledPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncanceledpayload";
import { WebhookSubscriptionCreatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncreatedpayload";
import { WebhookSubscriptionRevokedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionrevokedpayload";
import { WebhookSubscriptionUncanceledPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionuncanceledpayload";
import { WebhookSubscriptionUpdatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionupdatedpayload";
import { Entitlements } from "../entitlement/entitlement";

export interface WebhooksConfig {
  webhookSecret: string;
  entitlements?: typeof Entitlements;
  onPayload?: (payload: ReturnType<typeof validateEvent>) => Promise<void>;
  onCheckoutCreated?: (payload: WebhookCheckoutCreatedPayload) => Promise<void>;
  onCheckoutUpdated?: (payload: WebhookCheckoutUpdatedPayload) => Promise<void>;
  onOrderCreated?: (payload: WebhookOrderCreatedPayload) => Promise<void>;
  onOrderRefunded?: (payload: WebhookOrderRefundedPayload) => Promise<void>;
  onRefundCreated?: (payload: WebhookRefundCreatedPayload) => Promise<void>;
  onRefundUpdated?: (payload: WebhookRefundUpdatedPayload) => Promise<void>;
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
  onSubscriptionUncanceled?: (
    payload: WebhookSubscriptionUncanceledPayload,
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
