import { APIError, sessionMiddleware } from "better-auth/api";
import { createAuthEndpoint } from "better-auth/plugins";
import type { PolarOptions } from "../types";

export const subscriptions = (options: PolarOptions) =>
	createAuthEndpoint(
		"/subscriptions/list",
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
				const { token } = await options.client.customerSessions.create({
					customerExternalId: ctx.context.session?.user.id,
				});

				const subscriptions =
					await options.client.customerPortal.subscriptions.list(
						{
							customerSession: token,
						},
						{
							active: true,
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
					message: "Subscriptions list failed",
				});
			}
		},
	);
