import { betterAuth, logger } from "better-auth";
import { polar, checkout, webhooks, usage } from "@polar-sh/better-auth";
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
				checkout(),
				usage(),
				webhooks({
					secret: process.env["POLAR_WEBHOOK_SECRET"] as string,
				}),
			],
		}),
	],
	database: new Database("sqlite.db"),
});
