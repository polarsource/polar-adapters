import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint } from "better-auth/api";
import type { PolarOptions } from "./types";
import { validateEvent } from "@polar-sh/sdk/webhooks.js";
import { z } from "zod";

export const polar = <O extends PolarOptions>(options: O) => {
	const client = options.client;

	return {
		id: "polar",
		endpoints: {
			polarCheckout: createAuthEndpoint(
				"/checkout",
				{
					method: "GET",
					query: z.object({
						productId: z.string(),
						metadata: z.record(z.string(), z.any()).optional(),
					}),
				},
				async (ctx) => {
					try {
						const checkout = await client.checkouts.create({
							customerExternalId: ctx.context.session?.user.id,
							productId: ctx.query.productId,
							metadata: ctx.query.metadata,
						});

						return ctx.redirect(checkout.url);
					} catch (e: unknown) {
						if (e instanceof Error) {
							ctx.context.logger.error(
								`Polar checkout creation failed. Error: ${e.message}`,
							);
						}

						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: "Checkout creation failed",
						});
					}
				},
			),
			polarWebhook: createAuthEndpoint(
				"/polar/webhook",
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
					const webhookSecret = options.webhookSecret;
					let event: ReturnType<typeof validateEvent>;
					try {
						if (!webhookSecret) {
							throw new APIError("BAD_REQUEST", {
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

						event = validateEvent(buf, headers, webhookSecret);
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
						switch (event.type) {
							case "subscription.created":
								await options.onEvent?.(event);
								break;
							case "subscription.updated":
								await options.onEvent?.(event);
								break;
							case "subscription.revoked":
								await options.onEvent?.(event);
								break;
							default:
								await options.onEvent?.(event);
								break;
						}
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
					return ctx.json({ success: true });
				},
			),
		},
		init() {
			return {
				options: {
					databaseHooks: {
						user: {
							create: {
								async after(user, ctx) {
									if (ctx && options.createCustomerOnSignUp) {
										try {
											const customer = await client.customers.create({
												email: user.email,
												name: user.name,
												externalId: user.id,
											});

											console.log(customer);
										} catch (e: unknown) {
											if (e instanceof Error) {
												ctx.context.logger.error(
													`Polar customer creation failed. Error: ${e.message}`,
												);
											} else {
												ctx.context.logger.error(
													`Polar customer creation failed. Error: ${e}`,
												);
											}

											throw new APIError("BAD_REQUEST", {
												message:
													"Polar customer creation failed. See server logs for more information.",
											});
										}
									}
								},
							},
						},
					},
				},
			};
		},
	} satisfies BetterAuthPlugin;
};
