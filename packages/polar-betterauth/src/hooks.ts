import { logger, type GenericEndpointContext, type User } from "better-auth";
import type { InputSubscription, PolarOptions, Subscription } from "./types";
import { getPlanByPriceId } from "./utils";
import type { WebhookSubscriptionCreatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncreatedpayload.js";
import type { WebhookSubscriptionUpdatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionupdatedpayload.js";

export async function onCheckoutSessionCompleted(
	ctx: GenericEndpointContext,
	options: PolarOptions,
	event: WebhookSubscriptionCreatedPayload,
) {
	try {
		const checkoutSession = event.data;

		if (!options.subscription?.enabled) {
			return;
		}

		const subscription = checkoutSession;
		const plan = checkoutSession.product;

		if (plan) {
			const referenceId = checkoutSession?.metadata["referenceId"];
			const subscriptionId = checkoutSession?.metadata["subscriptionId"];

			if (referenceId && subscriptionId) {
				let dbSubscription =
					await ctx.context.adapter.update<InputSubscription>({
						model: "subscription",
						update: {
							plan: plan.name.toLowerCase(),
							status: subscription.status,
							updatedAt: new Date(),
							periodStart: subscription.currentPeriodStart,
							periodEnd: subscription.currentPeriodEnd,
							stripeSubscriptionId: checkoutSession.id,
						},
						where: [
							{
								field: "id",
								value: subscriptionId,
							},
						],
					});

				if (!dbSubscription) {
					dbSubscription = await ctx.context.adapter.findOne<Subscription>({
						model: "subscription",
						where: [
							{
								field: "id",
								value: subscriptionId,
							},
						],
					});
				}
				await options.subscription?.onSubscriptionComplete?.({
					event,
					subscription: dbSubscription as Subscription,
					polarSubscription: subscription,
					plan,
				});
				return;
			}
		}
	} catch (e: any) {
		logger.error(`Stripe webhook failed. Error: ${e.message}`);
	}
}

export async function onSubscriptionUpdated(
	ctx: GenericEndpointContext,
	options: PolarOptions,
	event: WebhookSubscriptionUpdatedPayload,
) {
	try {
		if (!options.subscription?.enabled) {
			return;
		}
		const subscriptionUpdated = event.data;

		const priceId = subscriptionUpdated.items.data[0].price.id;
		const plan = await getPlanByPriceId(options, priceId);

		const referenceId = subscriptionUpdated.metadata?.referenceId;
		const subscriptionId = subscriptionUpdated.id;
		const customerId = subscriptionUpdated.customer.toString();

		let subscription = await ctx.context.adapter.findOne<Subscription>({
			model: "subscription",
			where: referenceId
				? [{ field: "referenceId", value: referenceId }]
				: subscriptionId
					? [{ field: "stripeSubscriptionId", value: subscriptionId }]
					: [],
		});
		if (!subscription) {
			const subs = await ctx.context.adapter.findMany<Subscription>({
				model: "subscription",
				where: [{ field: "stripeCustomerId", value: customerId }],
			});
			if (subs.length > 1) {
				logger.warn(
					`Stripe webhook error: Multiple subscriptions found for customerId: ${customerId} and no referenceId or subscriptionId is provided`,
				);
				return;
			}
			subscription = subs[0];
		}

		const seats = subscriptionUpdated.items.data[0].quantity;
		await ctx.context.adapter.update({
			model: "subscription",
			update: {
				...(plan
					? {
							plan: plan.name.toLowerCase(),
							limits: plan.limits,
						}
					: {}),
				updatedAt: new Date(),
				status: subscriptionUpdated.status,
				periodStart: new Date(subscriptionUpdated.current_period_start * 1000),
				periodEnd: new Date(subscriptionUpdated.current_period_end * 1000),
				cancelAtPeriodEnd: subscriptionUpdated.cancel_at_period_end,
				seats,
				stripeSubscriptionId: subscriptionUpdated.id,
			},
			where: [
				{
					field: "referenceId",
					value: subscription.referenceId,
				},
			],
		});
		const subscriptionCanceled =
			subscriptionUpdated.status === "active" &&
			subscriptionUpdated.cancel_at_period_end &&
			!subscription.cancelAtPeriodEnd; //if this is true, it means the subscription was canceled before the event was triggered
		if (subscriptionCanceled) {
			await options.subscription.onSubscriptionCancel?.({
				subscription,
				cancellationDetails:
					subscriptionUpdated.cancellation_details || undefined,
				stripeSubscription: subscriptionUpdated,
				event,
			});
		}
		await options.subscription.onSubscriptionUpdate?.({
			event,
			subscription,
		});
		if (plan) {
			if (
				subscriptionUpdated.status === "active" &&
				subscription.status === "trialing" &&
				plan.freeTrial?.onTrialEnd
			) {
				const user = await ctx.context.adapter.findOne<User>({
					model: "user",
					where: [{ field: "id", value: subscription.referenceId }],
				});
				if (user) {
					await plan.freeTrial.onTrialEnd({ subscription, user }, ctx.request);
				}
			}
			if (
				subscriptionUpdated.status === "incomplete_expired" &&
				subscription.status === "trialing" &&
				plan.freeTrial?.onTrialExpired
			) {
				await plan.freeTrial.onTrialExpired(subscription, ctx.request);
			}
		}
	} catch (error: any) {
		logger.error(`Stripe webhook failed. Error: ${error}`);
	}
}

export async function onSubscriptionDeleted(
	ctx: GenericEndpointContext,
	options: StripeOptions,
	event: Stripe.Event,
) {
	if (!options.subscription?.enabled) {
		return;
	}
	try {
		const subscriptionDeleted = event.data.object as Stripe.Subscription;
		const subscriptionId = subscriptionDeleted.id;
		if (subscriptionDeleted.status === "canceled") {
			const subscription = await ctx.context.adapter.findOne<Subscription>({
				model: "subscription",
				where: [
					{
						field: "stripeSubscriptionId",
						value: subscriptionId,
					},
				],
			});
			if (subscription) {
				await ctx.context.adapter.update({
					model: "subscription",
					where: [
						{
							field: "stripeSubscriptionId",
							value: subscriptionId,
						},
					],
					update: {
						status: "canceled",
						updatedAt: new Date(),
					},
				});
				await options.subscription.onSubscriptionDeleted?.({
					event,
					stripeSubscription: subscriptionDeleted,
					subscription,
				});
			} else {
				logger.warn(
					`Stripe webhook error: Subscription not found for subscriptionId: ${subscriptionId}`,
				);
			}
		}
	} catch (error: any) {
		logger.error(`Stripe webhook failed. Error: ${error}`);
	}
}
