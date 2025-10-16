import { Polar } from "@polar-sh/sdk";
import type { APIRoute } from "astro";

export interface CustomerPortalConfig {
	accessToken?: string;
	getCustomerId: (req: Request) => Promise<string>;
	returnUrl?: string;
	server?: "sandbox" | "production";
}

export const CustomerPortal = ({
	accessToken,
	server,
	getCustomerId,
	returnUrl,
}: CustomerPortalConfig): APIRoute => {
	return async ({ request }) => {
		if (!accessToken) {
			const { getSecret } = await import("astro:env/server");
			accessToken = getSecret("POLAR_ACCESS_TOKEN");
		}

		const polar = new Polar({
			accessToken,
			server,
		});

		const customerId = await getCustomerId(request);

		if (!customerId) {
			return Response.json(
				{ error: "customerId not defined" },
				{ status: 400 },
			);
		}

		const retUrl = returnUrl ? new URL(returnUrl) : undefined;

		try {
			const result = await polar.customerSessions.create({
				customerId,
				returnUrl: retUrl ? decodeURI(retUrl.toString()) : undefined,
			});

			return Response.redirect(result.customerPortalUrl);
		} catch (error) {
			console.error(error);
			return Response.json({ error: "Internal server error" }, { status: 500 });
		}
	};
};
