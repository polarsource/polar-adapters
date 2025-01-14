import { Polar } from "@polar-sh/sdk";
import { APIRoute } from "astro";

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
}: CheckoutConfig): APIRoute => {
  return async ({ url }) => {
    if (!accessToken) {
      const { getSecret } = await import("astro:env/server");
      accessToken = getSecret("POLAR_ACCESS_TOKEN");
    }

    const polar = new Polar({
      accessToken,
      server,
    });

    const productId = url.searchParams.get("productId");

    if (!productId) {
      return Response.json(
        { error: "Missing productId in query params" },
        { status: 400 }
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

      return Response.redirect(result.url);
    } catch (error) {
      console.error(error);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
};