import { Polar } from "@polar-sh/sdk";
import {
  WebhookVerificationError,
  validateEvent,
} from "@polar-sh/sdk/webhooks";
import type { RequestEvent } from "@sveltejs/kit";
import {
  type WebhooksConfig,
  handleWebhookPayload,
} from "@polar-sh/adapter-utils";
export interface CheckoutConfig {
  accessToken?: string;
  successUrl?: string;
  includeCheckoutId?: boolean;
  server?: "sandbox" | "production";
}

export type CheckoutHandler = (event: RequestEvent) => Promise<Response>;
export type CustomerPortalHandler = (event: RequestEvent) => Promise<Response>;
export type WebhookHandler = (event: RequestEvent) => Promise<Response>;

export const Checkout = ({
  accessToken,
  successUrl,
  server,
  includeCheckoutId = true,
}: CheckoutConfig): CheckoutHandler => {
  const polar = new Polar({ accessToken, server });

  return async (event) => {
    const url = new URL(event.request.url);
    const productId = url.searchParams.get("productId") ?? undefined;
    const productPriceId = url.searchParams.get("productPriceId") ?? undefined;

    if (!productId && !productPriceId) {
      return new Response(
        JSON.stringify({
          error: "Missing productId or productPriceId in query params",
        }),
        { status: 400 },
      );
    }

    const success = successUrl ? new URL(successUrl, event.url) : undefined;

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

      return new Response(null, {
        status: 302,
        headers: { Location: result.url },
      });
    } catch (error) {
      console.error("Catch checkout error", error);
      return new Response(null, { status: 500 });
    }
  };
};

export interface CustomerPortalConfig {
  accessToken: string;
  server?: "sandbox" | "production";
  getCustomerId: (event: RequestEvent) => Promise<string>;
}

export const CustomerPortal = ({
  accessToken,
  server,
  getCustomerId,
}: CustomerPortalConfig): CustomerPortalHandler => {
  const polar = new Polar({
    accessToken,
    server,
  });

  return async (event) => {
    const customerId = await getCustomerId(event);

    if (!customerId) {
      return new Response(JSON.stringify({ error: "customerId not defined" }), {
        status: 400,
      });
    }

    try {
      const result = await polar.customerSessions.create({
        customerId,
      });

      return new Response(null, {
        status: 302,
        headers: { Location: result.customerPortalUrl },
      });
    } catch (error) {
      console.error(error);
      return new Response(null, { status: 500 });
    }
  };
};

export const Webhooks = ({
  webhookSecret,
  entitlements,
  onPayload,
  ...eventHandlers
}: WebhooksConfig): WebhookHandler => {
  return async (event: RequestEvent) => {
    const requestBody = await event.request.text();
    const webhookHeaders = {
      "webhook-id": event.request.headers.get("webhook-id") ?? "",
      "webhook-timestamp": event.request.headers.get("webhook-timestamp") ?? "",
      "webhook-signature": event.request.headers.get("webhook-signature") ?? "",
    };

    let webhookPayload: any;

    try {
      webhookPayload = validateEvent(
        requestBody,
        webhookHeaders,
        webhookSecret,
      );
    } catch (error) {
      if (error instanceof WebhookVerificationError) {
        return new Response(JSON.stringify({ received: false }), {
          status: 403,
        });
      }
      throw error;
    }

    await handleWebhookPayload(webhookPayload, {
      webhookSecret,
      entitlements,
      onPayload,
      ...eventHandlers,
    });

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  };
};
