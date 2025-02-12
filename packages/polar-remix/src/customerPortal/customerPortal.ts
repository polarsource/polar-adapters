import { Polar } from "@polar-sh/sdk";
import type { LoaderFunction } from "../types";

export interface CustomerPortalConfig {
	accessToken?: string;
	getCustomerId: (req: Request) => Promise<string>;
	server?: "sandbox" | "production";
}

export const CustomerPortal = ({
	accessToken,
	server,
	getCustomerId,
}: CustomerPortalConfig): LoaderFunction => {
	const polar = new Polar(
		/** biome-ignore lint/complexity/useLiteralKeys: fix ci */ {
			accessToken: accessToken ?? process.env["POLAR_ACCESS_TOKEN"],
			server,
		},
	);

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
			return Response.json({ error: "Internal server error" }, { status: 500 });
		}
	};
};
