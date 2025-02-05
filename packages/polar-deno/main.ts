import {
  type WebhooksConfig,
  handleWebhookPayload,
} from "npm:@polar-sh/adapter-utils";
import { Polar } from "npm:@polar-sh/sdk";
import {
  WebhookVerificationError,
  validateEvent,
} from "npm:@polar-sh/sdk/webhooks.js";

export {
  type EntitlementContext,
  type EntitlementHandler,
  type EntitlementProperties,
  EntitlementStrategy,
  Entitlements,
} from "npm:@polar-sh/adapter-utils/index.js";

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
    accessToken: accessToken ?? Deno.env.get("POLAR_ACCESS_TOKEN"),
    server,
  });

  return async (request: Request) => {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");

    if (!productId) {
      return new Response(
        JSON.stringify({ error: "Missing productId in query params" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const success = successUrl ? new URL(successUrl) : undefined;

    if (success && includeCheckoutId) {
      success.searchParams.set("checkoutId", "{CHECKOUT_ID}");
    }

    try {
      const result = await polar.checkouts.create({
        productId,
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

      return Response.redirect(result.url);
    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
};

export interface CustomerPortalConfig {
  accessToken?: string;
  getCustomerId: (request: Request) => Promise<string>;
  server?: "sandbox" | "production";
}

export const CustomerPortal = ({
  accessToken,
  server,
  getCustomerId,
}: CustomerPortalConfig) => {
  const polar = new Polar({
    accessToken: accessToken ?? Deno.env.get("POLAR_ACCESS_TOKEN"),
    server,
  });

  return async (request: Request) => {
    const customerId = await getCustomerId(request);

    if (!customerId) {
      return new Response(JSON.stringify({ error: "customerId not defined" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const result = await polar.customerSessions.create({
        customerId,
      });

      return Response.redirect(result.customerPortalUrl);
    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
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
  return async (request: Request) => {
    const requestBody = await request.text();

    const webhookHeaders = {
      "webhook-id": request.headers.get("webhook-id") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
      "webhook-signature": request.headers.get("webhook-signature") ?? "",
    };

    let webhookPayload: ReturnType<typeof validateEvent>;
    try {
      webhookPayload = validateEvent(
        requestBody,
        webhookHeaders,
        webhookSecret,
      );
    } catch (error) {
      console.log(error);
      if (error instanceof WebhookVerificationError) {
        return new Response(JSON.stringify({ received: false }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
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

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
    });
  };
};
