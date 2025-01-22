import { Polar } from "@polar-sh/sdk";
import type { Context } from "elysia";
import type { InlineHandler } from "elysia/dist/types";

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
}: CheckoutConfig): InlineHandler => {
	const polar = new Polar({
		/** biome-ignore lint/complexity/useLiteralKeys: fix ci */
		accessToken: accessToken ?? process.env["POLAR_ACCESS_TOKEN"],
		server,
	});

	return async (ctx: Context) => {
		const url = new URL(ctx.request.url);
		const productId = url.searchParams.get("productId") ?? undefined;
		const productPriceId = url.searchParams.get("productPriceId") ?? undefined;

		if (!productId && !productPriceId) {
			return ctx.error(400, {
				error: "Missing productId or productPriceId in query params",
			});
		}

		const success = successUrl ? new URL(successUrl) : undefined;

		if (success && includeCheckoutId) {
			success.searchParams.set("checkoutId", "{CHECKOUT_ID}");
		}

		try {
			const result = await polar.checkouts.custom.create({
				...(productId
					? { productId }
					: { productPriceId: productPriceId ?? "" }),
				successUrl: success ? decodeURI(success.toString()) : undefined,
				customerId: url.searchParams.get("customerId") ?? undefined,
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

			return ctx.redirect(result.url);
		} catch (error) {
			console.error(error);
			return { error: "Internal server error" };
		}
	};
};
