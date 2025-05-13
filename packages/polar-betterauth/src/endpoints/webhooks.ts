import { validateEvent } from "@polar-sh/sdk/webhooks";
import { APIError } from "better-auth/api";
import { createAuthEndpoint } from "better-auth/plugins";
import type { PolarOptions, Subscription } from "../types";

export const webhooks = (options: PolarOptions) =>
	createAuthEndpoint(
		"/polar/webhooks",
		{
			method: "POST",
			metadata: {
				isAction: false,
			},
			cloneRequest: true,
		},
		async (ctx) => {
			const { webhooks } = options;

			if (!webhooks) {
				throw new APIError("NOT_FOUND", {
					message: "Webhooks not enabled",
				});
			}

			const {
				secret,
				onPayload,
				onCheckoutCreated,
				onCheckoutUpdated,
				onOrderCreated,
				onOrderPaid,
				onOrderRefunded,
				onRefundCreated,
				onRefundUpdated,
				onSubscriptionCreated,
				onSubscriptionUpdated,
				onSubscriptionActive,
				onSubscriptionCanceled,
				onSubscriptionRevoked,
				onSubscriptionUncanceled,
				onProductCreated,
				onProductUpdated,
				onOrganizationUpdated,
				onBenefitCreated,
				onBenefitUpdated,
				onBenefitGrantCreated,
				onBenefitGrantUpdated,
				onBenefitGrantRevoked,
				onCustomerCreated,
				onCustomerUpdated,
				onCustomerDeleted,
				onCustomerStateChanged,
			} = webhooks;

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
				if (onPayload) {
					onPayload(event);
				}

				switch (event.type) {
					case "checkout.created":
						if (onCheckoutCreated) {
							onCheckoutCreated(event);
						}
						break;
					case "checkout.updated":
						if (onCheckoutUpdated) {
							onCheckoutUpdated(event);
						}
						break;
					case "order.created":
						if (onOrderCreated) {
							onOrderCreated(event);
						}
						break;
					case "order.paid":
						if (onOrderPaid) {
							onOrderPaid(event);
						}
						break;
					case "subscription.created":
						await ctx.context.adapter.create<Subscription>({
							model: "subscription",
							data: {
								userId: event.data.customer.externalId ?? "",
								subscriptionId: event.data.id,
								referenceId: event.data.metadata["referenceId"] as string,
								status: event.data.status,
								periodStart: event.data.currentPeriodStart.toISOString(),
								periodEnd: event.data.currentPeriodEnd?.toISOString(),
								cancelAtPeriodEnd: event.data.cancelAtPeriodEnd,
							},
						});

						if (onSubscriptionCreated) {
							onSubscriptionCreated(event);
						}
						break;
					case "subscription.updated":
						await ctx.context.adapter.update<Subscription>({
							model: "subscription",
							where: [
								{
									field: "subscriptionId",
									value: event.data.id,
								},
							],
							update: {
								status: event.data.status,
								periodStart: event.data.currentPeriodStart.toISOString(),
								periodEnd: event.data.currentPeriodEnd?.toISOString(),
								cancelAtPeriodEnd: event.data.cancelAtPeriodEnd,
							},
						});

						if (onSubscriptionUpdated) {
							onSubscriptionUpdated(event);
						}
						break;
					case "subscription.active":
						if (onSubscriptionActive) {
							onSubscriptionActive(event);
						}
						break;
					case "subscription.canceled":
						if (onSubscriptionCanceled) {
							onSubscriptionCanceled(event);
						}
						break;
					case "subscription.uncanceled":
						if (onSubscriptionUncanceled) {
							onSubscriptionUncanceled(event);
						}
						break;
					case "subscription.revoked":
						if (onSubscriptionRevoked) {
							onSubscriptionRevoked(event);
						}
						break;
					case "product.created":
						if (onProductCreated) {
							onProductCreated(event);
						}
						break;
					case "product.updated":
						if (onProductUpdated) {
							onProductUpdated(event);
						}
						break;
					case "organization.updated":
						if (onOrganizationUpdated) {
							onOrganizationUpdated(event);
						}
						break;
					case "benefit.created":
						if (onBenefitCreated) {
							onBenefitCreated(event);
						}
						break;
					case "benefit.updated":
						if (onBenefitUpdated) {
							onBenefitUpdated(event);
						}
						break;
					case "benefit_grant.created":
						if (onBenefitGrantCreated) {
							onBenefitGrantCreated(event);
						}
						break;
					case "benefit_grant.updated":
						if (onBenefitGrantUpdated) {
							onBenefitGrantUpdated(event);
						}
						break;
					case "benefit_grant.revoked":
						if (onBenefitGrantRevoked) {
							onBenefitGrantRevoked(event);
						}
						break;
					case "order.refunded":
						if (onOrderRefunded) {
							onOrderRefunded(event);
						}
						break;
					case "refund.created":
						if (onRefundCreated) {
							onRefundCreated(event);
						}
						break;
					case "refund.updated":
						if (onRefundUpdated) {
							onRefundUpdated(event);
						}
						break;
					case "customer.created":
						if (onCustomerCreated) {
							onCustomerCreated(event);
						}
						break;
					case "customer.updated":
						if (onCustomerUpdated) {
							onCustomerUpdated(event);
						}
						break;
					case "customer.deleted":
						if (onCustomerDeleted) {
							onCustomerDeleted(event);
						}
						break;
					case "customer.state_changed":
						if (onCustomerStateChanged) {
							onCustomerStateChanged(event);
						}
						break;
				}
			} catch (e: unknown) {
				if (e instanceof Error) {
					ctx.context.logger.error(`Polar webhook failed. Error: ${e.message}`);
				} else {
					ctx.context.logger.error(`Polar webhook failed. Error: ${e}`);
				}

				throw new APIError("BAD_REQUEST", {
					message: "Webhook error: See server logs for more information.",
				});
			}

			return ctx.json({ received: true });
		},
	);
