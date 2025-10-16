import { Polar } from "@polar-sh/sdk";
import type { Context } from "elysia";
import type { InlineHandler } from "elysia/types";

export interface CustomerPortalConfig {
	accessToken?: string;
	getCustomerId: (req: Request) => Promise<string>;
	server?: "sandbox" | "production";
	returnUrl?: string;
}

export const CustomerPortal = ({
	accessToken,
	server,
	getCustomerId,
	returnUrl,
}: CustomerPortalConfig): InlineHandler => {
	const polar = new Polar({
		accessToken: accessToken ?? process.env["POLAR_ACCESS_TOKEN"],
		server,
	});

	return async (ctx: Context) => {
		const retUrl = returnUrl ? new URL(returnUrl) : undefined;

		const customerId = await getCustomerId(ctx.request);

		if (!customerId) {
			return ctx.error(400, { error: "customerId not defined" });
		}

		try {
			const result = await polar.customerSessions.create({
				customerId,
				returnUrl: retUrl ? decodeURI(retUrl.toString()) : undefined,
			});

			return ctx.redirect(result.customerPortalUrl);
		} catch (error) {
			console.error(error);
			return ctx.error(500, { error: "Internal server error" });
		}
	};
};
