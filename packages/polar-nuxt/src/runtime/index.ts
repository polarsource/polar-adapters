import {
	type WebhooksConfig,
	handleWebhookPayload,
} from "@polar-sh/adapter-utils";
import { Polar } from "@polar-sh/sdk";
import {
	WebhookVerificationError,
	validateEvent,
} from "@polar-sh/sdk/webhooks";
import {
	type H3Event,
	createError,
	getHeader,
	getRequestURL,
	readBody,
	sendRedirect,
} from "h3";

export interface CheckoutConfig {
	accessToken?: string;
	successUrl?: string;
	includeCheckoutId?: boolean;
	server?: "sandbox" | "production";
}

export interface CustomerPortalConfig {
	accessToken: string;
	server?: "sandbox" | "production";
	getCustomerId: (event: H3Event) => Promise<string>;
}

export const Checkout = ({
	accessToken,
	successUrl,
	server,
	includeCheckoutId = true,
}: CheckoutConfig) => {
	const polar = new Polar({ accessToken, server });

	return async (event: H3Event) => {
		const url = new URL(getRequestURL(event));
		const productId = url.searchParams.get("productId") ?? undefined;
		const productPriceId = url.searchParams.get("productPriceId") ?? undefined;

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
			const result = await polar.checkouts.custom.create({
				...(productId
					? { productId }
					: { productPriceId: productPriceId ?? "" }),
				successUrl: success?.toString(),
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

			return sendRedirect(event, result.url);
		} catch (error) {
			console.error("Checkout error:", error);
			throw createError({
				statusCode: 500,
				message: "Internal server error",
			});
		}
	};
};

export const CustomerPortal = ({
	accessToken,
	server,
	getCustomerId,
}: CustomerPortalConfig) => {
	const polar = new Polar({
		accessToken,
		server,
	});

	return async (event: H3Event) => {
		const customerId = await getCustomerId(event);

		if (!customerId) {
			throw createError({
				statusCode: 400,
				message: "customerId not defined",
			});
		}

		try {
			const result = await polar.customerSessions.create({
				customerId,
			});

			return sendRedirect(event, result.customerPortalUrl);
		} catch (error) {
			console.error(error);
			throw createError({
				statusCode: 500,
				message: "Internal server error",
			});
		}
	};
};

export const Webhooks = ({
	webhookSecret,
	onPayload,
	entitlements,
	...eventHandlers
}: WebhooksConfig) => {
	return async (event: H3Event) => {
		const requestBody = await readBody(event);

		const webhookHeaders = {
			"webhook-id": getHeader(event, "webhook-id") ?? "",
			"webhook-timestamp": getHeader(event, "webhook-timestamp") ?? "",
			"webhook-signature": getHeader(event, "webhook-signature") ?? "",
		};

		let webhookPayload: ReturnType<typeof validateEvent>;

		try {
			webhookPayload = validateEvent(
				JSON.stringify(requestBody),
				webhookHeaders,
				webhookSecret,
			);
		} catch (error) {
			if (error instanceof WebhookVerificationError) {
				return { received: false };
			}
			throw error;
		}

		await handleWebhookPayload(webhookPayload, {
			webhookSecret,
			entitlements,
			onPayload,
			...eventHandlers,
		});

		return { received: true };
	};
};
