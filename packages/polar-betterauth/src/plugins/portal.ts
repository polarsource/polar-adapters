import { APIError } from "better-auth/api";
import { sessionMiddleware } from "better-auth/api";
import { createAuthEndpoint } from "better-auth/plugins";
import { z } from "zod";
import type { ResolvedPolarOptions } from "../types";

export interface PortalConfig {
	returnUrl?: string;
	/**
	 * Portal theme
	 */
	theme?: "light" | "dark";
}

export const portal =
	({ returnUrl, theme }: PortalConfig = {}) =>
	(options: ResolvedPolarOptions) => {
		const retUrl = returnUrl ? new URL(returnUrl) : undefined;

		return {
			portal: createAuthEndpoint(
				"/customer/portal",
				{
					method: ["GET", "POST"],
					body: z
						.object({
							redirect: z.boolean().optional(),
						})
						.optional(),
					use: [sessionMiddleware],
				},
				async (ctx) => {
					if (ctx.context.session?.user['isAnonymous']) {
						throw new APIError("UNAUTHORIZED", {
							message: "Anonymous users cannot access the portal",
						});
					}

					const externalCustomerId = await options.getExternalCustomerId(ctx);

					if (!externalCustomerId) {
						throw new APIError("BAD_REQUEST", {
							message: "User not found",
						});
					}

					try {
						const customerSession = await options.client.customerSessions.create({
							externalCustomerId,
							returnUrl: retUrl ? decodeURI(retUrl.toString()) : undefined,
						});

						const portalUrl = new URL(customerSession.customerPortalUrl);

						if (theme) {
							portalUrl.searchParams.set("theme", theme);
						}

						return ctx.json({
							url: portalUrl.toString(),
							redirect: ctx.body?.redirect ?? true,
						});
					} catch (e: unknown) {
						if (e instanceof Error) {
							ctx.context.logger.error(
								`Polar customer portal creation failed. Error: ${e.message}`,
							);
						}

						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: "Customer portal creation failed",
						});
					}
				},
			),
			state: createAuthEndpoint(
				"/customer/state",
				{
					method: "GET",
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const externalCustomerId = await options.getExternalCustomerId(ctx);

					if (!externalCustomerId) {
						throw new APIError("BAD_REQUEST", {
							message: "User not found",
						});
					}

					try {
						const state = await options.client.customers.getStateExternal({
							externalId: externalCustomerId,
						});

						return ctx.json(state);
					} catch (e: unknown) {
						if (e instanceof Error) {
							ctx.context.logger.error(
								`Polar subscriptions list failed. Error: ${e.message}`,
							);
						}

						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: "Subscriptions list failed",
						});
					}
				},
			),
			benefits: createAuthEndpoint(
				"/customer/benefits/list",
				{
					method: "GET",
					query: z
						.object({
							page: z.coerce.number().optional(),
							limit: z.coerce.number().optional(),
						})
						.optional(),
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const externalCustomerId = await options.getExternalCustomerId(ctx);

					if (!externalCustomerId) {
						throw new APIError("BAD_REQUEST", {
							message: "User not found",
						});
					}

					try {
						const customerSession = await options.client.customerSessions.create({
							externalCustomerId,
						});

						const benefits = await options.client.customerPortal.benefitGrants.list(
							{ customerSession: customerSession.token },
							{
								page: ctx.query?.page,
								limit: ctx.query?.limit,
							},
						);

						return ctx.json(benefits);
					} catch (e: unknown) {
						if (e instanceof Error) {
							ctx.context.logger.error(
								`Polar benefits list failed. Error: ${e.message}`,
							);
						}

						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: "Benefits list failed",
						});
					}
				},
			),
			subscriptions: createAuthEndpoint(
				"/customer/subscriptions/list",
				{
					method: "GET",
					query: z
						.object({
							referenceId: z.string().optional(),
							page: z.coerce.number().optional(),
							limit: z.coerce.number().optional(),
							active: z.coerce.boolean().optional(),
						})
						.optional(),
					use: [sessionMiddleware],
				},
				async (ctx) => {
					if (ctx.query?.referenceId) {
						try {
							const subscriptions = await options.client.subscriptions.list({
								page: ctx.query?.page,
								limit: ctx.query?.limit,
								active: ctx.query?.active,
								metadata: {
									referenceId: ctx.query?.referenceId,
								},
							});

							return ctx.json(subscriptions);
						} catch (e: unknown) {
							console.log(e);
							if (e instanceof Error) {
								ctx.context.logger.error(
									`Polar subscriptions list with referenceId failed. Error: ${e.message}`,
								);
							}

							throw new APIError("INTERNAL_SERVER_ERROR", {
								message: "Subscriptions list with referenceId failed",
							});
						}
					}

					const externalCustomerId = await options.getExternalCustomerId(ctx);

					if (!externalCustomerId) {
						throw new APIError("BAD_REQUEST", {
							message: "User not found",
						});
					}

					try {
						const customerSession = await options.client.customerSessions.create({
							externalCustomerId,
						});

						const subscriptions = await options.client.customerPortal.subscriptions.list(
							{ customerSession: customerSession.token },
							{
								page: ctx.query?.page,
								limit: ctx.query?.limit,
								active: ctx.query?.active,
							},
						);

						return ctx.json(subscriptions);
					} catch (e: unknown) {
						if (e instanceof Error) {
							ctx.context.logger.error(
								`Polar subscriptions list failed. Error: ${e.message}`,
							);
						}

						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: "Polar subscriptions list failed",
						});
					}
				},
			),
			orders: createAuthEndpoint(
				"/customer/orders/list",
				{
					method: "GET",
					query: z
						.object({
							page: z.coerce.number().optional(),
							limit: z.coerce.number().optional(),
							productBillingType: z.enum(["recurring", "one_time"]).optional(),
						})
						.optional(),
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const externalCustomerId = await options.getExternalCustomerId(ctx);

					if (!externalCustomerId) {
						throw new APIError("BAD_REQUEST", {
							message: "User not found",
						});
					}

					try {
						const customerSession = await options.client.customerSessions.create({
							externalCustomerId,
						});

						const orders = await options.client.customerPortal.orders.list(
							{ customerSession: customerSession.token },
							{
								page: ctx.query?.page,
								limit: ctx.query?.limit,
								productBillingType: ctx.query?.productBillingType,
							},
						);

						return ctx.json(orders);
					} catch (e: unknown) {
						if (e instanceof Error) {
							ctx.context.logger.error(
								`Polar orders list failed. Error: ${e.message}`,
							);
						}

						throw new APIError("INTERNAL_SERVER_ERROR", {
							message: "Orders list failed",
						});
					}
				},
			),
		};
	};
