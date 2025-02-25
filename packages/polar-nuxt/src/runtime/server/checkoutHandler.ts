import { z } from "zod";
import { Polar } from "@polar-sh/sdk";
import { type H3Event, createError, getValidatedQuery, sendRedirect } from "h3";

export interface CheckoutConfig {
	accessToken?: string;
	successUrl?: string;
	includeCheckoutId?: boolean;
	server?: "sandbox" | "production";
}

const checkoutQuerySchema = z.object({
	productId: z.string().nonempty().optional(),
	productPriceId: z.string().nonempty().optional(),
	customerId: z.string().nonempty().optional(),
	customerEmail: z.string().email().optional(),
	customerName: z.string().nonempty().optional(),
	customerBillingAddress: z.string().nonempty().optional(),
	customerTaxId: z.string().nonempty().optional(),
	customerIpAddress: z.string().nonempty().optional(),
	customerMetadata: z.string().nonempty().optional(),
	allowDiscountCodes: z
		.string()
		.toLowerCase()
		.transform((x) => x === "true")
		.pipe(z.boolean())
		.optional(),
	discountId: z.string().nonempty().optional(),
	metadata: z.string().nonempty().optional(),
});

export const Checkout = ({
	accessToken,
	successUrl,
	server,
	includeCheckoutId = true,
}: CheckoutConfig) => {
	return async (event: H3Event) => {
		const {
			productId,
			productPriceId,
			customerId,
			customerEmail,
			customerName,
			customerBillingAddress,
			customerTaxId,
			customerIpAddress,
			customerMetadata,
			allowDiscountCodes,
			discountId,
			metadata,
		} = await getValidatedQuery(event, checkoutQuerySchema.parse);

		if (!productId && !productPriceId) {
			throw createError({
				statusCode: 400,
				message: "Missing productId or productPriceId in query params",
			});
		}

		const success = successUrl ? new URL(successUrl) : undefined;

		if (success && includeCheckoutId) {
			success.searchParams.set("checkoutId", "{CHECKOUT_ID}");
		}

		try {
			const polar = new Polar({ accessToken, server });

			const result = await polar.checkouts.create({
				...(productId
					? { productId }
					: { productPriceId: productPriceId ?? "" }),
				successUrl: success ? decodeURI(success.toString()) : undefined,
				customerId,
				customerEmail,
				customerName,
				customerBillingAddress: customerBillingAddress
					? JSON.parse(customerBillingAddress)
					: undefined,
				customerTaxId,
				customerIpAddress,
				customerMetadata: customerMetadata
					? JSON.parse(customerMetadata)
					: undefined,
				allowDiscountCodes,
				discountId,
				metadata: metadata ? JSON.parse(metadata) : undefined,
			});

			return sendRedirect(event, result.url);
		} catch (error) {
			console.error("Checkout error:", error);
			throw createError({
				statusCode: 500,
				statusMessage: error.statusMessage,
				message: error.message ?? "Internal server error",
			});
		}
	};
};
