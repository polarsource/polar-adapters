import { Polar } from "@polar-sh/sdk";
import { type NextRequest, NextResponse } from "next/server";

export interface CustomerPortalConfig {
	accessToken: string;
	getCustomerId: (req: NextRequest) => Promise<string>;
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

	return async (req: NextRequest) => {
		const retUrl = returnUrl ? new URL(returnUrl) : undefined;

		const customerId = await getCustomerId(req);

		if (!customerId) {
			return NextResponse.json(
				{ error: "customerId not defined" },
				{ status: 400 },
			);
		}

		try {
			const result = await polar.customerSessions.create({
				customerId,
				returnUrl: retUrl ? decodeURI(retUrl.toString()) : undefined,
			});

			return NextResponse.redirect(result.customerPortalUrl);
		} catch (error) {
			console.error(error);
			return NextResponse.error();
		}
	};
};
