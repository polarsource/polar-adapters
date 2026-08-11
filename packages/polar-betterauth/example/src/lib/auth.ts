import { betterAuth } from "better-auth";
import {
	polar,
	polarOrgHooks,
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
		organization({
			// Mirror organizations to Polar team customers and the member
			// roster to Polar members. better-auth is the source of truth;
			// Polar follows.
			organizationHooks: polarOrgHooks({
				client: polarSDK,
				onSyncError: (error, { hook, organizationId }) => {
					console.error(`Polar sync failed in ${hook} for ${organizationId}`, error);
				},
			}),
		}),
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
					onOrganizationUpdated: async (payload) => {
						console.log(payload);
					},
					// Member events are notification-only: the roster sync is
					// one-way (better-auth -> Polar), so never mutate
					// better-auth memberships from these.
					onMemberCreated: async (payload) => {
						console.log("Polar member created", payload);
					},
					onMemberDeleted: async (payload) => {
						console.log("Polar member deleted", payload);
					},
				}),
			],
		}),
	],
	database: new Database("sqlite.db"),
});
