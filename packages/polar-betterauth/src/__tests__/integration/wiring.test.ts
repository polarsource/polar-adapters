import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { organization } from "better-auth/plugins";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { polarOrgHooks } from "../../org-hooks";
import { checkout } from "../../plugins/checkout";
import { portal } from "../../plugins/portal";
import { usage } from "../../plugins/usage";
import { polar } from "../../server";
import { createMockPolarClient } from "../utils/mocks";

/**
 * Run a real better-auth instance (memory adapter) with polar() and
 * organization() installed, mocking only at the Polar SDK seam.
 */

const emptyCustomerList = {
	result: { items: [], pagination: { totalCount: 0, maxPage: 1 } },
	next: vi.fn(),
	[Symbol.asyncIterator]: vi.fn(),
};

const customerListWith = (customer: Record<string, unknown>) => ({
	result: { items: [customer], pagination: { totalCount: 1, maxPage: 1 } },
	next: vi.fn(),
	[Symbol.asyncIterator]: vi.fn(),
});

const createInstance = (options?: {
	organizationHooks?:
		| Record<string, (data: never) => Promise<void>>
		| ((
				client: ReturnType<typeof createMockPolarClient>,
		  ) => Record<string, unknown>);
}) => {
	const mockClient = createMockPolarClient();

	vi.mocked(mockClient.customers.list).mockResolvedValue(
		emptyCustomerList as never,
	);
	vi.mocked(mockClient.customers.create).mockResolvedValue({
		id: "customer-1",
		externalId: null,
	} as never);
	vi.mocked(mockClient.customers.update).mockResolvedValue({
		id: "customer-1",
	} as never);

	const organizationHooks =
		typeof options?.organizationHooks === "function"
			? options.organizationHooks(mockClient)
			: options?.organizationHooks;

	const auth = betterAuth({
		baseURL: "http://localhost:3000",
		secret: "better-auth-secret-that-is-long-enough-for-tests",
		database: memoryAdapter({
			user: [],
			session: [],
			account: [],
			verification: [],
			organization: [],
			member: [],
			invitation: [],
		}),
		emailAndPassword: { enabled: true },
		plugins: [
			organization({
				organizationHooks,
			}),
			polar({
				client: mockClient,
				createCustomerOnSignUp: true,
				use: [checkout(), portal(), usage()],
			}),
		],
	});

	return { auth, mockClient };
};

const signUp = async (
	auth: ReturnType<typeof createInstance>["auth"],
	email: string,
	name = "Test User",
) => {
	const { headers, response } = await auth.api.signUpEmail({
		body: { email, password: "password-12345", name },
		returnHeaders: true,
	});

	const cookie = headers.get("set-cookie") ?? "";

	return {
		user: response.user,
		headers: new Headers({ cookie }),
	};
};

describe("better-auth wiring", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("customer lifecycle hooks", () => {
		it("creates and links a Polar customer on signup", async () => {
			const { auth, mockClient } = createInstance();

			vi.mocked(mockClient.customers.list)
				// before-hook lookup: no existing customer
				.mockResolvedValueOnce(emptyCustomerList as never)
				// after-hook lookup: the customer created in the before hook
				.mockResolvedValue(
					customerListWith({ id: "customer-1", externalId: null }) as never,
				);

			const { user } = await signUp(auth, "signup@example.com");

			expect(mockClient.customers.create).toHaveBeenCalledWith(
				expect.objectContaining({ email: "signup@example.com" }),
			);
			expect(mockClient.customers.update).toHaveBeenCalledWith({
				id: "customer-1",
				customerUpdate: { externalId: user.id },
			});
		});

		it("does not rebind a customer linked to another user", async () => {
			const { auth, mockClient } = createInstance();

			vi.mocked(mockClient.customers.list).mockResolvedValue(
				customerListWith({
					id: "customer-1",
					externalId: "someone-else",
				}) as never,
			);

			await signUp(auth, "collision@example.com");

			expect(mockClient.customers.create).not.toHaveBeenCalled();
			expect(mockClient.customers.update).not.toHaveBeenCalled();
		});
	});

	describe("endpoint mounting", () => {
		it("mounts sub-plugin endpoints on the auth API", async () => {
			const { auth } = createInstance();

			expect(auth.api).toHaveProperty("checkout");
			expect(auth.api).toHaveProperty("portal");
			expect(auth.api).toHaveProperty("state");
			expect(auth.api).toHaveProperty("benefits");
			expect(auth.api).toHaveProperty("subscriptions");
			expect(auth.api).toHaveProperty("orders");
			expect(auth.api).toHaveProperty("meters");
			expect(auth.api).toHaveProperty("ingestion");
		});

		it("serves /customer/state through the HTTP handler", async () => {
			const { auth, mockClient } = createInstance();
			const { headers } = await signUp(auth, "state@example.com");

			vi.mocked(mockClient.customers.getStateExternal).mockResolvedValue({
				id: "customer-1",
				activeSubscriptions: [],
			} as never);

			const response = await auth.handler(
				new Request("http://localhost:3000/api/auth/customer/state", {
					headers,
				}),
			);

			expect(response.status).toBe(200);
			const body = await response.json();
			expect(body).toMatchObject({ id: "customer-1" });
		});

		it("rejects /customer/state without a session", async () => {
			const { auth } = createInstance();

			const response = await auth.handler(
				new Request("http://localhost:3000/api/auth/customer/state"),
			);

			expect(response.status).toBe(401);
		});
	});

	describe("polarOrgHooks wired into the organization plugin", () => {
		it("creates a Polar team customer when an organization is created", async () => {
			const userAfterCreate = vi.fn().mockResolvedValue(undefined);
			const { auth, mockClient } = createInstance({
				organizationHooks: (client) =>
					polarOrgHooks({
						client,
						hooks: { afterCreateOrganization: userAfterCreate },
					}) as Record<string, unknown>,
			});

			const owner = await signUp(auth, "team-owner@example.com", "Team Owner");
			// The signup hooks call customers.create for the user's personal
			// customer — clear so the team assertion below is unambiguous.
			vi.mocked(mockClient.customers.create).mockClear();

			const org = await auth.api.createOrganization({
				body: { name: "Acme Team", slug: "acme-team" },
				headers: owner.headers,
			});

			if (!org) throw new Error("organization creation failed");

			expect(mockClient.customers.create).toHaveBeenCalledWith({
				type: "team",
				name: "Acme Team",
				externalId: org.id,
				owner: {
					email: "team-owner@example.com",
					name: "Team Owner",
					externalId: owner.user.id,
				},
			});
			expect(userAfterCreate).toHaveBeenCalledTimes(1);
		});

		it("syncs the team customer name when the organization is updated", async () => {
			const { auth, mockClient } = createInstance({
				organizationHooks: (client) =>
					polarOrgHooks({ client }) as Record<string, unknown>,
			});

			const owner = await signUp(auth, "rename-owner@example.com");
			const org = await auth.api.createOrganization({
				body: { name: "Before", slug: "rename-org" },
				headers: owner.headers,
			});

			if (!org) throw new Error("organization creation failed");

			await auth.api.updateOrganization({
				body: {
					organizationId: org.id,
					data: { name: "After" },
				},
				headers: owner.headers,
			});

			expect(mockClient.customers.updateExternal).toHaveBeenCalledWith({
				externalId: org.id,
				customerUpdateExternalID: { name: "After" },
			});
		});

		it("does not block organization creation when Polar is down", async () => {
			const onSyncError = vi.fn();
			const { auth, mockClient } = createInstance({
				organizationHooks: (client) => {
					vi.mocked(client.customers.create).mockRejectedValue(
						new Error("polar down"),
					);
					return polarOrgHooks({
						client,
						onSyncError,
					}) as Record<string, unknown>;
				},
			});

			// Signup's before-hook also uses customers.create — allow it.
			vi.mocked(mockClient.customers.list).mockResolvedValue({
				result: {
					items: [{ id: "customer-1", externalId: null }],
					pagination: { totalCount: 1, maxPage: 1 },
				},
				next: vi.fn(),
				[Symbol.asyncIterator]: vi.fn(),
			} as never);

			const owner = await signUp(auth, "resilient-owner@example.com");
			const org = await auth.api.createOrganization({
				body: { name: "Resilient", slug: "resilient-org" },
				headers: owner.headers,
			});

			expect(org).toBeTruthy();
			expect(onSyncError).toHaveBeenCalledWith(expect.any(Error), {
				hook: "afterCreateOrganization",
				organizationId: org?.id,
			});
		});

		it("mirrors the full roster lifecycle: invite-accept, role change, removal", async () => {
			const { auth, mockClient } = createInstance({
				organizationHooks: (client) =>
					polarOrgHooks({ client }) as Record<string, unknown>,
			});

			// No mirrored member exists yet for any lookup
			vi.mocked(mockClient.customers.members.getExternal).mockRejectedValue(
				Object.assign(new Error("not found"), { name: "ResourceNotFound" }),
			);

			const owner = await signUp(auth, "roster-owner@example.com");
			const org = await auth.api.createOrganization({
				body: { name: "Roster Org", slug: "roster-org" },
				headers: owner.headers,
			});

			if (!org) throw new Error("organization creation failed");

			// Clear creator double-fire; dedupe is covered by the unit test
			vi.mocked(mockClient.customers.members.createExternal).mockClear();

			// Invitation → afterAcceptInvitation → member mirror
			const invitee = await signUp(
				auth,
				"roster-invitee@example.com",
				"Roster Invitee",
			);
			const invitation = await auth.api.createInvitation({
				body: {
					email: "roster-invitee@example.com",
					role: "member",
					organizationId: org.id,
				},
				headers: owner.headers,
			});
			await auth.api.acceptInvitation({
				body: { invitationId: invitation.id },
				headers: invitee.headers,
			});

			expect(mockClient.customers.members.createExternal).toHaveBeenCalledWith({
				externalId: org.id,
				memberCreateFromCustomer: {
					email: "roster-invitee@example.com",
					name: "Roster Invitee",
					externalId: invitee.user.id,
					role: "member",
				},
			});

			// Role change → role update on the mirror
			const members = await auth.api.listMembers({
				query: { organizationId: org.id },
				headers: owner.headers,
			});
			const inviteeMember = members.members.find(
				(m: { userId: string }) => m.userId === invitee.user.id,
			);
			if (!inviteeMember) throw new Error("invitee member not found");

			await auth.api.updateMemberRole({
				body: {
					memberId: inviteeMember.id,
					organizationId: org.id,
					role: "admin",
				},
				headers: owner.headers,
			});

			expect(mockClient.customers.members.updateExternal).toHaveBeenCalledWith({
				externalId: org.id,
				memberExternalId: invitee.user.id,
				memberUpdate: { role: "billing_manager" },
			});

			// Removal → mirror deleted
			await auth.api.removeMember({
				body: {
					memberIdOrEmail: "roster-invitee@example.com",
					organizationId: org.id,
				},
				headers: owner.headers,
			});

			expect(mockClient.customers.members.deleteExternal).toHaveBeenCalledWith({
				externalId: org.id,
				memberExternalId: invitee.user.id,
			});
		});
	});

	describe("org-aware endpoints", () => {
		const setupOrg = async () => {
			const { auth, mockClient } = createInstance({
				organizationHooks: (client) =>
					polarOrgHooks({ client }) as Record<string, unknown>,
			});

			// Roster-sync lookups: no mirror exists
			vi.mocked(mockClient.customers.members.getExternal).mockRejectedValue(
				Object.assign(new Error("nf"), { name: "ResourceNotFound" }),
			);

			const owner = await signUp(auth, "org-billing-owner@example.com");
			const org = await auth.api.createOrganization({
				body: { name: "Billing Org", slug: "billing-org" },
				headers: owner.headers,
			});

			if (!org) throw new Error("organization creation failed");

			const member = await signUp(auth, "org-billing-member@example.com");
			await auth.api.addMember({
				body: {
					userId: member.user.id,
					organizationId: org.id,
					role: "member",
				},
			});

			const outsider = await signUp(auth, "org-outsider@example.com");

			return { auth, mockClient, owner, member, outsider, org };
		};

		it("scopes /customer/state to the organization for members", async () => {
			const { auth, mockClient, member, org } = await setupOrg();

			vi.mocked(mockClient.customers.getStateExternal).mockResolvedValue({
				id: "team-customer",
			} as never);

			const response = await auth.handler(
				new Request(
					`http://localhost:3000/api/auth/customer/state?organizationId=${org.id}`,
					{ headers: member.headers },
				),
			);

			expect(response.status).toBe(200);
			expect(mockClient.customers.getStateExternal).toHaveBeenCalledWith({
				externalId: org.id,
			});
		});

		it("rejects organization scope for non-members", async () => {
			const { auth, outsider, org } = await setupOrg();

			const response = await auth.handler(
				new Request(
					`http://localhost:3000/api/auth/customer/state?organizationId=${org.id}`,
					{ headers: outsider.headers },
				),
			);

			expect(response.status).toBe(403);
		});

		it("creates a team checkout for the owner", async () => {
			const { auth, mockClient, owner, org } = await setupOrg();

			// Team customer exists (self-repair not needed)
			vi.mocked(mockClient.customers.getExternal).mockResolvedValue({
				id: "team-customer",
				type: "team",
			} as never);
			vi.mocked(mockClient.checkouts.create).mockResolvedValue({
				url: "https://polar.sh/checkout/123",
			} as never);

			const result = await auth.api.checkout({
				body: { products: ["prod-1"], organizationId: org.id },
				headers: owner.headers,
			});

			expect(result).toMatchObject({
				url: expect.stringContaining("polar.sh"),
			});
			expect(mockClient.checkouts.create).toHaveBeenCalledWith(
				expect.objectContaining({ externalCustomerId: org.id }),
			);
		});

		it("blocks plain members from team checkout", async () => {
			const { auth, mockClient, member, org } = await setupOrg();

			await expect(
				auth.api.checkout({
					body: { products: ["prod-1"], organizationId: org.id },
					headers: member.headers,
				}),
			).rejects.toMatchObject({
				body: {
					message:
						"You must be an owner or billing manager of this organization",
				},
			});

			expect(mockClient.checkouts.create).not.toHaveBeenCalled();
		});

		it("repairs a missing team customer before checkout", async () => {
			const { auth, mockClient, owner, org } = await setupOrg();

			vi.mocked(mockClient.customers.getExternal).mockRejectedValue(
				Object.assign(new Error("nf"), { name: "ResourceNotFound" }),
			);
			vi.mocked(mockClient.customers.create).mockClear();
			vi.mocked(mockClient.checkouts.create).mockResolvedValue({
				url: "https://polar.sh/checkout/123",
			} as never);

			await auth.api.checkout({
				body: { products: ["prod-1"], organizationId: org.id },
				headers: owner.headers,
			});

			expect(mockClient.customers.create).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "team",
					externalId: org.id,
					name: "Billing Org",
				}),
			);
		});

		it("opens the portal as a member session for organization scope", async () => {
			const { auth, mockClient, member, org } = await setupOrg();

			vi.mocked(mockClient.customerSessions.create).mockResolvedValue({
				token: "mst-token",
				customerPortalUrl: "https://polar.sh/portal/session",
			} as never);

			const response = await auth.handler(
				new Request(
					`http://localhost:3000/api/auth/customer/portal?organizationId=${org.id}`,
					{ headers: member.headers },
				),
			);

			expect(response.status).toBe(200);
			expect(mockClient.customerSessions.create).toHaveBeenCalledWith({
				externalCustomerId: org.id,
				externalMemberId: member.user.id,
				returnUrl: undefined,
			});
		});
	});
});
