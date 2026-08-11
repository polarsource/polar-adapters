import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultMapRole, polarOrgHooks } from "../org-hooks";
import { createMockPolarClient } from "./utils/mocks";

const memberList = (items: Array<Record<string, unknown>>) => ({
	result: {
		items,
		pagination: { totalCount: items.length, maxPage: 1 },
	},
	next: vi.fn(),
	[Symbol.asyncIterator]: vi.fn(),
});

const organization = {
	id: "org-123",
	name: "Acme",
	slug: "acme",
	createdAt: new Date(),
};

const user = {
	id: "user-123",
	name: "Owner User",
	email: "owner@example.com",
	emailVerified: true,
	createdAt: new Date(),
	updatedAt: new Date(),
};

const member = {
	id: "member-123",
	organizationId: "org-123",
	userId: "user-123",
	role: "owner",
	createdAt: new Date(),
};

describe("polarOrgHooks", () => {
	let mockClient: ReturnType<typeof createMockPolarClient>;

	beforeEach(() => {
		mockClient = createMockPolarClient();
		vi.clearAllMocks();
	});

	describe("afterCreateOrganization", () => {
		it("creates a Polar team customer with the creator as owner", async () => {
			const hooks = polarOrgHooks({ client: mockClient });

			await hooks.afterCreateOrganization?.({ organization, member, user });

			expect(mockClient.customers.create).toHaveBeenCalledWith({
				type: "team",
				name: "Acme",
				externalId: "org-123",
				owner: {
					email: "owner@example.com",
					name: "Owner User",
					externalId: "user-123",
				},
			});
		});

		it("merges getTeamCustomerCreateParams", async () => {
			const getTeamCustomerCreateParams = vi
				.fn()
				.mockResolvedValue({ metadata: { plan: "starter" } });
			const hooks = polarOrgHooks({
				client: mockClient,
				getTeamCustomerCreateParams,
			});

			await hooks.afterCreateOrganization?.({ organization, member, user });

			expect(getTeamCustomerCreateParams).toHaveBeenCalledWith({
				organization,
				user,
			});
			expect(mockClient.customers.create).toHaveBeenCalledWith(
				expect.objectContaining({ metadata: { plan: "starter" } }),
			);
		});

		it("reports sync failures without throwing", async () => {
			vi.mocked(mockClient.customers.create).mockRejectedValue(
				new Error("polar down"),
			);
			const onSyncError = vi.fn();
			const hooks = polarOrgHooks({ client: mockClient, onSyncError });

			await expect(
				hooks.afterCreateOrganization?.({ organization, member, user }),
			).resolves.toBeUndefined();

			expect(onSyncError).toHaveBeenCalledWith(expect.any(Error), {
				hook: "afterCreateOrganization",
				organizationId: "org-123",
			});
		});

		it("runs the user's own hook after the sync with the same data", async () => {
			const order: string[] = [];
			vi.mocked(mockClient.customers.create).mockImplementation(async () => {
				order.push("sync");
				return {} as never;
			});
			const userHook = vi.fn().mockImplementation(async () => {
				order.push("user");
			});

			const hooks = polarOrgHooks({
				client: mockClient,
				hooks: { afterCreateOrganization: userHook },
			});

			await hooks.afterCreateOrganization?.({ organization, member, user });

			expect(userHook).toHaveBeenCalledWith({ organization, member, user });
			expect(order).toEqual(["sync", "user"]);
		});

		it("still runs the user's hook when the sync fails", async () => {
			vi.mocked(mockClient.customers.create).mockRejectedValue(
				new Error("polar down"),
			);
			const userHook = vi.fn();

			const hooks = polarOrgHooks({
				client: mockClient,
				onSyncError: vi.fn(),
				hooks: { afterCreateOrganization: userHook },
			});

			await hooks.afterCreateOrganization?.({ organization, member, user });

			expect(userHook).toHaveBeenCalled();
		});
	});

	describe("afterUpdateOrganization", () => {
		it("syncs the organization name to the team customer", async () => {
			const hooks = polarOrgHooks({ client: mockClient });

			await hooks.afterUpdateOrganization?.({
				organization: { ...organization, name: "Acme Renamed" },
				member,
				user,
			});

			expect(mockClient.customers.updateExternal).toHaveBeenCalledWith({
				externalId: "org-123",
				customerUpdateExternalID: { name: "Acme Renamed" },
			});
		});

		it("skips the sync when the adapter returns no organization", async () => {
			const hooks = polarOrgHooks({ client: mockClient });

			await hooks.afterUpdateOrganization?.({
				organization: null,
				member,
				user,
			});

			expect(mockClient.customers.updateExternal).not.toHaveBeenCalled();
		});
	});

	it("passes through hooks it does not implement", () => {
		const beforeCreateOrganization = vi.fn();
		const hooks = polarOrgHooks({
			client: mockClient,
			hooks: { beforeCreateOrganization },
		});

		expect(hooks.beforeCreateOrganization).toBe(beforeCreateOrganization);
	});

	describe("roster sync", () => {
		const notFound = () =>
			Object.assign(new Error("not found"), { name: "ResourceNotFound" });

		const newUser = {
			...user,
			id: "user-456",
			email: "new-member@example.com",
			name: "New Member",
		};
		const newMember = {
			...member,
			id: "member-456",
			userId: "user-456",
			role: "member",
		};

		beforeEach(() => {
			// Default: no mirror exists yet
			vi.mocked(mockClient.customers.members.getExternal).mockRejectedValue(
				notFound(),
			);
		});

		describe("afterAddMember / afterAcceptInvitation", () => {
			it.each(["afterAddMember", "afterAcceptInvitation"] as const)(
				"%s creates a Polar member with mapped role and external ids",
				async (hookName) => {
					const hooks = polarOrgHooks({ client: mockClient });

					await hooks[hookName]?.({
						organization,
						member: newMember,
						user: newUser,
						invitation: {} as never,
					} as never);

					expect(
						mockClient.customers.members.createExternal,
					).toHaveBeenCalledWith({
						externalId: "org-123",
						memberCreateFromCustomer: {
							email: "new-member@example.com",
							name: "New Member",
							externalId: "user-456",
							role: "member",
						},
					});
				},
			);

			it("maps admin to billing_manager", async () => {
				const hooks = polarOrgHooks({ client: mockClient });

				await hooks.afterAddMember?.({
					organization,
					member: { ...newMember, role: "admin" },
					user: newUser,
				} as never);

				expect(
					mockClient.customers.members.createExternal,
				).toHaveBeenCalledWith(
					expect.objectContaining({
						memberCreateFromCustomer: expect.objectContaining({
							role: "billing_manager",
						}),
					}),
				);
			});

			it("adds additional better-auth owners as billing managers", async () => {
				const hooks = polarOrgHooks({ client: mockClient });

				await hooks.afterAddMember?.({
					organization,
					member: { ...newMember, role: "owner" },
					user: newUser,
				} as never);

				expect(
					mockClient.customers.members.createExternal,
				).toHaveBeenCalledWith(
					expect.objectContaining({
						memberCreateFromCustomer: expect.objectContaining({
							role: "billing_manager",
						}),
					}),
				);
			});

			it("skips creation when the mirror already exists (org-creation double fire)", async () => {
				vi.mocked(mockClient.customers.members.getExternal).mockResolvedValue({
					id: "pm-1",
					externalId: "user-456",
					role: "owner",
				} as never);

				const hooks = polarOrgHooks({ client: mockClient });

				await hooks.afterAddMember?.({
					organization,
					member: { ...newMember, role: "owner" },
					user: newUser,
				} as never);

				expect(
					mockClient.customers.members.createExternal,
				).not.toHaveBeenCalled();
			});

			it("reports sync errors without throwing and still runs the user hook", async () => {
				vi.mocked(mockClient.customers.members.getExternal).mockRejectedValue(
					new Error("polar down"),
				);
				const onSyncError = vi.fn();
				const userHook = vi.fn();

				const hooks = polarOrgHooks({
					client: mockClient,
					onSyncError,
					hooks: { afterAddMember: userHook },
				});

				await hooks.afterAddMember?.({
					organization,
					member: newMember,
					user: newUser,
				} as never);

				expect(onSyncError).toHaveBeenCalledWith(expect.any(Error), {
					hook: "afterAddMember",
					organizationId: "org-123",
				});
				expect(userHook).toHaveBeenCalled();
			});
		});

		describe("afterRemoveMember", () => {
			it("deletes the mirrored Polar member by external ids", async () => {
				const hooks = polarOrgHooks({ client: mockClient });

				await hooks.afterRemoveMember?.({
					organization,
					member: newMember,
					user: newUser,
				} as never);

				expect(
					mockClient.customers.members.deleteExternal,
				).toHaveBeenCalledWith({
					externalId: "org-123",
					memberExternalId: "user-456",
				});
			});

			it("treats a missing mirror as success", async () => {
				vi.mocked(
					mockClient.customers.members.deleteExternal,
				).mockRejectedValue(notFound());
				const onSyncError = vi.fn();

				const hooks = polarOrgHooks({ client: mockClient, onSyncError });

				await hooks.afterRemoveMember?.({
					organization,
					member: newMember,
					user: newUser,
				} as never);

				expect(onSyncError).not.toHaveBeenCalled();
			});
		});

		describe("afterUpdateMemberRole", () => {
			it("updates the mirrored member's role by external ids", async () => {
				const hooks = polarOrgHooks({ client: mockClient });

				await hooks.afterUpdateMemberRole?.({
					organization,
					member: { ...newMember, role: "admin" },
					previousRole: "member",
					user: newUser,
				} as never);

				expect(
					mockClient.customers.members.updateExternal,
				).toHaveBeenCalledWith({
					externalId: "org-123",
					memberExternalId: "user-456",
					memberUpdate: { role: "billing_manager" },
				});
			});

			it("maps an explicit owner update through as ownership transfer", async () => {
				const hooks = polarOrgHooks({ client: mockClient });

				await hooks.afterUpdateMemberRole?.({
					organization,
					member: { ...newMember, role: "owner" },
					previousRole: "member",
					user: newUser,
				} as never);

				expect(
					mockClient.customers.members.updateExternal,
				).toHaveBeenCalledWith(
					expect.objectContaining({ memberUpdate: { role: "owner" } }),
				);
			});

			it("treats a missing mirror as nothing to sync", async () => {
				vi.mocked(
					mockClient.customers.members.updateExternal,
				).mockRejectedValue(notFound());
				const onSyncError = vi.fn();

				const hooks = polarOrgHooks({ client: mockClient, onSyncError });

				await hooks.afterUpdateMemberRole?.({
					organization,
					member: newMember,
					previousRole: "member",
					user: newUser,
				} as never);

				expect(onSyncError).not.toHaveBeenCalled();
			});
		});
	});
});

describe("defaultMapRole", () => {
	it("maps the built-in roles", () => {
		expect(defaultMapRole("owner")).toBe("owner");
		expect(defaultMapRole("admin")).toBe("billing_manager");
		expect(defaultMapRole("member")).toBe("member");
	});

	it("resolves multi-role strings to the highest role", () => {
		expect(defaultMapRole("member,owner")).toBe("owner");
		expect(defaultMapRole("admin, member")).toBe("billing_manager");
	});

	it("maps unknown/custom roles to member", () => {
		expect(defaultMapRole("auditor")).toBe("member");
	});
});
