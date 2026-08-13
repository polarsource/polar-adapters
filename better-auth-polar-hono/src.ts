import "dotenv/config";

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { auth, polarClient } from "./auth";

const port = Number(process.env.PORT ?? 3002);
const apiBase = `http://localhost:${port}/api/auth`;

const app = new Hono();

app.get("/", (c) =>
	c.json({
		message: "Better Auth + Polar organization playground",
		authBaseURL: apiBase,
		instructions: "Open /help for endpoints and curl examples",
	}),
);

app.get("/help", (c) =>
	c.json({
		note: "Keep one cookie jar per user: curl -c owner.cookies -b owner.cookies ...",
		betterAuth: {
			signUp: {
				method: "POST",
				path: "/api/auth/sign-up/email",
				body: { name: "Owner", email: "owner@example.com", password: "password123" },
			},
			signIn: {
				method: "POST",
				path: "/api/auth/sign-in/email",
				body: { email: "owner@example.com", password: "password123" },
			},
			session: { method: "GET", path: "/api/auth/get-session" },
			updateUser: {
				method: "POST",
				path: "/api/auth/update-user",
				body: { name: "Updated Owner" },
			},
			deleteUser: {
				method: "POST",
				path: "/api/auth/delete-user",
				body: { password: "password123" },
			},
		},
		organization: {
			create: {
				method: "POST",
				path: "/api/auth/organization/create",
				body: { name: "Acme", slug: "acme" },
			},
			list: { method: "GET", path: "/api/auth/organization/list" },
			get: {
				method: "GET",
				path: "/api/auth/organization/get-full-organization?organizationId=ORG_ID",
			},
			update: {
				method: "POST",
				path: "/api/auth/organization/update",
				body: { organizationId: "ORG_ID", data: { name: "Acme renamed" } },
			},
			addMember: {
				method: "POST",
				path: "/api/auth/organization/add-member",
				body: { organizationId: "ORG_ID", userId: "USER_ID", role: "member" },
			},
			inviteMember: {
				method: "POST",
				path: "/api/auth/organization/invite-member",
				body: { organizationId: "ORG_ID", email: "member@example.com", role: "member" },
			},
			acceptInvitation: {
				method: "POST",
				path: "/api/auth/organization/accept-invitation",
				body: { invitationId: "INVITATION_ID" },
			},
			updateRole: {
				method: "POST",
				path: "/api/auth/organization/update-member-role",
				body: { organizationId: "ORG_ID", memberId: "MEMBER_ID", role: "admin" },
			},
			removeMember: {
				method: "POST",
				path: "/api/auth/organization/remove-member",
				body: { organizationId: "ORG_ID", memberIdOrEmail: "MEMBER_ID_OR_EMAIL" },
			},
			leave: {
				method: "POST",
				path: "/api/auth/organization/leave",
				body: { organizationId: "ORG_ID" },
			},
			delete: {
				method: "POST",
				path: "/api/auth/organization/delete",
				body: { organizationId: "ORG_ID" },
			},
		},
		polarPlugin: {
			checkout: {
				method: "POST",
				path: "/api/auth/checkout",
				body: { slug: "pro", organizationId: "ORG_ID", redirect: false },
			},
			portal: {
				method: "GET",
				path: "/api/auth/customer/portal?organizationId=ORG_ID",
			},
			state: {
				method: "GET",
				path: "/api/auth/customer/state?organizationId=ORG_ID",
			},
			subscriptions: {
				method: "GET",
				path: "/api/auth/customer/subscriptions/list?organizationId=ORG_ID",
			},
			orders: {
				method: "GET",
				path: "/api/auth/customer/orders/list?organizationId=ORG_ID",
			},
			benefits: {
				method: "GET",
				path: "/api/auth/customer/benefits/list?organizationId=ORG_ID",
			},
			meters: {
				method: "GET",
				path: "/api/auth/usage/meters/list?organizationId=ORG_ID",
			},
			ingestUsage: {
				method: "POST",
				path: "/api/auth/usage/ingest",
				body: { organizationId: "ORG_ID", event: "api_request", metadata: { units: 1 } },
			},
		},
		debug: {
			polarMirror: "GET /debug/polar/organizations/ORG_ID",
		},
	}),
);

app.get("/debug/polar/organizations/:organizationId", async (c) => {
	const organizationId = c.req.param("organizationId");
	try {
		const [customer, members] = await Promise.all([
			polarClient.customers.getExternal({ externalId: organizationId }),
			polarClient.members.listMembers({ externalCustomerId: organizationId, limit: 100 }),
		]);
		return c.json({ customer, members });
	} catch (error) {
		return c.json(
			{ error: error instanceof Error ? error.message : String(error) },
			500,
		);
	}
});

app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

serve(
	{ fetch: app.fetch, port, overrideGlobalObjects: false },
	({ port: runningPort }) => {
		console.log(`Playground running at http://localhost:${runningPort}`);
		console.log(`Endpoint guide: http://localhost:${runningPort}/help`);
	},
);
