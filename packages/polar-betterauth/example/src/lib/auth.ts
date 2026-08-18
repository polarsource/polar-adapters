import {
	checkout,
	polar,
	portal,
	usage,
	webhooks,
} from "@polar-sh/better-auth";
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import Database from "better-sqlite3";
import { polarSDK } from "./polar";

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
			experimental_organization: {
				enabled: true,
				async getTeamCustomerCreateParams({ organization, owner }) {
					return {
						metadata: {
							source: "better-auth",
							betterAuthOrganizationId: organization.id,
							createdBy: owner.id,
						},
					};
				},
			},
			use: [
				checkout({
					theme: "dark",
					products: [
						{
							productId: "e651f46d-ac20-4f26-b769-ad088b123df2",
							slug: "pro",
						},
					],
					returnUrl: "https://myapp.com",
				}),
				usage(),
				portal({
					returnUrl: "https://myapp.com",
				}),
				webhooks({
					secret: process.env["POLAR_WEBHOOK_SECRET"] as string,
					onMemberCreated: async (payload) => {
						// Notification only: do not mutate Better Auth memberships here.
						void payload;
					},
					onMemberUpdated: async (payload) => {
						// Make production webhook handlers idempotent.
						void payload;
					},
					onMemberDeleted: async (payload) => {
						void payload;
					},
				}),
			],
		}),
	],
	database: new Database("sqlite.db"),
});
