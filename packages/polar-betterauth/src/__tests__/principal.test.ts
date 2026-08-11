import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	type PrincipalContext,
	ensureTeamCustomer,
	isOrganizationMember,
	resolvePrincipal,
} from "../principal";
import { createMockPolarClient } from "./utils/mocks";

const makeCtx = (options?: {
	user?: { id: string; [key: string]: unknown } | null;
	member?: { role?: string } | null;
	organization?: { id: string; name: string } | null;
	roster?: Array<{ userId: string; role?: string }>;
	users?: Record<string, { id: string; email?: string; name?: string }>;
}): PrincipalContext => {
	const findOne = vi.fn(
		async ({
			model,
			where,
		}: {
			model: string;
			where: Array<{ field: string; value: unknown }>;
		}) => {
			if (model === "member") return options?.member ?? null;
			if (model === "organization") return options?.organization ?? null;
			if (model === "user") {
				const id = where.find((w) => w.field === "id")?.value as string;
				return options?.users?.[id] ?? null;
			}
			return null;
		},
	);
	const findMany = vi.fn(async () => options?.roster ?? []);

	return {
		context: {
			session:
				options?.user === null
					? null
					: { user: options?.user ?? { id: "user-123" } },
			adapter: { findOne, findMany },
			logger: { warn: vi.fn(), error: vi.fn() },
		},
	} as unknown as PrincipalContext;
};

describe("resolvePrincipal", () => {
	it("resolves the session user as a user principal", async () => {
		const principal = await resolvePrincipal(makeCtx());

		expect(principal).toEqual({
			kind: "user",
			externalCustomerId: "user-123",
			isAnonymous: false,
		});
	});

	it("flags anonymous users", async () => {
		const principal = await resolvePrincipal(
			makeCtx({ user: { id: "user-123", isAnonymous: true } }),
		);

		expect(principal.isAnonymous).toBe(true);
	});

	it("throws the historical BAD_REQUEST error without a session user", async () => {
		await expect(resolvePrincipal(makeCtx({ user: null }))).rejects.toThrow(
			"User not found",
		);
	});

	describe("team principals", () => {
		it("resolves a team principal for organization members", async () => {
			const principal = await resolvePrincipal(
				makeCtx({ member: { role: "member" } }),
				{ organizationId: "org-1" },
			);

			expect(principal).toEqual({
				kind: "team",
				externalCustomerId: "org-1",
				externalMemberId: "user-123",
				isAnonymous: false,
			});
		});

		it("rejects non-members with FORBIDDEN", async () => {
			await expect(
				resolvePrincipal(makeCtx({ member: null }), {
					organizationId: "org-1",
				}),
			).rejects.toThrow("You are not a member of this organization");
		});

		it("rejects plain members when a billing role is required", async () => {
			await expect(
				resolvePrincipal(makeCtx({ member: { role: "member" } }), {
					organizationId: "org-1",
					requireBillingRole: true,
				}),
			).rejects.toThrow(
				"You must be an owner or billing manager of this organization",
			);
		});

		it("allows owners and admins when a billing role is required", async () => {
			await expect(
				resolvePrincipal(makeCtx({ member: { role: "owner" } }), {
					organizationId: "org-1",
					requireBillingRole: true,
				}),
			).resolves.toMatchObject({ kind: "team" });

			await expect(
				resolvePrincipal(makeCtx({ member: { role: "admin" } }), {
					organizationId: "org-1",
					requireBillingRole: true,
				}),
			).resolves.toMatchObject({ kind: "team" });
		});

		it("denies organization access when the member model is unavailable", async () => {
			const ctx = makeCtx();
			ctx.context.adapter.findOne = vi
				.fn()
				.mockRejectedValue(new Error("no member model"));

			await expect(
				resolvePrincipal(ctx, { organizationId: "org-1" }),
			).rejects.toThrow("You are not a member of this organization");
		});
	});
});

describe("resolvePrincipal({ optional: true })", () => {
	it("returns null without a session user instead of throwing", async () => {
		await expect(
			resolvePrincipal(makeCtx({ user: null }), { optional: true }),
		).resolves.toBeNull();
	});

	it("requires authentication when an organization is requested", async () => {
		await expect(
			resolvePrincipal(makeCtx({ user: null }), {
				optional: true,
				organizationId: "org-1",
			}),
		).rejects.toThrow("You must be logged in to act for an organization");
	});

	it("resolves like the required path when a session user exists", async () => {
		await expect(
			resolvePrincipal(makeCtx(), { optional: true }),
		).resolves.toEqual({
			kind: "user",
			externalCustomerId: "user-123",
			isAnonymous: false,
		});
	});
});

describe("isOrganizationMember", () => {
	it("reflects membership from the adapter", async () => {
		await expect(
			isOrganizationMember(makeCtx({ member: {} }), "org-1", "user-123"),
		).resolves.toBe(true);
		await expect(
			isOrganizationMember(makeCtx({ member: null }), "org-1", "user-123"),
		).resolves.toBe(false);
	});
});

describe("ensureTeamCustomer", () => {
	let mockClient: ReturnType<typeof createMockPolarClient>;

	beforeEach(() => {
		mockClient = createMockPolarClient();
		vi.clearAllMocks();
	});

	it("does nothing when the team customer exists", async () => {
		vi.mocked(mockClient.customers.getExternal).mockResolvedValue({
			id: "c-1",
			type: "team",
		} as never);

		await ensureTeamCustomer(mockClient, makeCtx(), "org-1");

		expect(mockClient.customers.create).not.toHaveBeenCalled();
	});

	it("rejects when a non-team customer occupies the organization's id", async () => {
		vi.mocked(mockClient.customers.getExternal).mockResolvedValue({
			id: "c-1",
			type: "individual",
		} as never);

		await expect(
			ensureTeamCustomer(mockClient, makeCtx(), "org-1"),
		).rejects.toThrow("A non-team Polar customer already uses");

		expect(mockClient.customers.create).not.toHaveBeenCalled();
	});

	it("repairs a missing team customer seeded from the session user", async () => {
		vi.mocked(mockClient.customers.getExternal).mockRejectedValue(
			Object.assign(new Error("nf"), { name: "ResourceNotFound" }),
		);

		const ctx = makeCtx({
			user: { id: "user-123", email: "caller@example.com", name: "Caller" },
			organization: { id: "org-1", name: "Acme" },
		});

		await ensureTeamCustomer(mockClient, ctx, "org-1");

		expect(mockClient.customers.create).toHaveBeenCalledWith({
			type: "team",
			name: "Acme",
			externalId: "org-1",
			owner: {
				email: "caller@example.com",
				name: "Caller",
				externalId: "user-123",
			},
		});
	});

	it("treats a lost creation race as success", async () => {
		vi.mocked(mockClient.customers.getExternal)
			// initial check: not there yet
			.mockRejectedValueOnce(
				Object.assign(new Error("nf"), { name: "ResourceNotFound" }),
			)
			// re-check after the failed create: the race winner's customer
			.mockResolvedValueOnce({ id: "c-1", type: "team" } as never);
		vi.mocked(mockClient.customers.create).mockRejectedValue(
			new Error("external_id already exists"),
		);

		const ctx = makeCtx({
			user: { id: "user-123", email: "caller@example.com" },
			organization: { id: "org-1", name: "Acme" },
		});

		await expect(
			ensureTeamCustomer(mockClient, ctx, "org-1"),
		).resolves.toBeUndefined();
	});

	it("backfills the existing roster after repairing", async () => {
		vi.mocked(mockClient.customers.getExternal).mockRejectedValue(
			Object.assign(new Error("nf"), { name: "ResourceNotFound" }),
		);
		vi.mocked(mockClient.customers.members.getExternal)
			// the caller's mirror exists (created as the customer's owner)
			.mockResolvedValueOnce({} as never)
			// the admin's mirror does not
			.mockRejectedValueOnce(
				Object.assign(new Error("nf"), { name: "ResourceNotFound" }),
			);

		const ctx = makeCtx({
			user: { id: "user-123", email: "caller@example.com", name: "Caller" },
			organization: { id: "org-1", name: "Acme" },
			roster: [
				{ userId: "user-123", role: "owner" },
				{ userId: "user-456", role: "admin" },
			],
			users: {
				"user-123": {
					id: "user-123",
					email: "caller@example.com",
					name: "Caller",
				},
				"user-456": { id: "user-456", email: "admin@example.com", name: "A" },
			},
		});

		await ensureTeamCustomer(mockClient, ctx, "org-1");

		expect(mockClient.customers.members.createExternal).toHaveBeenCalledTimes(
			1,
		);
		expect(mockClient.customers.members.createExternal).toHaveBeenCalledWith({
			externalId: "org-1",
			memberCreateFromCustomer: {
				email: "admin@example.com",
				name: "A",
				externalId: "user-456",
				role: "billing_manager",
			},
		});
	});

	it("never fails the repair on roster backfill errors", async () => {
		vi.mocked(mockClient.customers.getExternal).mockRejectedValue(
			Object.assign(new Error("nf"), { name: "ResourceNotFound" }),
		);

		const ctx = makeCtx({
			user: { id: "user-123", email: "caller@example.com" },
			organization: { id: "org-1", name: "Acme" },
		});
		ctx.context.adapter.findMany = vi
			.fn()
			.mockRejectedValue(new Error("no member model"));

		await expect(
			ensureTeamCustomer(mockClient, ctx, "org-1"),
		).resolves.toBeUndefined();
		expect(ctx.context.logger.warn).toHaveBeenCalled();
	});

	it("propagates non-404 lookup failures", async () => {
		vi.mocked(mockClient.customers.getExternal).mockRejectedValue(
			new Error("polar down"),
		);

		await expect(
			ensureTeamCustomer(mockClient, makeCtx(), "org-1"),
		).rejects.toThrow("polar down");
	});

	it("fails when the organization does not exist", async () => {
		vi.mocked(mockClient.customers.getExternal).mockRejectedValue(
			Object.assign(new Error("nf"), { name: "ResourceNotFound" }),
		);

		await expect(
			ensureTeamCustomer(mockClient, makeCtx({ organization: null }), "org-1"),
		).rejects.toThrow("Organization not found");
	});
});
