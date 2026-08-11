import type { Polar } from "@polar-sh/sdk";
import { APIError } from "better-auth/api";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import * as z from "zod/v4";
import {
	type BillingPrincipal,
	isOrganizationMember,
	resolvePrincipal,
} from "../principal";

const OrganizationScopeQuery = {
	organizationId: z.string().optional(),
};

const createPortalSession = (
	polar: Polar,
	principal: BillingPrincipal,
	returnUrl?: string,
) =>
	polar.customerSessions.create({
		externalCustomerId: principal.externalCustomerId,
		externalMemberId:
			principal.kind === "team" ? principal.externalMemberId : undefined,
		returnUrl,
	});

export interface PortalConfig {
	returnUrl?: string;
	/**
	 * Portal theme
	 */
	theme?: "light" | "dark";
}

export const portal =
	({ returnUrl, theme }: PortalConfig = {}) =>
	(polar: Polar) => {
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
					query: z.object(OrganizationScopeQuery).optional(),
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const principal = await resolvePrincipal(ctx, {
						organizationId: ctx.query?.organizationId,
					});

					if (principal.isAnonymous) {
						throw new APIError("UNAUTHORIZED", {
							message: "Anonymous users cannot access the portal",
						});
					}

					try {
						const customerSession = await createPortalSession(
							polar,
							principal,
							retUrl ? decodeURI(retUrl.toString()) : undefined,
						);

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
					query: z.object(OrganizationScopeQuery).optional(),
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const principal = await resolvePrincipal(ctx, {
						organizationId: ctx.query?.organizationId,
					});

					try {
						const state = await polar.customers.getStateExternal({
							externalId: principal.externalCustomerId,
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
							...OrganizationScopeQuery,
						})
						.optional(),
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const principal = await resolvePrincipal(ctx, {
						organizationId: ctx.query?.organizationId,
					});

					try {
						const customerSession = await createPortalSession(polar, principal);

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
							/**
							 * @deprecated Use `organizationId` instead — team
							 * subscriptions live on the Polar team customer.
							 */
							referenceId: z.string().optional(),
							page: z.coerce.number().optional(),
							limit: z.coerce.number().optional(),
							active: z.coerce.boolean().optional(),
							...OrganizationScopeQuery,
						})
						.optional(),
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const principal = await resolvePrincipal(ctx, {
						organizationId: ctx.query?.organizationId,
					});

					if (ctx.query?.referenceId) {
						const isMember = await isOrganizationMember(
							ctx,
							ctx.query.referenceId,
							ctx.context.session?.user?.id ?? "",
						);

						if (!isMember) {
							throw new APIError("FORBIDDEN", {
								message: "You are not a member of this organization",
							});
						}

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
						const customerSession = await createPortalSession(polar, principal);

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
							...OrganizationScopeQuery,
						})
						.optional(),
					use: [sessionMiddleware],
				},
				async (ctx) => {
					const principal = await resolvePrincipal(ctx, {
						organizationId: ctx.query?.organizationId,
					});

					try {
						const customerSession = await createPortalSession(polar, principal);

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
