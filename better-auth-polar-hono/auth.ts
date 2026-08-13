import "dotenv/config";

import { checkout, polar, portal, usage } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { DatabaseSync } from "node:sqlite";

export const polarClient = new Polar({
	accessToken:
		"polar_oat_z82H9sY1wxEfvw9NAQWrlmFHy2tnL3kvueP6l1lnYRM",
	serverURL: process.env.POLAR_SERVER_URL ?? "http://127.0.0.1:8101",
});

const productId = process.env.POLAR_PRODUCT_ID;

export const auth = betterAuth({
	baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3002",
	secret:
		process.env.BETTER_AUTH_SECRET ??
		"throwaway-local-secret-at-least-32-characters",
	database: new DatabaseSync("./better-auth.sqlite"),
	emailAndPassword: { enabled: true },
	user: { deleteUser: { enabled: true } },
	plugins: [
		organization({
			sendInvitationEmail: async ({ invitation, organization, email }) => {
				console.log(
					`Invitation for ${email} to ${organization.name}: ${invitation.id}`,
				);
			},
		}),
		polar({
			client: polarClient,
			createCustomerOnSignUp: true,
			organization: { enabled: true },
			use: [
				checkout({
					authenticatedUsersOnly: true,
					products: productId
						? [{ slug: "pro", productId }]
						: undefined,
					successUrl: "/",
					returnUrl: "/",
				}),
				portal({ returnUrl: "http://localhost:3002" }),
				usage(),
			],
		}),
	],
});
