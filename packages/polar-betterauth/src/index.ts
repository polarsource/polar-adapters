import type { GenericEndpointContext, BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, createAuthMiddleware } from "better-auth/plugins";
import { custom, z } from "zod";
import {
	sessionMiddleware,
	APIError,
	originCheck,
	getSessionFromCtx,
} from "better-auth/api";
import {
	onCheckoutSessionCompleted,
	onSubscriptionDeleted,
	onSubscriptionUpdated,
} from "./hooks";
import type { InputSubscription, PolarOptions, Subscription } from "./types";
import { getPlanByName, getPlanByPriceId, getPlans } from "./utils";
import { getSchema } from "./schema";
import { validateEvent } from "@polar-sh/sdk/webhooks.js";

const STRIPE_ERROR_CODES = {
	SUBSCRIPTION_NOT_FOUND: "Subscription not found",
	SUBSCRIPTION_PLAN_NOT_FOUND: "Subscription plan not found",
	ALREADY_SUBSCRIBED_PLAN: "You're already subscribed to this plan",
	UNABLE_TO_CREATE_CUSTOMER: "Unable to create customer",
	FAILED_TO_FETCH_PLANS: "Failed to fetch plans",
	EMAIL_VERIFICATION_REQUIRED:
		"Email verification is required before you can subscribe to a plan",
} as const;

const getUrl = (ctx: GenericEndpointContext, url: string) => {
	if (url.startsWith("http")) {
		return url;
	}
	return `${ctx.context.options.baseURL}${
		url.startsWith("/") ? url : `/${url}`
	}`;
};

export const polar = <O extends PolarOptions>(options: O) => {
	const client = options.polarClient;

	const referenceMiddleware = (
		action:
			| "upgrade-subscription"
			| "list-subscription"
			| "cancel-subscription",
	) =>
		createAuthMiddleware(async (ctx) => {
			const session = ctx.context.session;
			if (!session) {
				throw new APIError("UNAUTHORIZED");
			}
			const referenceId =
				ctx.body?.referenceId || ctx.query?.["referenceId"] || session.user.id;
			const isAuthorized = ctx.body?.referenceId
				? await options.subscription?.authorizeReference?.({
						user: session.user,
						session: session.session,
						referenceId,
						action,
					})
				: true;
			if (!isAuthorized) {
				throw new APIError("UNAUTHORIZED", {
					message: "Unauthorized",
				});
			}
		});

	const subscriptionEndpoints = {
		upgradeSubscription: createAuthEndpoint(
			"/subscription/upgrade",
			{
				method: "POST",
				body: z.object({
					plan: z.string(),
					referenceId: z.string().optional(),
					metadata: z.record(z.string(), z.any()).optional(),
					successUrl: z
						.string({
							description:
								"callback url to redirect back after successful subscription",
						})
						.default("/"),
				}),
				use: [
					sessionMiddleware,
					originCheck((c) => {
						return [c.body.successURL as string, c.body.cancelURL as string];
					}),
					referenceMiddleware("upgrade-subscription"),
				],
			},
			async (ctx) => {
				const { user, session } = ctx.context.session;
				if (
					!user.emailVerified &&
					options.subscription?.requireEmailVerification
				) {
					throw new APIError("BAD_REQUEST", {
						message: STRIPE_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED,
					});
				}
				const referenceId = ctx.body.referenceId || user.id;
				const plan = await getPlanByName(options, ctx.body.plan);
				if (!plan) {
					throw new APIError("BAD_REQUEST", {
						message: STRIPE_ERROR_CODES.SUBSCRIPTION_PLAN_NOT_FOUND,
					});
				}

				const customer = await client.customers.getExternal({
					externalId: user.id,
				});

				const activeSubscription = customer
					? await client.subscriptions
							.list({
								customerId: customer.id,
								active: true,
							})
							.then((res) => res.result.items[0])
							.catch((e) => null)
					: null;
				const subscriptions = await ctx.context.adapter.findMany<Subscription>({
					model: "subscription",
					where: [
						{
							field: "referenceId",
							value: ctx.body.referenceId || user.id,
						},
					],
				});

				const existingSubscription = subscriptions.find(
					(sub) => sub.status === "active",
				);

				if (activeSubscription) {
					const { customerPortalUrl } = await client.customerSessions
						.create({
							customerExternalId: user.id,
						})
						.catch(async (e) => {
							throw ctx.error("BAD_REQUEST", {
								message: e.message,
								code: e.code,
							});
						});
					return ctx.json({
						url: customerPortalUrl,
						redirect: true,
					});
				}

				if (
					existingSubscription &&
					existingSubscription.status === "active" &&
					existingSubscription.plan === ctx.body.plan
				) {
					throw new APIError("BAD_REQUEST", {
						message: STRIPE_ERROR_CODES.ALREADY_SUBSCRIBED_PLAN,
					});
				}
				let subscription = existingSubscription;
				if (!subscription) {
					const newSubscription = await ctx.context.adapter.create<
						InputSubscription,
						Subscription
					>({
						model: "subscription",
						data: {
							plan: plan.name.toLowerCase(),
							polarCustomerId: customer.id,
							status: "incomplete",
							referenceId,
						},
					});
					subscription = newSubscription;
				}

				if (!subscription) {
					ctx.context.logger.error("Subscription ID not found");
					throw new APIError("INTERNAL_SERVER_ERROR");
				}

				const params = await options.subscription?.getCheckoutSessionParams?.(
					{
						user,
						session,
						plan,
						subscription,
					},
					ctx.request,
				);

				const checkoutSession = await client.checkouts
					.create({
						...(customerId
							? {
									customerId,
								}
							: {
									customerEmail: session.user.email,
								}),
						successUrl: getUrl(
							ctx,
							`${
								ctx.context.baseURL
							}/subscription/success?callbackURL=${encodeURIComponent(
								ctx.body.successUrl,
							)}&reference=${encodeURIComponent(referenceId)}`,
						),
						...params,
						metadata: {
							userId: user.id,
							subscriptionId: subscription.id,
							referenceId,
							...params?.params?.metadata,
						},
					})
					.catch(async (e) => {
						throw ctx.error("BAD_REQUEST", {
							message: e.message,
							code: e.code,
						});
					});
				return ctx.json({
					...checkoutSession,
				});
			},
		),
		cancelSubscriptionCallback: createAuthEndpoint(
			"/subscription/cancel/callback",
			{
				method: "GET",
				query: z.record(z.string(), z.any()).optional(),
			},
			async (ctx) => {
				if (!ctx.query || !ctx.query.callbackURL || !ctx.query.reference) {
					throw ctx.redirect(getUrl(ctx, ctx.query?.callbackURL || "/"));
				}
				const session = await getSessionFromCtx<{ polarCustomerId: string }>(
					ctx,
				);
				if (!session) {
					throw ctx.redirect(getUrl(ctx, ctx.query?.callbackURL || "/"));
				}
				const { user } = session;
				const { callbackURL, reference } = ctx.query;

				if (user?.polarCustomerId) {
					try {
						const subscription =
							await ctx.context.adapter.findOne<Subscription>({
								model: "subscription",
								where: [
									{
										field: "referenceId",
										value: reference,
									},
								],
							});
						if (
							!subscription ||
							subscription.cancelAtPeriodEnd ||
							subscription.status === "canceled"
						) {
							throw ctx.redirect(getUrl(ctx, callbackURL));
						}

						const polarSubscription = await client.subscriptions.list({
							customerId: user.polarCustomerId,
							active: true,
						});
						const currentSubscription = polarSubscription.result.items.find(
							(sub) => sub.id === subscription.polarSubscriptionId,
						);
						if (currentSubscription?.cancelAtPeriodEnd === true) {
							await ctx.context.adapter.update({
								model: "subscription",
								update: {
									status: currentSubscription?.status,
									cancelAtPeriodEnd: true,
								},
								where: [
									{
										field: "referenceId",
										value: reference,
									},
								],
							});
							await options.subscription?.onSubscriptionCancel?.({
								subscription,
								cancellationDetails:
									currentSubscription.customerCancellationReason,
								polarSubscription: currentSubscription,
								event: undefined,
							});
						}
					} catch (error) {
						ctx.context.logger.error(
							"Error checking subscription status from Polar",
							error,
						);
					}
				}
				throw ctx.redirect(getUrl(ctx, callbackURL));
			},
		),
		cancelSubscription: createAuthEndpoint(
			"/subscription/cancel",
			{
				method: "POST",
				body: z.object({
					referenceId: z.string().optional(),
					returnUrl: z.string(),
				}),
				use: [
					sessionMiddleware,
					originCheck((ctx) => ctx.body.returnUrl),
					referenceMiddleware("cancel-subscription"),
				],
			},
			async (ctx) => {
				const referenceId =
					ctx.body?.referenceId || ctx.context.session.user.id;
				const subscription = await ctx.context.adapter.findOne<Subscription>({
					model: "subscription",
					where: [
						{
							field: "referenceId",
							value: referenceId,
						},
					],
				});
				if (!subscription || !subscription.polarCustomerId) {
					throw ctx.error("BAD_REQUEST", {
						message: STRIPE_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
					});
				}
				const activeSubscription = await client.subscriptions
					.list({
						customerId: subscription.polarCustomerId,
						active: true,
					})
					.then((res) => res.result.items[0]);
				if (!activeSubscription) {
					throw ctx.error("BAD_REQUEST", {
						message: STRIPE_ERROR_CODES.SUBSCRIPTION_NOT_FOUND,
					});
				}
				const { customerPortalUrl } = await client.customerSessions
					.create({
						customerId: subscription.polarCustomerId,
					})
					.catch(async (e) => {
						throw ctx.error("BAD_REQUEST", {
							message: e.message,
							code: e.code,
						});
					});
				return {
					url: customerPortalUrl,
					redirect: true,
				};
			},
		),
		listActiveSubscriptions: createAuthEndpoint(
			"/subscription/list",
			{
				method: "GET",
				query: z.optional(
					z.object({
						referenceId: z.string().optional(),
					}),
				),
				use: [sessionMiddleware, referenceMiddleware("list-subscription")],
			},
			async (ctx) => {
				const subscriptions = await ctx.context.adapter.findMany<Subscription>({
					model: "subscription",
					where: [
						{
							field: "referenceId",
							value: ctx.query?.referenceId || ctx.context.session.user.id,
						},
					],
				});
				if (!subscriptions.length) {
					return [];
				}
				const plans = await getPlans(options);
				if (!plans) {
					return [];
				}
				const subs = subscriptions
					.map((sub) => {
						const plan = plans.find(
							(p) => p.name.toLowerCase() === sub.plan.toLowerCase(),
						);
						return {
							...sub,
							limits: plan?.limits,
						};
					})
					.filter((sub) => {
						return sub.status === "active" || sub.status === "trialing";
					});
				return ctx.json(subs);
			},
		),
		subscriptionSuccess: createAuthEndpoint(
			"/subscription/success",
			{
				method: "GET",
				query: z.record(z.string(), z.any()).optional(),
			},
			async (ctx) => {
				if (!ctx.query || !ctx.query.callbackURL || !ctx.query.reference) {
					throw ctx.redirect(getUrl(ctx, ctx.query?.callbackURL || "/"));
				}
				const session = await getSessionFromCtx<{ polarCustomerId: string }>(
					ctx,
				);
				if (!session) {
					throw ctx.redirect(getUrl(ctx, ctx.query?.callbackURL || "/"));
				}
				const { user } = session;
				const { callbackURL, reference } = ctx.query;

				const subscriptions = await ctx.context.adapter.findMany<Subscription>({
					model: "subscription",
					where: [
						{
							field: "referenceId",
							value: reference,
						},
					],
				});

				const activeSubscription = subscriptions.find(
					(sub) => sub.status === "active",
				);

				if (activeSubscription) {
					return ctx.redirect(getUrl(ctx, callbackURL));
				}

				if (user?.polarCustomerId) {
					try {
						const subscription =
							await ctx.context.adapter.findOne<Subscription>({
								model: "subscription",
								where: [
									{
										field: "referenceId",
										value: reference,
									},
								],
							});
						if (!subscription || subscription.status === "active") {
							throw ctx.redirect(getUrl(ctx, callbackURL));
						}
						const polarSubscription = await client.subscriptions
							.list({
								customerId: user.polarCustomerId,
								active: true,
							})
							.then((res) => res.result.items[0]);

						if (polarSubscription) {
							const plan = await getPlanByPriceId(
								options,
								polarSubscription.productId,
							);

							if (plan && subscriptions.length > 0) {
								await ctx.context.adapter.update({
									model: "subscription",
									update: {
										status: polarSubscription.status,
										plan: plan.name.toLowerCase(),
										periodEnd: polarSubscription.currentPeriodEnd,
										periodStart: polarSubscription.currentPeriodStart,
										polarSubscriptionId: polarSubscription.id,
									},
									where: [
										{
											field: "referenceId",
											value: reference,
										},
									],
								});
							}
						}
					} catch (error) {
						ctx.context.logger.error(
							"Error fetching subscription from Stripe",
							error,
						);
					}
				}
				throw ctx.redirect(getUrl(ctx, callbackURL));
			},
		),
	} as const;
	return {
		id: "stripe",
		endpoints: {
			stripeWebhook: createAuthEndpoint(
				"/stripe/webhook",
				{
					method: "POST",
					metadata: {
						isAction: false,
					},
					cloneRequest: true,
				},
				async (ctx) => {
					if (!ctx.request?.body) {
						throw new APIError("INTERNAL_SERVER_ERROR");
					}
					const buf = await ctx.request.text();
					const webhookSecret = options.polarWebhookSecret;
					let event: ReturnType<typeof validateEvent>;
					try {
						if (!webhookSecret) {
							throw new APIError("BAD_REQUEST", {
								message: "Stripe webhook secret not found",
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

						event = validateEvent(buf, headers, webhookSecret);
					} catch (err: any) {
						ctx.context.logger.error(`${err.message}`);
						throw new APIError("BAD_REQUEST", {
							message: `Webhook Error: ${err.message}`,
						});
					}
					try {
						switch (event.type) {
							case "subscription.created":
								await onCheckoutSessionCompleted(ctx, options, event);
								await options.onEvent?.(event);
								break;
							case "subscription.updated":
								await onSubscriptionUpdated(ctx, options, event);
								await options.onEvent?.(event);
								break;
							case "subscription.revoked":
								await onSubscriptionDeleted(ctx, options, event);
								await options.onEvent?.(event);
								break;
							default:
								await options.onEvent?.(event);
								break;
						}
					} catch (e: any) {
						ctx.context.logger.error(
							`Polar webhook failed. Error: ${e.message}`,
						);
						throw new APIError("BAD_REQUEST", {
							message: "Webhook error: See server logs for more information.",
						});
					}
					return ctx.json({ success: true });
				},
			),
			...((options.subscription?.enabled
				? subscriptionEndpoints
				: {}) as O["subscription"] extends {
				enabled: boolean;
			}
				? typeof subscriptionEndpoints
				: {}),
		},
		init(ctx) {
			return {
				options: {
					databaseHooks: {
						user: {
							create: {
								async after(user, ctx) {
									if (ctx && options.createCustomerOnSignUp) {
										const polarCustomer = await client.customers.create({
											email: user.email,
											name: user.name,
											externalId: user.id,
										});
										await ctx.context.adapter.update({
											model: "user",
											update: {
												polarCustomerId: polarCustomer.id,
											},
											where: [
												{
													field: "id",
													value: user.id,
												},
											],
										});
									}
								},
							},
						},
					},
				},
			};
		},
		schema: getSchema(options),
	} satisfies BetterAuthPlugin;
};

export type { Subscription };
