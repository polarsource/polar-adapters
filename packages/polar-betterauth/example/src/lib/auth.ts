import { betterAuth, logger } from "better-auth";
import { polar, polarAuth } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import Database from "better-sqlite3";

const client = new Polar({
  accessToken: process.env["POLAR_ACCESS_TOKEN"] as string,
  server: "sandbox",
});

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    polar({
      client,
      createCustomerOnSignUp: true,
      enableCustomerPortal: true,
      checkout: {
        enabled: true,
        products: [
          {
            productId: "e651f46d-ac20-4f26-b769-ad088b123df2",
            slug: "pro",
          },
        ],
        successUrl: "/?checkout_id={CHECKOUT_ID}",
      },
      webhooks: {
        secret: process.env["POLAR_WEBHOOK_SECRET"] as string,
        onPayload: async (payload) =>
          logger.info(JSON.stringify(payload, null, 2)),
      },
    }),
  ],
  database: new Database("sqlite.db"),
});
