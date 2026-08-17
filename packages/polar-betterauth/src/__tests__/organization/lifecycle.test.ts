import type { AuthContext } from "better-auth";
import type { Member, Organization } from "better-auth/plugins/organization";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	ORGANIZATION_LEAVE_PATH,
	createOrganizationLifecycleHooks,
	synchronizeOrganizationLeave,
	synchronizeUserDeletionMemberships,
	synchronizeUserOrganizationProfiles,
} from "../../organization/lifecycle";
import {
	isTeamCustomerSynchronized,
	removeMemberMirror,
	updateMemberMirror,
} from "../../organization/sync";
import { createTestPolarOptions } from "../utils/helpers";
import { createMockPolarClient, createMockUser } from "../utils/mocks";

vi.mock("../../organization/sync", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../../organization/sync")>();
	return {
		...actual,
		isTeamCustomerSynchronized: vi.fn(),
		removeMemberMirror: vi.fn(),
		updateMemberMirror: vi.fn(),
	};
});

const organizations: Organization[] = [
	{
		id: "org-a",
		name: "Organization A",
		slug: "organization-a",
		logo: null,
		createdAt: new Date("2024-01-01"),
	},
	{
		id: "org-b",
		name: "Organization B",
		slug: "organization-b",
		logo: null,
		createdAt: new Date("2024-01-02"),
	},
];

const user = createMockUser({
	id: "user-1",
	email: "new@example.com",
	name: "New Name",
});
const successor = createMockUser({
	id: "user-2",
	email: "successor@example.com",
	name: "Successor",
});

const memberships: Member[] = [
	{
		id: "member-a",
		organizationId: "org-a",
		userId: user.id,
		role: "owner",
		createdAt: new Date("2024-01-01"),
	},
	{
		id: "member-b",
		organizationId: "org-b",
		userId: user.id,
		role: "admin",
		createdAt: new Date("2024-01-02"),
	},
	{
		id: "member-successor",
		organizationId: "org-a",
		userId: successor.id,
		role: "owner",
		createdAt: new Date("2024-01-03"),
	},
];

const createAuthContext = () => {
	const logger = {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
	};
	const adapter = {
		findOne: vi.fn(async ({ model, where }) => {
			if (model !== "organization") return null;
			const id = where.find(
				(item: { field: string }) => item.field === "id",
			)?.value;
			return (
				organizations.find((organization) => organization.id === id) ?? null
			);
		}),
		findMany: vi.fn(async ({ model, where }) => {
			if (model === "member") {
				const organizationId = where?.find(
					(item: { field: string }) => item.field === "organizationId",
				)?.value;
				const userId = where?.find(
					(item: { field: string }) => item.field === "userId",
				)?.value;
				return memberships.filter(
					(member) =>
						(!organizationId || member.organizationId === organizationId) &&
						(!userId || member.userId === userId),
				);
			}
			if (model === "user") {
				const ids = where[0].value as string[];
				return [user, successor].filter((candidate) =>
					ids.includes(candidate.id),
				);
			}
			return [];
		}),
	};
	const context = {
		adapter,
		logger,
		getPlugin: vi.fn().mockReturnValue({
			id: "organization",
			options: { creatorRole: "owner" },
		}),
	} as unknown as AuthContext;
	return { context, adapter, logger };
};

describe("organization lifecycle gaps", () => {
	let client: ReturnType<typeof createMockPolarClient>;

	beforeEach(() => {
		client = createMockPolarClient();
		vi.clearAllMocks();
		vi.mocked(isTeamCustomerSynchronized).mockResolvedValue(true);
		vi.mocked(updateMemberMirror).mockResolvedValue();
		vi.mocked(removeMemberMirror).mockResolvedValue();
	});

	it("synchronizes a profile across every organization concurrently", async () => {
		const { context } = createAuthContext();

		await synchronizeUserOrganizationProfiles(context, client, user);

		expect(updateMemberMirror).toHaveBeenCalledTimes(2);
		expect(vi.mocked(updateMemberMirror).mock.calls[0]?.[1]).toMatchObject({
			organizationId: "org-a",
			user,
		});
		expect(vi.mocked(updateMemberMirror).mock.calls[1]?.[1]).toMatchObject({
			organizationId: "org-b",
			user,
		});
	});

	it("cleans up self-leave exactly once and supplies the remaining owner roster", async () => {
		const { context } = createAuthContext();
		const options = createTestPolarOptions({
			client,
			organization: { enabled: true },
		});

		await synchronizeOrganizationLeave(options, {
			context: Object.assign(context, {
				returned: memberships[0],
			}),
		});

		expect(removeMemberMirror).toHaveBeenCalledOnce();
		expect(vi.mocked(removeMemberMirror).mock.calls[0]?.[2]).toMatchObject({
			organizationId: "org-a",
			externalMemberId: user.id,
			members: expect.arrayContaining([
				expect.objectContaining({
					userId: successor.id,
					role: "owner",
				}),
			]),
		});
	});

	it("matches only /organization/leave, not admin removal or deletion", () => {
		const deleteCustomer = vi.fn();
		Object.assign(client.customers, { delete: deleteCustomer });
		const hooks = createOrganizationLifecycleHooks(
			createTestPolarOptions({
				client,
				organization: { enabled: true },
			}),
		);
		const matcher = hooks?.after?.[0]?.matcher;

		expect(matcher?.({ path: ORGANIZATION_LEAVE_PATH } as never)).toBe(true);
		expect(matcher?.({ path: "/organization/remove-member" } as never)).toBe(
			false,
		);
		expect(matcher?.({ path: "/organization/delete" } as never)).toBe(false);
		expect(deleteCustomer).not.toHaveBeenCalled();
	});

	it("skips profile and deletion sync for existing unsynchronized organizations", async () => {
		const { context } = createAuthContext();
		vi.mocked(isTeamCustomerSynchronized).mockResolvedValue(false);

		await synchronizeUserOrganizationProfiles(context, client, user);
		await synchronizeUserDeletionMemberships(context, client, user);

		expect(updateMemberMirror).not.toHaveBeenCalled();
		expect(removeMemberMirror).not.toHaveBeenCalled();
	});

	it("uses the user delete before-state for every membership", async () => {
		const { context } = createAuthContext();

		await synchronizeUserDeletionMemberships(context, client, user);

		expect(removeMemberMirror).toHaveBeenCalledTimes(2);
		expect(
			vi.mocked(removeMemberMirror).mock.calls.map((call) => call[2]),
		).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					organizationId: "org-a",
					externalMemberId: user.id,
					members: [
						expect.objectContaining({ userId: user.id, role: "owner" }),
						expect.objectContaining({ userId: successor.id, role: "owner" }),
					],
				}),
				expect.objectContaining({
					organizationId: "org-b",
					externalMemberId: user.id,
					members: [
						expect.objectContaining({ userId: user.id, role: "admin" }),
					],
				}),
			]),
		);
	});
});
