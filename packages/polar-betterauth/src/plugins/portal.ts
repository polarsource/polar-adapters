import type { Polar } from "@polar-sh/sdk";
import { APIError } from "better-auth/api";
import { sessionMiddleware } from "better-auth/api";
import { createAuthEndpoint } from "better-auth/plugins";
import { z } from "zod";

export const portal = () => (polar: Polar) => {
	return {
		portal: createAuthEndpoint(
			"/customer/portal",
			{
				method: "GET",
				use: [sessionMiddleware],
				query: z.object({ 
          redirect: z.coerce.boolean().optional().default(true) 
        }).optional(),
			},
			async (ctx) => {
				if (!ctx.context.session?.user.id) {
					throw new APIError("BAD_REQUEST", {
						message: "User not found",
					});
				}

				try {
					const customerSession = await polar.customerSessions.create({
						externalCustomerId: ctx.context.session?.user.id,
					});

					return ctx.json({
						url: customerSession.customerPortalUrl,
						redirect: ctx.query?.redirect ?? true,
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
				if (!ctx.context.session.user.id) {
					throw new APIError("BAD_REQUEST", {
						message: "User not found",
					});
				}

				try {
					const state = await polar.customers.getStateExternal({
						externalId: ctx.context.session?.user.id,
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
				if (!ctx.context.session.user.id) {
					throw new APIError("BAD_REQUEST", {
						message: "User not found",
					});
				}

				try {
					const customerSession = await polar.customerSessions.create({
						externalCustomerId: ctx.context.session?.user.id,
					});

					const benefits = await polar.customerPortal.benefitGrants.list(
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
				if (!ctx.context.session.user.id) {
					throw new APIError("BAD_REQUEST", {
						message: "User not found",
					});
				}

				if (ctx.query?.referenceId) {
					try {
						const subscriptions = await polar.subscriptions.list({
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

				try {
					const customerSession = await polar.customerSessions.create({
						externalCustomerId: ctx.context.session?.user.id,
					});

					const subscriptions = await polar.customerPortal.subscriptions.list(
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
				if (!ctx.context.session.user.id) {
					throw new APIError("BAD_REQUEST", {
						message: "User not found",
					});
				}

				try {
					const customerSession = await polar.customerSessions.create({
						externalCustomerId: ctx.context.session?.user.id,
					});

					const orders = await polar.customerPortal.orders.list(
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
