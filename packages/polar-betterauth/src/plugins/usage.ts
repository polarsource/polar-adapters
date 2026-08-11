import type { Polar } from "@polar-sh/sdk";
import {
	APIError,
	createAuthEndpoint,
	sessionMiddleware,
} from "better-auth/api";
import * as z from "zod/v4";
import { resolvePrincipal } from "../principal";
import type { Product } from "../types";

export interface UsageOptions {
	/**
	 * @deprecated This option has never been used by the plugin and will be
	 * removed in the next major version.
	 */
	creditProducts?: Product[] | (() => Promise<Product[]>);
}

export const usage = (_usageOptions?: UsageOptions) => (polar: Polar) => {
	return {
		meters: createAuthEndpoint(
			"/usage/meters/list",
			{
				method: "GET",
				use: [sessionMiddleware],
				query: z.object({
					page: z.coerce.number().optional(),
					limit: z.coerce.number().optional(),
					organizationId: z.string().optional(),
				}),
			},
			async (ctx) => {
				const principal = await resolvePrincipal(ctx, {
					organizationId: ctx.query?.organizationId,
				});

				try {
					const customerSession = await polar.customerSessions.create({
						externalCustomerId: principal.externalCustomerId,
						externalMemberId:
							principal.kind === "team"
								? principal.externalMemberId
								: undefined,
					});

					const customerMeters = await polar.customerPortal.customerMeters.list(
						{ customerSession: customerSession.token },
						{
							page: ctx.query?.page,
							limit: ctx.query?.limit,
						},
					);

					return ctx.json(customerMeters);
				} catch (e: unknown) {
					if (e instanceof Error) {
						ctx.context.logger.error(
							`Polar meters list failed. Error: ${e.message}`,
						);
					}

					throw new APIError("INTERNAL_SERVER_ERROR", {
						message: "Meters list failed",
					});
				}
			},
		),
		ingestion: createAuthEndpoint(
			"/usage/ingest",
			{
				method: "POST",
				body: z.object({
					event: z.string(),
					metadata: z.record(
						z.string(),
						z.union([z.string(), z.number(), z.boolean()]),
					),
					organizationId: z.string().optional(),
				}),
				use: [sessionMiddleware],
			},
			async (ctx) => {
				const principal = await resolvePrincipal(ctx, {
					organizationId: ctx.body.organizationId,
				});

				try {
					const ingestion = await polar.events.ingest({
						events: [
							{
								name: ctx.body.event,
								metadata: ctx.body.metadata,
								externalCustomerId: principal.externalCustomerId,
							},
						],
					});

					return ctx.json(ingestion);
				} catch (e: unknown) {
					if (e instanceof Error) {
						ctx.context.logger.error(
							`Polar ingestion failed. Error: ${e.message}`,
						);
					}

					throw new APIError("INTERNAL_SERVER_ERROR", {
						message: "Ingestion failed",
					});
				}
			},
		),
	};
};
