import { betterAuth } from "better-auth";
import {
	polar,
	checkout,
	webhooks,
	usage,
	portal,
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
			async getCustomerCreateParams() {
				return {
					metadata: {
						hello: "world",
					},
				};
			},
			use: [
				checkout({
					theme: "light",
				}),
				usage(),
				portal(),
				webhooks({
					secret: process.env["POLAR_WEBHOOK_SECRET"] as string,
					onOrganizationUpdated: async (payload) => {
						console.log(payload);
					},
				}),
			],
		}),
	],
	database: new Database("sqlite.db"),
});
