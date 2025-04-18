import { Polar } from "@polar-sh/sdk";
import type { Request, Response } from "express";

export interface CheckoutConfig {
	accessToken?: string;
	successUrl?: string;
	includeCheckoutId?: boolean;
	server?: "sandbox" | "production";
}

export const Checkout = ({
	accessToken,
	successUrl,
	server,
	includeCheckoutId = true,
}: CheckoutConfig) => {
	const polar = new Polar({
		accessToken: accessToken ?? process.env["POLAR_ACCESS_TOKEN"],
		server,
	});

	return async (req: Request, res: Response) => {
		const url = new URL(
			`${req.protocol}://${req.get("host")}${req.originalUrl}`,
		);
		const products = url.searchParams.getAll("products");

		if (products.length === 0) {
			res.status(400).json({
				error: "Missing products in query params",
			});
			return;
		}

		const success = successUrl ? new URL(successUrl) : undefined;

		if (success && includeCheckoutId) {
			success.searchParams.set("checkoutId", "{CHECKOUT_ID}");
		}

		try {
			const result = await polar.checkouts.create({
				products,
				successUrl: success ? decodeURI(success.toString()) : undefined,
				customerId: url.searchParams.get("customerId") ?? undefined,
				customerExternalId:
					url.searchParams.get("customerExternalId") ?? undefined,
				customerEmail: url.searchParams.get("customerEmail") ?? undefined,
				customerName: url.searchParams.get("customerName") ?? undefined,
				customerBillingAddress: url.searchParams.has("customerBillingAddress")
					? JSON.parse(url.searchParams.get("customerBillingAddress") ?? "{}")
					: undefined,
				customerTaxId: url.searchParams.get("customerTaxId") ?? undefined,
				customerIpAddress:
					url.searchParams.get("customerIpAddress") ?? undefined,
				customerMetadata: url.searchParams.has("customerMetadata")
					? JSON.parse(url.searchParams.get("customerMetadata") ?? "{}")
					: undefined,
				allowDiscountCodes: url.searchParams.has("allowDiscountCodes")
					? url.searchParams.get("allowDiscountCodes") === "true"
					: undefined,
				discountId: url.searchParams.get("discountId") ?? undefined,
				metadata: url.searchParams.has("metadata")
					? JSON.parse(url.searchParams.get("metadata") ?? "{}")
					: undefined,
			});

			res.redirect(result.url);
		} catch (error) {
			console.error(error);
			res.status(500).json({ error: "Internal server error" });
		}
	};
};
