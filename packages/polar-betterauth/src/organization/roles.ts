import type {
	BetterAuthRoleMappingInput,
	BetterAuthRoleMappingOptions,
	PolarMemberRole,
} from "./types";

export const DEFAULT_BETTER_AUTH_CREATOR_ROLE = "owner";
const DEFAULT_BILLING_MANAGER_ROLES = ["admin"] as const;

const POLAR_ROLE_RANK: Record<PolarMemberRole, number> = {
	member: 0,
	billing_manager: 1,
	owner: 2,
};

/**
 * Parse Better Auth's comma-separated member role representation.
 *
 * Role names remain case-sensitive because Better Auth custom roles are opaque
 * application identifiers.
 */
export const parseBetterAuthRoles = (role: string): readonly string[] => [
	...new Set(
		role
			.split(",")
			.map((value) => value.trim())
			.filter((value) => value.length > 0),
	),
];

export const hasBetterAuthCreatorRole = (
	role: string,
	creatorRole = DEFAULT_BETTER_AUTH_CREATOR_ROLE,
): boolean => parseBetterAuthRoles(role).includes(creatorRole);

/**
 * Map Better Auth organization roles to Polar's fixed member roles.
 *
 * Only the member selected by ownership reconciliation can become `owner`.
 * Additional Better Auth owners intentionally become billing managers because
 * Polar allows exactly one owner per customer.
 */
export const mapBetterAuthRoleToPolar = (
	input: BetterAuthRoleMappingInput,
	options: BetterAuthRoleMappingOptions = {},
): PolarMemberRole => {
	if (input.isCanonicalOwner) {
		return "owner";
	}

	const roles = new Set(parseBetterAuthRoles(input.role));
	const creatorRole = options.creatorRole ?? DEFAULT_BETTER_AUTH_CREATOR_ROLE;
	const billingManagerRoles =
		options.billingManagerRoles ?? DEFAULT_BILLING_MANAGER_ROLES;

	if (
		roles.has(creatorRole) ||
		billingManagerRoles.some((role) => roles.has(role))
	) {
		return "billing_manager";
	}

	return "member";
};

/**
 * Numeric rank used for deterministic comparisons. Ownership reconciliation,
 * rather than this rank, remains responsible for selecting Polar's sole owner.
 */
export const rankPolarMemberRole = (role: PolarMemberRole): number =>
	POLAR_ROLE_RANK[role];
