import { Polar } from "@polar-sh/sdk";
import { type NextRequest, NextResponse } from "next/server";

export interface CustomerPortalConfig {
	accessToken: string;
	getCustomerId: (req: NextRequest) => Promise<string>;
	server: "sandbox" | "production";
	theme?: "light" | "dark" | "auto";
}

export const CustomerPortal = ({
	accessToken,
	server,
	getCustomerId,
	theme,
}: CustomerPortalConfig) => {
	const polar = new Polar({
		accessToken,
		server,
	});

	return async (req: NextRequest) => {
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
			});

			const redirectUrl = new URL(result.customerPortalUrl);

			if (theme && theme !== "auto") {
				redirectUrl.searchParams.set("theme", theme);
			}

			return NextResponse.redirect(redirectUrl.toString());
		} catch (error) {
			console.error(error);
			return NextResponse.error();
		}
	};
};
