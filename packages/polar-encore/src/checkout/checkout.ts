import { Polar } from "@polar-sh/sdk";
import type { RawRequest, RawResponse } from "encore.dev/api";

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
    accessToken,
    server,
  });

  return async (req: RawRequest, resp: RawResponse) => {
    // Construct URL from request
    const protocol = req.headers["x-forwarded-proto"] || "http";
    const host = req.headers.host || "localhost";
    const url = new URL(`${protocol}://${host}${req.url}`);
    
    const products = url.searchParams.getAll("products");

    if (products.length === 0) {
      resp.writeHead(400, { "Content-Type": "application/json" });
      resp.end(JSON.stringify({
        error: "Missing products in query params",
      }));
      return;
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
        seats: url.searchParams.has("seats")
          ? Number.parseInt(url.searchParams.get("seats") ?? "1", 10)
          : undefined,
        returnUrl: retUrl ? decodeURI(retUrl.toString()) : undefined,
      });

      const redirectUrl = new URL(result.url);

      if (theme) {
        redirectUrl.searchParams.set("theme", theme);
      }

      resp.writeHead(302, { Location: redirectUrl.toString() });
      resp.end();
    } catch (error) {
      console.error(error);
      resp.writeHead(500, { "Content-Type": "application/json" });
      resp.end(JSON.stringify({ error: "Internal server error" }));
    }
  };
};

