import { Polar } from "@polar-sh/sdk";

export interface CustomerPortalConfig {
	accessToken: string;
	getCustomerId: (req: Request) => Promise<string>;
	server: "sandbox" | "production";
	returnUrl?: string;
}

export const CustomerPortal = ({
	accessToken,
	server,
	getCustomerId,
	returnUrl,
}: CustomerPortalConfig) => {
	const polar = new Polar({
		accessToken,
		server,
	});

	return async (req: Request) => {
		const retUrl = returnUrl ? new URL(returnUrl) : undefined;

		const customerId = await getCustomerId(req);

		if (!customerId) {
			return new Response(JSON.stringify({ error: "customerId not defined" }), {
				status: 400,
				headers: { "Content-Type": "application/json" },
			});
		}

		try {
			const result = await polar.customerSessions.create({
				customerId,
				returnUrl: retUrl ? decodeURI(retUrl.toString()) : undefined,
			});

			return new Response(null, {
				status: 302,
				headers: {
					Location: result.customerPortalUrl,
				},
			});
		} catch (error) {
			console.error(error);
			return new Response(null, { status: 500 });
		}
	};
};
