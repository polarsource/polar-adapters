import { betterAuth } from "better-auth";
import { polar } from "@polar-sh/better-auth";
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
			webhookSecret: process.env["POLAR_WEBHOOK_SECRET"] as string,
			createCustomerOnSignUp: true,
		}),
	],
	database: new Database("sqlite.db"),
});
