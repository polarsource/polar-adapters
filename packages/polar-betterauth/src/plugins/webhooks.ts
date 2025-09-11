import { handleWebhookPayload } from "@polar-sh/adapter-utils";
import type { Polar } from "@polar-sh/sdk";
import type { WebhookBenefitCreatedPayload } from "@polar-sh/sdk/models/components/webhookbenefitcreatedpayload.js";
import type { WebhookBenefitGrantCreatedPayload } from "@polar-sh/sdk/models/components/webhookbenefitgrantcreatedpayload.js";
import type { WebhookBenefitGrantRevokedPayload } from "@polar-sh/sdk/models/components/webhookbenefitgrantrevokedpayload.js";
import type { WebhookBenefitGrantUpdatedPayload } from "@polar-sh/sdk/models/components/webhookbenefitgrantupdatedpayload.js";
import type { WebhookBenefitUpdatedPayload } from "@polar-sh/sdk/models/components/webhookbenefitupdatedpayload.js";
import type { WebhookCheckoutCreatedPayload } from "@polar-sh/sdk/models/components/webhookcheckoutcreatedpayload.js";
import type { WebhookCheckoutUpdatedPayload } from "@polar-sh/sdk/models/components/webhookcheckoutupdatedpayload.js";
import type { WebhookCustomerCreatedPayload } from "@polar-sh/sdk/models/components/webhookcustomercreatedpayload.js";
import type { WebhookCustomerDeletedPayload } from "@polar-sh/sdk/models/components/webhookcustomerdeletedpayload.js";
import type { WebhookCustomerStateChangedPayload } from "@polar-sh/sdk/models/components/webhookcustomerstatechangedpayload.js";
import type { WebhookCustomerUpdatedPayload } from "@polar-sh/sdk/models/components/webhookcustomerupdatedpayload.js";
import type { WebhookOrderCreatedPayload } from "@polar-sh/sdk/models/components/webhookordercreatedpayload.js";
import type { WebhookOrderPaidPayload } from "@polar-sh/sdk/models/components/webhookorderpaidpayload.js";
import type { WebhookOrderRefundedPayload } from "@polar-sh/sdk/models/components/webhookorderrefundedpayload.js";
import type { WebhookOrganizationUpdatedPayload } from "@polar-sh/sdk/models/components/webhookorganizationupdatedpayload.js";
import type { WebhookProductCreatedPayload } from "@polar-sh/sdk/models/components/webhookproductcreatedpayload.js";
import type { WebhookProductUpdatedPayload } from "@polar-sh/sdk/models/components/webhookproductupdatedpayload.js";
import type { WebhookRefundCreatedPayload } from "@polar-sh/sdk/models/components/webhookrefundcreatedpayload.js";
import type { WebhookRefundUpdatedPayload } from "@polar-sh/sdk/models/components/webhookrefundupdatedpayload.js";
import type { WebhookSubscriptionActivePayload } from "@polar-sh/sdk/models/components/webhooksubscriptionactivepayload.js";
import type { WebhookSubscriptionCanceledPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncanceledpayload.js";
import type { WebhookSubscriptionCreatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncreatedpayload.js";
import type { WebhookSubscriptionRevokedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionrevokedpayload.js";
import type { WebhookSubscriptionUncanceledPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionuncanceledpayload.js";
import type { WebhookSubscriptionUpdatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionupdatedpayload.js";
import { validateEvent } from "@polar-sh/sdk/webhooks";
import { APIError, createAuthEndpoint } from "better-auth/api";

export interface WebhooksOptions {
	/**
	 * Webhook Secret
	 */
	secret: string;
	/**
	 * Generic handler for all webhooks
	 */
	onPayload?: (payload: ReturnType<typeof validateEvent>) => Promise<void>;
	/**
	 * Webhook for checkout created
	 */
	onCheckoutCreated?: (payload: WebhookCheckoutCreatedPayload) => Promise<void>;
	/**
	 * Webhook for checkout updated
	 */
	onCheckoutUpdated?: (payload: WebhookCheckoutUpdatedPayload) => Promise<void>;
	/**
	 * Webhook for order created
	 */
	onOrderCreated?: (payload: WebhookOrderCreatedPayload) => Promise<void>;
	/**
	 * Webhook for order refunded
	 */
	onOrderRefunded?: (payload: WebhookOrderRefundedPayload) => Promise<void>;
	/**
	 * Webhook for order paid
	 */
	onOrderPaid?: (payload: WebhookOrderPaidPayload) => Promise<void>;
	/**
	 * Webhook for refund created
	 */
	onRefundCreated?: (payload: WebhookRefundCreatedPayload) => Promise<void>;
	/**
	 * Webhook for refund updated
	 */
	onRefundUpdated?: (payload: WebhookRefundUpdatedPayload) => Promise<void>;
	/**
	 * Webhook for subscription created
	 */
	onSubscriptionCreated?: (
		payload: WebhookSubscriptionCreatedPayload,
	) => Promise<void>;
	/**
	 * Webhook for subscription updated
	 */
	onSubscriptionUpdated?: (
		payload: WebhookSubscriptionUpdatedPayload,
	) => Promise<void>;
	/**
	 * Webhook for subscription active
	 */
	onSubscriptionActive?: (
		payload: WebhookSubscriptionActivePayload,
	) => Promise<void>;
	/**
	 * Webhook for subscription canceled
	 */
	onSubscriptionCanceled?: (
		payload: WebhookSubscriptionCanceledPayload,
	) => Promise<void>;
	/**
	 * Webhook for subscription revoked
	 */
	onSubscriptionRevoked?: (
		payload: WebhookSubscriptionRevokedPayload,
	) => Promise<void>;
	/**
	 * Webhook for subscription uncanceled
	 */
	onSubscriptionUncanceled?: (
		payload: WebhookSubscriptionUncanceledPayload,
	) => Promise<void>;
	/**
	 * Webhook for product created
	 */
	onProductCreated?: (payload: WebhookProductCreatedPayload) => Promise<void>;
	/**
	 * Webhook for product updated
	 */
	onProductUpdated?: (payload: WebhookProductUpdatedPayload) => Promise<void>;
	/**
	 * Webhook for organization updated
	 */
	onOrganizationUpdated?: (
		payload: WebhookOrganizationUpdatedPayload,
	) => Promise<void>;
	/**
	 * Webhook for benefit created
	 */
	onBenefitCreated?: (payload: WebhookBenefitCreatedPayload) => Promise<void>;
	/**
	 * Webhook for benefit updated
	 */
	onBenefitUpdated?: (payload: WebhookBenefitUpdatedPayload) => Promise<void>;
	/**
	 * Webhook for benefit grant created
	 */
	onBenefitGrantCreated?: (
		payload: WebhookBenefitGrantCreatedPayload,
	) => Promise<void>;
	/**
	 * Webhook for benefit grant updated
	 */
	onBenefitGrantUpdated?: (
		payload: WebhookBenefitGrantUpdatedPayload,
	) => Promise<void>;
	/**
	 * Webhook for benefit grant revoked
	 */
	onBenefitGrantRevoked?: (
		payload: WebhookBenefitGrantRevokedPayload,
	) => Promise<void>;
	/**
	 * Webhook for customer created
	 */
	onCustomerCreated?: (payload: WebhookCustomerCreatedPayload) => Promise<void>;
	/**
	 * Webhook for customer updated
	 */
	onCustomerUpdated?: (payload: WebhookCustomerUpdatedPayload) => Promise<void>;
	/**
	 * Webhook for customer deleted
	 */
	onCustomerDeleted?: (payload: WebhookCustomerDeletedPayload) => Promise<void>;
	/**
	 * Webhook for customer state changed
	 */
	onCustomerStateChanged?: (
		payload: WebhookCustomerStateChangedPayload,
	) => Promise<void>;
}

export const webhooks = (options: WebhooksOptions) => (_polar: Polar) => {
	return {
		polarWebhooks: createAuthEndpoint(
			"/polar/webhooks",
			{
				method: "POST",
				metadata: {
					isAction: false,
				},
				cloneRequest: true,
			},
			async (ctx) => {
				const { secret, ...eventHandlers } = options;

				if (!ctx.request?.body) {
					throw new APIError("INTERNAL_SERVER_ERROR");
				}
				const buf = await ctx.request.text();
				let event: ReturnType<typeof validateEvent>;
				try {
					if (!secret) {
						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: "Polar webhook secret not found",
						});
					}

					const headers = {
						"webhook-id": ctx.request.headers.get("webhook-id") as string,
						"webhook-timestamp": ctx.request.headers.get(
							"webhook-timestamp",
						) as string,
						"webhook-signature": ctx.request.headers.get(
							"webhook-signature",
						) as string,
					};

					event = validateEvent(buf, headers, secret);
				} catch (err: unknown) {
					if (err instanceof Error) {
						ctx.context.logger.error(`${err.message}`);
						throw new APIError("BAD_REQUEST", {
							message: `Webhook Error: ${err.message}`,
						});
					}
					throw new APIError("BAD_REQUEST", {
						message: `Webhook Error: ${err}`,
					});
				}

				try {
					await handleWebhookPayload(event, {
						webhookSecret: secret,
						...eventHandlers,
					});
				} catch (e: unknown) {
					if (e instanceof Error) {
						ctx.context.logger.error(
							`Polar webhook failed. Error: ${e.message}`,
						);
					} else {
						ctx.context.logger.error(`Polar webhook failed. Error: ${e}`);
					}

					throw new APIError("BAD_REQUEST", {
						message: "Webhook error: See server logs for more information.",
					});
				}

				return ctx.json({ received: true });
			},
		),
	};
};
