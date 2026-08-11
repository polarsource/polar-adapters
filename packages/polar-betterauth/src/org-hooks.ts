import type { Polar } from "@polar-sh/sdk";
import type { OrganizationOptions } from "better-auth/plugins";

type OrganizationHooks = NonNullable<OrganizationOptions["organizationHooks"]>;

type AfterCreateOrganizationData = Parameters<
	NonNullable<OrganizationHooks["afterCreateOrganization"]>
>[0];

type MembershipData = {
	member: { role: string };
	user: {
		id: string;
		email: string;
		name?: string | null;
	};
	organization: { id: string };
};

export type PolarMemberRole = "owner" | "billing_manager" | "member";

export const defaultMapRole = (role: string): PolarMemberRole => {
	const roles = role.split(",").map((r) => r.trim());

	if (roles.includes("owner")) {
		return "owner";
	}

	if (roles.includes("admin")) {
		return "billing_manager";
	}

	return "member";
};

export const ensureMemberMirror = async (
	client: Polar,
	organizationId: string,
	user: { id: string; email: string; name?: string | null },
	role: string,
): Promise<void> => {
	try {
		await client.customers.members.getExternal({
			externalId: organizationId,
			memberExternalId: user.id,
		});

		return;
	} catch (e: unknown) {
		if (!(e instanceof Error && e.name === "ResourceNotFound")) {
			throw e;
		}
	}

	const mapped = defaultMapRole(role);

	await client.customers.members.createExternal({
		externalId: organizationId,
		memberCreateFromCustomer: {
			email: user.email,
			name: user.name ?? undefined,
			externalId: user.id,
			// Polar allows one owner (the creator); extra owners → billing_manager
			role: mapped === "owner" ? "billing_manager" : mapped,
		},
	});
};

export interface PolarOrgHooksOptions {
	client: Polar;
	/**
	 * Extra params for the Polar team customer created for a new organization.
	 */
	getTeamCustomerCreateParams?: (data: {
		organization: AfterCreateOrganizationData["organization"];
		user: AfterCreateOrganizationData["user"];
	}) => Promise<{
		metadata?: Record<string, string | number | boolean>;
	}>;
	/**
	 * Called when Polar sync fails. Failures never block the better-auth
	 * operation, defaults to console.error.
	 */
	onSyncError?: (
		error: unknown,
		context: { hook: string; organizationId: string },
	) => void | Promise<void>;
	/**
	 * Your own organization hooks, run after Polar sync.
	 */
	hooks?: OrganizationHooks;
}

/**
 * Mirror better-auth organizations to Polar team customers.
 *
 * Wire into the organization plugin — `polar()` cannot do this via
 * `databaseHooks` (org tables are outside that set):
 *
 * ```ts
 * organization({
 *   organizationHooks: polarOrgHooks({ client: polarClient }),
 * })
 * ```
 */
export const polarOrgHooks = (
	options: PolarOrgHooksOptions,
): OrganizationHooks => {
	const reportSyncError = async (
		hook: string,
		organizationId: string,
		error: unknown,
	) => {
		if (options.onSyncError) {
			await options.onSyncError(error, { hook, organizationId });
		} else {
			console.error(
				`[@polar-sh/better-auth] Polar sync failed in ${hook} for organization ${organizationId}:`,
				error,
			);
		}
	};

	const syncAddMember = async (hook: string, data: MembershipData) => {
		try {
			await ensureMemberMirror(
				options.client,
				data.organization.id,
				data.user,
				data.member.role,
			);
		} catch (e: unknown) {
			await reportSyncError(hook, data.organization.id, e);
		}
	};

	return {
		...options.hooks,
		afterCreateOrganization: async (data) => {
			try {
				const params = options.getTeamCustomerCreateParams
					? await options.getTeamCustomerCreateParams({
							organization: data.organization,
							user: data.user,
						})
					: {};

				await options.client.customers.create({
					...params,
					type: "team",
					name: data.organization.name,
					externalId: data.organization.id,
					owner: {
						email: data.user.email,
						name: data.user.name ?? undefined,
						externalId: data.user.id,
					},
				});
			} catch (e: unknown) {
				await reportSyncError(
					"afterCreateOrganization",
					data.organization.id,
					e,
				);
			}

			await options.hooks?.afterCreateOrganization?.(data);
		},
		afterUpdateOrganization: async (data) => {
			if (data.organization) {
				try {
					await options.client.customers.updateExternal({
						externalId: data.organization.id,
						customerUpdateExternalID: {
							name: data.organization.name,
						},
					});
				} catch (e: unknown) {
					await reportSyncError(
						"afterUpdateOrganization",
						data.organization.id,
						e,
					);
				}
			}

			await options.hooks?.afterUpdateOrganization?.(data);
		},
		// Invitation acceptance does not fire afterAddMember — hook both paths
		afterAddMember: async (data) => {
			await syncAddMember("afterAddMember", data);
			await options.hooks?.afterAddMember?.(data);
		},
		afterAcceptInvitation: async (data) => {
			await syncAddMember("afterAcceptInvitation", data);
			await options.hooks?.afterAcceptInvitation?.(data);
		},
		afterRemoveMember: async (data) => {
			try {
				await options.client.customers.members.deleteExternal({
					externalId: data.organization.id,
					memberExternalId: data.user.id,
				});
			} catch (e: unknown) {
				if (!(e instanceof Error && e.name === "ResourceNotFound")) {
					await reportSyncError("afterRemoveMember", data.organization.id, e);
				}
			}

			await options.hooks?.afterRemoveMember?.(data);
		},
		afterUpdateMemberRole: async (data) => {
			try {
				// Explicit update to owner is Polar's ownership transfer
				await options.client.customers.members.updateExternal({
					externalId: data.organization.id,
					memberExternalId: data.user.id,
					memberUpdate: { role: defaultMapRole(data.member.role) },
				});
			} catch (e: unknown) {
				if (!(e instanceof Error && e.name === "ResourceNotFound")) {
					await reportSyncError(
						"afterUpdateMemberRole",
						data.organization.id,
						e,
					);
				}
			}

			await options.hooks?.afterUpdateMemberRole?.(data);
		},
	};
};
