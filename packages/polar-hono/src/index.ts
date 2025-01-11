import { Polar, WebhookVerificationError, validateEvent } from "@polar-sh/sdk";
import type { Context } from "hono";

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
		accessToken: accessToken ?? process.env.POLAR_ACCESS_TOKEN,
		server,
	});

	return async (c: Context) => {
		const url = new URL(c.req.url);
		const productId = url.searchParams.get("productId");

		if (!productId) {
			return c.json(
				{ error: "Missing productId in query params" },
				{ status: 400 },
			);
		}

		const success = successUrl ? new URL(successUrl) : undefined;

		if (success && includeCheckoutId) {
			success.searchParams.set("checkoutId", "{CHECKOUT_ID}");
		}

		try {
			const result = await polar.checkouts.custom.create({
				productId,
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

			return c.redirect(result.url);
		} catch (error) {
			console.error(error);
			return c.json({ error: "Internal server error" }, { status: 500 });
		}
	};
};

export interface CustomerPortalConfig {
	accessToken?: string;
	getCustomerId: (req: Context) => Promise<string>;
	server?: "sandbox" | "production";
}

export const CustomerPortal = ({
	accessToken,
	server,
	getCustomerId,
}: CustomerPortalConfig) => {
	const polar = new Polar({
		accessToken: accessToken ?? process.env.POLAR_ACCESS_TOKEN,
		server,
	});

	return async (c: Context) => {
		const customerId = await getCustomerId(c);

		if (!customerId) {
			return c.json({ error: "customerId not defined" }, { status: 400 });
		}

		try {
			const result = await polar.customerSessions.create({
				customerId,
			});

			return c.redirect(result.customerPortalUrl);
		} catch (error) {
			console.error(error);
			return c.json({ error: "Internal server error" }, { status: 500 });
		}
	};
};

export interface WebhooksConfig {
	webhookSecret: string;
	onPayload: (payload: ReturnType<typeof validateEvent>) => Promise<void>;
}

export const Webhooks = ({ webhookSecret, onPayload }: WebhooksConfig) => {
	return async (c: Context) => {
		const requestBody = await c.req.text();

		const webhookHeaders = {
			"webhook-id": c.req.header("webhook-id") ?? "",
			"webhook-timestamp": c.req.header("webhook-timestamp") ?? "",
			"webhook-signature": c.req.header("webhook-signature") ?? "",
		};

		let webhookPayload: ReturnType<typeof validateEvent>;
		try {
			webhookPayload = validateEvent(
				requestBody,
				webhookHeaders,
				webhookSecret,
			);
		} catch (error) {
			if (error instanceof WebhookVerificationError) {
				return c.json({ received: false }, { status: 403 });
			}

			throw error;
		}

		await onPayload(webhookPayload);

		return c.json({ received: true });
	};
};