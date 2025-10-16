import {
	type WebhooksConfig,
	handleWebhookPayload,
} from "@polar-sh/adapter-utils";
import { Polar } from "@polar-sh/sdk";
import {
	WebhookVerificationError,
	validateEvent,
} from "@polar-sh/sdk/webhooks";
import type { Context } from "hono";

export {
	type EntitlementContext,
	type EntitlementHandler,
	type EntitlementProperties,
	EntitlementStrategy,
	Entitlements,
} from "@polar-sh/adapter-utils";
export interface CheckoutConfig {
	accessToken?: string;
	successUrl?: string;
	returnUrl?: string;
	includeCheckoutId?: boolean;
	server?: "sandbox" | "production";
	theme?: "light" | "dark";
}

export const Checkout = ({
	accessToken,
	successUrl,
	returnUrl,
	server,
	theme,
	includeCheckoutId = true,
}: CheckoutConfig) => {
	const polar = new Polar({
		accessToken: accessToken ?? process.env["POLAR_ACCESS_TOKEN"],
		server,
	});

	return async (c: Context) => {
		const url = new URL(c.req.url);
		const products = url.searchParams.getAll("products");

		if (products.length === 0) {
			return c.json(
				{ error: "Missing products in query params" },
				{ status: 400 },
			);
		}

		const success = successUrl ? new URL(successUrl) : undefined;

		if (success && includeCheckoutId) {
			success.searchParams.set("checkoutId", "{CHECKOUT_ID}");
		}

		const retUrl = returnUrl ? new URL(returnUrl) : undefined;

		try {
			const result = await polar.checkouts.create({
				products,
				successUrl: success ? decodeURI(success.toString()) : undefined,
				customerId: url.searchParams.get("customerId") ?? undefined,
				externalCustomerId:
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
				returnUrl: retUrl ? decodeURI(retUrl.toString()) : undefined,
			});

			const redirectUrl = new URL(result.url);

			if (theme) {
				redirectUrl.searchParams.set("theme", theme);
			}

			return c.redirect(redirectUrl.toString());
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
	returnUrl?: string;
}

export const CustomerPortal = ({
	accessToken,
	server,
	getCustomerId,
	returnUrl,
}: CustomerPortalConfig) => {
	const polar = new Polar({
		accessToken: accessToken ?? process.env["POLAR_ACCESS_TOKEN"],
		server,
	});

	return async (c: Context) => {
		const retUrl = returnUrl ? new URL(returnUrl) : undefined;

		const customerId = await getCustomerId(c);

		if (!customerId) {
			return c.json({ error: "customerId not defined" }, { status: 400 });
		}

		try {
			const result = await polar.customerSessions.create({
				customerId,
				returnUrl: retUrl ? decodeURI(retUrl.toString()) : undefined,
			});

			return c.redirect(result.customerPortalUrl);
		} catch (error) {
			console.error(error);
			return c.json({ error: "Internal server error" }, { status: 500 });
		}
	};
};

export const Webhooks = ({
	webhookSecret,
	onPayload,
	entitlements,
	...eventHandlers
}: WebhooksConfig) => {
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

		await handleWebhookPayload(webhookPayload, {
			webhookSecret,
			entitlements,
			onPayload,
			...eventHandlers,
		});

		return c.json({ received: true });
	};
};
