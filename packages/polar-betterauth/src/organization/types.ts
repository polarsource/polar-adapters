import type { CustomerTeamCreate } from "@polar-sh/sdk/models/components/customerteamcreate.js";
import type { MemberRole } from "@polar-sh/sdk/models/components/memberrole.js";
import type { User } from "better-auth";
import type { Member, Organization } from "better-auth/plugins/organization";

export type PolarMemberRole = (typeof MemberRole)[keyof typeof MemberRole];
export type PolarNonOwnerMemberRole = Exclude<PolarMemberRole, "owner">;

type BetterAuthOrganizationUser = Pick<User, "id" | "email" | "name">;

export interface BetterAuthRoleMappingInput {
	/**
	 * Better Auth's raw role value. Multiple roles are comma-separated.
	 */
	role: string;
	/**
	 * Whether ownership reconciliation selected this member as Polar's sole owner.
	 */
	isCanonicalOwner: boolean;
}

export interface BetterAuthRoleMappingOptions {
	/**
	 * Better Auth role used to identify organization owners.
	 *
	 * @default "owner"
	 */
	creatorRole?: string;
	/**
	 * Better Auth roles that can manage billing in Polar.
	 *
	 * @default ["admin"]
	 */
	billingManagerRoles?: readonly string[];
}

export interface PolarOrganizationMemberRoleInput {
	/** Better Auth's raw, potentially comma-separated role value. */
	role: string;
	/** Parsed and de-duplicated Better Auth roles. */
	roles: readonly string[];
	organizationId: string;
	user: BetterAuthOrganizationUser;
}

export type BetterAuthOrganizationMemberMirror = Pick<
	Member,
	"id" | "organizationId" | "userId" | "role" | "createdAt"
> & {
	user: BetterAuthOrganizationUser;
};

export interface PolarOrganizationRoleSyncOptions
	extends BetterAuthRoleMappingOptions {
	mapMemberRole?: (
		data: PolarOrganizationMemberRoleInput,
	) => PolarNonOwnerMemberRole | Promise<PolarNonOwnerMemberRole>;
}

export type PolarOrganizationCustomerCreateParams = Omit<
	CustomerTeamCreate,
	"externalId" | "name" | "owner" | "type"
>;

export interface PolarOrganizationOptions {
	/**
	 * Enable Better Auth organization to Polar team-customer synchronization.
	 */
	enabled: boolean;
	/**
	 * Add optional Polar customer fields such as metadata or billing details.
	 * Identity fields are always supplied by the integration and cannot be
	 * overridden by this callback.
	 */
	getCustomerCreateParams?: (data: {
		organization: Organization & Record<string, unknown>;
		owner: User & Record<string, unknown>;
	}) => Promise<PolarOrganizationCustomerCreateParams>;
	/**
	 * Map non-canonical Better Auth members to a Polar billing role.
	 *
	 * Ownership is intentionally not exposed: the adapter alone selects Polar's
	 * single canonical owner. Return `member` or `billing_manager` only.
	 */
	mapMemberRole?: (
		data: PolarOrganizationMemberRoleInput,
	) => PolarNonOwnerMemberRole | Promise<PolarNonOwnerMemberRole>;
}
