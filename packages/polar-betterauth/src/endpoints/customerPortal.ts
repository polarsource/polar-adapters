import { APIError, sessionMiddleware } from "better-auth/api";
import { createAuthEndpoint } from "better-auth/plugins";
import type { PolarOptions } from "../types";

export const customerPortal = (options: PolarOptions) =>
	createAuthEndpoint(
		"/customer/portal",
		{
			method: "GET",
			use: [sessionMiddleware],
		},
		async (ctx) => {
			if (!options.customerPortal?.enabled) {
				throw new APIError("BAD_REQUEST", {
					message: "Customer portal is not enabled",
				});
			}

			if (!ctx.context.session?.user.id) {
				throw new APIError("BAD_REQUEST", {
					message: "User not found",
				});
			}

			try {
				const customerSession = await options.client.customerSessions.create({
					customerExternalId: ctx.context.session?.user.id,
				});

				return ctx.json({
					url: customerSession.customerPortalUrl,
					redirect: true,
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
	);
