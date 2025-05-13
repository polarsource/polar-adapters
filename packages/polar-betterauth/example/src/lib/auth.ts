import { betterAuth, logger } from "better-auth";
import { polar } from "@polar-sh/better-auth";
import Database from "better-sqlite3";
import { polarSDK } from "./polar";
import { organization } from "better-auth/plugins";

export const auth = betterAuth({
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		organization(),
		polar({
			client: polarSDK,
			createCustomerOnSignUp: true,
			customerPortal: {
				enabled: true,
			},
			subscriptions: {
				enabled: true,
			},
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
