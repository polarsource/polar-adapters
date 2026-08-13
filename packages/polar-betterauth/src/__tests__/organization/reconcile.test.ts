import type { CustomerTeam } from "@polar-sh/sdk/models/components/customerteam.js";
import type { Member as PolarMember } from "@polar-sh/sdk/models/components/member.js";
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound.js";
import type { AuthContext, User } from "better-auth";
import type { Member, Organization } from "better-auth/plugins/organization";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileOrganization } from "../../organization/reconcile";
import { createMockPolarClient, createMockUser } from "../utils/mocks";

const organization: Organization = {
	id: "org-1",
	name: "Acme",
	slug: "acme",
	logo: null,
	createdAt: new Date("2024-01-01"),
};
const owner = createMockUser({
	id: "user-owner",
	email: "owner@example.com",
	name: "Current Owner",
});
const memberUser = createMockUser({
	id: "user-member",
	email: "member@example.com",
	name: "Current Member",
});
const memberships: Member[] = [
	{
		id: "ba-owner",
		organizationId: organization.id,
		userId: owner.id,
		role: "owner",
		createdAt: new Date("2024-01-01"),
	},
	{
		id: "ba-member",
		organizationId: organization.id,
		userId: memberUser.id,
		role: "member",
		createdAt: new Date("2024-01-02"),
	},
];

const notFound = () =>
	new ResourceNotFound(
		{ error: "ResourceNotFound", detail: "Not found" },
		{
			response: new Response("", { status: 404 }),
			request: new Request("https://api.polar.sh/v1/customers"),
			body: "",
		},
	);

const teamCustomer = (name = organization.name): CustomerTeam => ({
	id: "polar-customer",
	createdAt: new Date(),
	modifiedAt: null,
	metadata: {},
	externalId: organization.id,
	email: null,
	emailVerified: false,
	type: "team",
	name,
	billingName: null,
	billingAddress: null,
	taxId: null,
	organizationId: "polar-org",
	deletedAt: null,
	avatarUrl: null,
});

const polarMember = (
	externalId: string,
	role: PolarMember["role"],
	overrides: Partial<PolarMember> = {},
): PolarMember => ({
	id: `polar-${externalId}`,
	createdAt: new Date(),
	modifiedAt: null,
	customerId: "polar-customer",
	externalId,
	email: `${externalId}@example.com`,
	name: externalId,
	role,
	...overrides,
});

const createAuthContext = (users: User[] = [owner, memberUser]) => {
	const logger = {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	};
	const adapter = {
		findOne: vi.fn(async ({ model }: { model: string }) =>
			model === "organization" ? organization : null,
		),
		findMany: vi.fn(
			async ({
				model,
				where,
			}: { model: string; where: { value: unknown }[] }) => {
				if (model === "member") return memberships;
				if (model === "user") {
					const ids = where[0]?.value as string[];
					return users.filter((user) => ids.includes(user.id));
				}
				return [];
			},
		),
	};
	return {
		context: {
			adapter,
			logger,
			getPlugin: vi.fn().mockReturnValue({
				id: "organization",
				options: { creatorRole: "owner" },
			}),
		} as unknown as AuthContext,
		logger,
	};
};

const createPolarState = (input: {
	customer: CustomerTeam | null;
	members: PolarMember[];
}) => {
	const client = createMockPolarClient();
	let customer = input.customer;
	const members = [...input.members];

	vi.mocked(client.customers.getExternal).mockImplementation(async () => {
		if (!customer) throw notFound();
		return customer;
	});
	vi.mocked(client.customers.create).mockImplementation(async (data) => {
		customer = teamCustomer(data.name);
		members.push(
			polarMember(data.owner.externalId, "owner", {
				email: data.owner.email,
				name: data.owner.name ?? null,
			}),
		);
		return customer;
	});
	vi.mocked(client.customers.updateExternal).mockImplementation(
		async ({ customerUpdateExternalID }) => {
			customer = teamCustomer(customerUpdateExternalID.name ?? customer?.name);
			return customer;
		},
	);
	vi.mocked(client.members.listMembers).mockImplementation(async (request) => {
		const filtered = request.role
			? members.filter((member) => member.role === request.role)
			: members;
		return {
			result: {
				items: [...filtered],
				pagination: { totalCount: filtered.length, maxPage: 1 },
			},
		} as never;
	});
	vi.mocked(client.customers.members.getExternal).mockImplementation(
		async ({ memberExternalId }) => {
			const member = members.find(
				(candidate) => candidate.externalId === memberExternalId,
			);
			if (!member) throw notFound();
			return { ...member };
		},
	);
	vi.mocked(client.customers.members.createExternal).mockImplementation(
		async ({ memberCreateFromCustomer }) => {
			const externalId = memberCreateFromCustomer.externalId;
			if (!externalId) throw new Error("Test member requires an external ID");
			const created = polarMember(
				externalId,
				memberCreateFromCustomer.role ?? "member",
				{
					email: memberCreateFromCustomer.email,
					name: memberCreateFromCustomer.name ?? null,
				},
			);
			members.push(created);
			return { ...created };
		},
	);
	vi.mocked(client.customers.members.updateExternal).mockImplementation(
		async ({ memberExternalId, memberUpdate }) => {
			const index = members.findIndex(
				(candidate) => candidate.externalId === memberExternalId,
			);
			if (index < 0) throw notFound();
			if (memberUpdate.role === "owner") {
				for (const existing of members) {
					if (existing.role === "owner") existing.role = "billing_manager";
				}
			}
			const existingMember = members[index];
			if (!existingMember) throw notFound();
			const updatedMember = { ...existingMember, ...memberUpdate };
			members[index] = updatedMember;
			return { ...updatedMember };
		},
	);
	vi.mocked(client.customers.members.deleteExternal).mockImplementation(
		async ({ memberExternalId }) => {
			const index = members.findIndex(
				(candidate) => candidate.externalId === memberExternalId,
			);
			if (index < 0) throw notFound();
			members.splice(index, 1);
		},
	);

	return { client, members };
};

describe("reconcileOrganization", () => {
	beforeEach(() => vi.clearAllMocks());

	it("creates a missing team customer and missing member records", async () => {
		const { context } = createAuthContext();
		const { client, members } = createPolarState({
			customer: null,
			members: [],
		});

		const summary = await reconcileOrganization({
			authContext: context,
			polarClient: client,
			organizationId: organization.id,
		});

		expect(summary).toMatchObject({
			customer: "created",
			members: { created: 2, updated: 0, deleted: 0, unchanged: 0 },
			ownerTransferred: false,
		});
		expect(members.find((item) => item.externalId === owner.id)?.role).toBe(
			"owner",
		);
		expect(
			members.find((item) => item.externalId === memberUser.id)?.role,
		).toBe("member");
	});

	it("does not write when the customer, profiles, roles, and owner are current", async () => {
		const { context } = createAuthContext();
		const { client } = createPolarState({
			customer: teamCustomer(),
			members: [
				polarMember(owner.id, "owner", {
					email: owner.email,
					name: owner.name,
				}),
				polarMember(memberUser.id, "member", {
					email: memberUser.email,
					name: memberUser.name,
				}),
			],
		});

		const summary = await reconcileOrganization({
			authContext: context,
			polarClient: client,
			organizationId: organization.id,
		});

		expect(summary.members).toEqual({
			created: 0,
			updated: 0,
			deleted: 0,
			unchanged: 2,
		});
		expect(client.customers.create).not.toHaveBeenCalled();
		expect(client.customers.updateExternal).not.toHaveBeenCalled();
		expect(client.customers.members.createExternal).not.toHaveBeenCalled();
		expect(client.customers.members.updateExternal).not.toHaveBeenCalled();
		expect(client.customers.members.deleteExternal).not.toHaveBeenCalled();
	});

	it("corrects profiles and roles, transfers ownership, and retains stale members by default", async () => {
		const { context } = createAuthContext();
		const staleOwner = polarMember("deleted-user", "owner");
		const { client, members } = createPolarState({
			customer: teamCustomer(),
			members: [
				staleOwner,
				polarMember(owner.id, "billing_manager", {
					email: "old-owner@example.com",
					name: "Old Owner",
				}),
				polarMember(memberUser.id, "billing_manager", {
					email: memberUser.email,
					name: "Old Member",
				}),
			],
		});

		const summary = await reconcileOrganization({
			authContext: context,
			polarClient: client,
			organizationId: organization.id,
		});

		expect(summary.ownerTransferred).toBe(true);
		expect(summary.members.updated).toBe(2);
		expect(summary.warnings).toEqual([
			"1 stale Polar member(s) were retained; pass deleteStaleMembers to remove them",
		]);
		expect(members.find((item) => item.externalId === owner.id)).toMatchObject({
			role: "owner",
			email: owner.email,
			name: owner.name,
		});
		expect(
			members.find((item) => item.externalId === memberUser.id),
		).toMatchObject({ role: "member", name: memberUser.name });
		expect(members.some((item) => item.externalId === "deleted-user")).toBe(
			true,
		);
	});

	it("optionally deletes stale members but never the customer", async () => {
		const { context } = createAuthContext();
		const { client, members } = createPolarState({
			customer: teamCustomer(),
			members: [
				polarMember(owner.id, "owner", {
					email: owner.email,
					name: owner.name,
				}),
				polarMember(memberUser.id, "member", {
					email: memberUser.email,
					name: memberUser.name,
				}),
				polarMember("stale-user", "member"),
			],
		});

		const deleteCustomer = vi.fn();
		Object.assign(client.customers, { delete: deleteCustomer });
		const summary = await reconcileOrganization({
			authContext: context,
			polarClient: client,
			organizationId: organization.id,
			deleteStaleMembers: true,
		});

		expect(summary.members.deleted).toBe(1);
		expect(members.some((item) => item.externalId === "stale-user")).toBe(
			false,
		);
		expect(deleteCustomer).not.toHaveBeenCalled();
	});

	it("logs context and propagates the original SDK failure", async () => {
		const { context, logger } = createAuthContext();
		const client = createMockPolarClient();
		const failure = new Error("Polar unavailable");
		vi.mocked(client.customers.getExternal).mockRejectedValue(failure);

		await expect(
			reconcileOrganization({
				authContext: context,
				polarClient: client,
				organizationId: organization.id,
			}),
		).rejects.toBe(failure);
		expect(logger.error).toHaveBeenCalledWith(
			expect.stringContaining(
				"operation=organization.reconcile organizationId=org-1 result=error",
			),
		);
	});
});
