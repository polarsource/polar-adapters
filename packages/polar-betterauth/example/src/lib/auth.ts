import { betterAuth, logger } from "better-auth";
import {
	polar,
	checkout,
	portal,
	webhooks,
	usage as credits,
} from "@polar-sh/better-auth";
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
			use: [
				checkout({
					successUrl: "/?checkout_id={CHECKOUT_ID}",
				}),
				portal(),
				credits(),
				webhooks({
					secret: process.env["POLAR_WEBHOOK_SECRET"] as string,
				}),
			],
		}),
	],
	database: new Database("sqlite.db"),
});
