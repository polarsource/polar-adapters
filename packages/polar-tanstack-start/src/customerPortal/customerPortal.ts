import { Polar } from "@polar-sh/sdk";
// @ts-expect-error - TODO: fix this
import type { StartAPIMethodCallback } from "@tanstack/react-start/api";

export interface CustomerPortalConfig {
	accessToken: string;
	getCustomerId: (req: Request) => Promise<string>;
	server: "sandbox" | "production";
}

export const CustomerPortal = <TPath extends string = string>({
	accessToken,
	server,
	getCustomerId,
}: CustomerPortalConfig): StartAPIMethodCallback<TPath> => {
	const polar = new Polar({
		accessToken,
		server,
	});

	// @ts-expect-error - TODO: fix this
	return async ({ request }) => {
		const customerId = await getCustomerId(request);

		if (!customerId) {
			return Response.json(
				{ error: "customerId not defined" },
				{ status: 400 },
			);
		}

		try {
			const result = await polar.customerSessions.create({
				customerId,
			});

			return Response.redirect(result.customerPortalUrl);
		} catch (error) {
			console.error(error);
			return Response.error();
		}
	};
};
