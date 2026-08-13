import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
import type { Member as PolarMember } from "@polar-sh/sdk/models/components/member.js";
import type { MemberUpdate } from "@polar-sh/sdk/models/components/memberupdate.js";
import { HTTPValidationError } from "@polar-sh/sdk/models/errors/httpvalidationerror.js";
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound.js";
import type { Organization } from "better-auth/plugins/organization";
import type { PolarOrganizationAPI } from "./polar-api";
import {
	hasBetterAuthCreatorRole,
	mapBetterAuthRoleToPolar,
	parseBetterAuthRoles,
} from "./roles";
import type {
	BetterAuthOrganizationMemberMirror,
	PolarMemberRole,
	PolarNonOwnerMemberRole,
	PolarOrganizationOptions,
	PolarOrganizationRoleSyncOptions,
} from "./types";

type PolarOrganizationCustomerData = Parameters<
	NonNullable<PolarOrganizationOptions["getCustomerCreateParams"]>
>[0];

export class PolarOrganizationCustomerTypeError extends Error {
	constructor(externalCustomerId: string) {
		super(
			`Polar customer with external ID "${externalCustomerId}" is not a team customer`,
		);
		this.name = "PolarOrganizationCustomerTypeError";
	}
}

export class PolarOrganizationTeamCustomerNotFoundError extends Error {
	constructor(organizationId: string) {
		super(
			`Polar team customer with external ID "${organizationId}" was not found`,
		);
		this.name = "PolarOrganizationTeamCustomerNotFoundError";
	}
}

export class PolarOrganizationMemberExternalIdError extends Error {
	constructor(
		organizationId: string,
		expectedExternalId: string,
		actualExternalId: string | null,
	) {
		super(
			`Polar member in organization "${organizationId}" has external ID ${JSON.stringify(actualExternalId)}; expected "${expectedExternalId}"`,
		);
		this.name = "PolarOrganizationMemberExternalIdError";
	}
}

export class PolarOrganizationOwnerInvariantError extends Error {
	constructor(organizationId: string, detail: string) {
		super(
			`Cannot reconcile Polar owner for organization "${organizationId}": ${detail}`,
		);
		this.name = "PolarOrganizationOwnerInvariantError";
	}
}

export class PolarOrganizationMemberRoleMappingError extends Error {
	constructor(role: unknown) {
		super(
			`Polar organization member role mapper returned ${JSON.stringify(role)}; expected "member" or "billing_manager"`,
		);
		this.name = "PolarOrganizationMemberRoleMappingError";
	}
}

const assertTeamCustomer = (customer: Customer, externalCustomerId: string) => {
	if (customer.type !== "team") {
		throw new PolarOrganizationCustomerTypeError(externalCustomerId);
	}

	return customer;
};

const isExternalIdConflict = (error: unknown): boolean =>
	error instanceof HTTPValidationError &&
	Boolean(
		error.detail?.some(
			(detail) =>
				detail.loc.some(
					(value) => value === "external_id" || value === "externalId",
				) && detail.msg.toLowerCase().includes("already exists"),
		),
	);

const findTeamCustomer = async (
	api: PolarOrganizationAPI,
	externalCustomerId: string,
): Promise<Customer | null> => {
	try {
		return assertTeamCustomer(
			await api.getCustomerByExternalId(externalCustomerId),
			externalCustomerId,
		);
	} catch (error) {
		if (error instanceof ResourceNotFound) {
			return null;
		}
		throw error;
	}
};

const reconcileCustomerName = async (
	api: PolarOrganizationAPI,
	customer: Customer,
	organization: Organization,
) => {
	if (customer.name === organization.name) {
		return customer;
	}

	return assertTeamCustomer(
		await api.updateCustomerByExternalId(organization.id, {
			name: organization.name,
		}),
		organization.id,
	);
};

export const ensureTeamCustomer = async (
	api: PolarOrganizationAPI,
	organizationOptions: PolarOrganizationOptions,
	data: PolarOrganizationCustomerData,
) => {
	const existingCustomer = await findTeamCustomer(api, data.organization.id);
	if (existingCustomer) {
		return reconcileCustomerName(api, existingCustomer, data.organization);
	}

	const customParams = organizationOptions.getCustomerCreateParams
		? await organizationOptions.getCustomerCreateParams(data)
		: {};

	try {
		return assertTeamCustomer(
			await api.createTeamCustomer({
				...customParams,
				externalId: data.organization.id,
				name: data.organization.name,
				owner: {
					externalId: data.owner.id,
					email: data.owner.email,
					name: data.owner.name,
				},
			}),
			data.organization.id,
		);
	} catch (error) {
		if (!isExternalIdConflict(error)) {
			throw error;
		}

		const racedCustomer = await findTeamCustomer(api, data.organization.id);
		if (!racedCustomer) {
			throw error;
		}

		return reconcileCustomerName(api, racedCustomer, data.organization);
	}
};

export const updateTeamCustomer = async (
	api: PolarOrganizationAPI,
	organization: Organization & Record<string, unknown>,
) =>
	assertTeamCustomer(
		await api.updateCustomerByExternalId(organization.id, {
			name: organization.name,
		}),
		organization.id,
	);

const findMember = async (
	api: PolarOrganizationAPI,
	organizationId: string,
	externalMemberId: string,
): Promise<PolarMember | null> => {
	try {
		return await api.getMemberByExternalIds(organizationId, externalMemberId);
	} catch (error) {
		if (error instanceof ResourceNotFound) {
			return null;
		}
		throw error;
	}
};

const assertMemberExternalId = (
	member: PolarMember,
	organizationId: string,
	expectedExternalId: string,
): PolarMember => {
	if (member.externalId !== expectedExternalId) {
		throw new PolarOrganizationMemberExternalIdError(
			organizationId,
			expectedExternalId,
			member.externalId,
		);
	}
	return member;
};

const reconcileMember = async (
	api: PolarOrganizationAPI,
	organizationId: string,
	member: PolarMember,
	data: {
		user: BetterAuthOrganizationMemberMirror["user"];
		externalMemberId: string;
		role: PolarMemberRole;
		preserveCurrentOwner?: boolean;
	},
): Promise<PolarMember> => {
	assertMemberExternalId(member, organizationId, data.externalMemberId);

	const update: MemberUpdate = {};
	const desiredName = data.user.name ?? null;
	if (member.email !== data.user.email) update.email = data.user.email;
	if (member.name !== desiredName) update.name = desiredName;
	if (
		member.role !== data.role &&
		!(data.preserveCurrentOwner && member.role === "owner")
	) {
		update.role = data.role;
	}

	if (Object.keys(update).length === 0) return member;

	return assertMemberExternalId(
		await api.updateMemberByExternalIds(
			organizationId,
			data.externalMemberId,
			update,
		),
		organizationId,
		data.externalMemberId,
	);
};

const ensureMemberRecord = async (
	api: PolarOrganizationAPI,
	organizationId: string,
	member: BetterAuthOrganizationMemberMirror,
	role: PolarMemberRole,
	preserveCurrentOwner = false,
): Promise<PolarMember> => {
	const externalMemberId = member.userId;
	let polarMember = await findMember(api, organizationId, externalMemberId);

	if (!polarMember) {
		const createRole: PolarNonOwnerMemberRole =
			role === "owner" ? "billing_manager" : role;
		polarMember = await api.createMemberByExternalCustomerId(organizationId, {
			externalId: externalMemberId,
			email: member.user.email,
			name: member.user.name ?? null,
			role: createRole,
		});
	}

	// Polar's create path can be idempotent by email. It cannot repair an
	// absent/different external ID through MemberUpdate, so fail explicitly
	// rather than silently linking the wrong actor.
	assertMemberExternalId(polarMember, organizationId, externalMemberId);

	return reconcileMember(api, organizationId, polarMember, {
		user: member.user,
		externalMemberId,
		role,
		preserveCurrentOwner,
	});
};

const resolveNonOwnerRole = async (
	options: PolarOrganizationRoleSyncOptions,
	organizationId: string,
	member: BetterAuthOrganizationMemberMirror,
): Promise<PolarNonOwnerMemberRole> => {
	if (!options.mapMemberRole) {
		const role = mapBetterAuthRoleToPolar(
			{ role: member.role, isCanonicalOwner: false },
			options,
		);
		if (role === "owner") {
			throw new PolarOrganizationMemberRoleMappingError(role);
		}
		return role;
	}

	const role = await options.mapMemberRole({
		role: member.role,
		roles: parseBetterAuthRoles(member.role),
		organizationId,
		user: {
			id: member.userId,
			email: member.user.email,
			name: member.user.name,
		},
	});
	if (role !== "member" && role !== "billing_manager") {
		throw new PolarOrganizationMemberRoleMappingError(role);
	}
	return role;
};

const compareOwnerCandidates = (
	left: BetterAuthOrganizationMemberMirror,
	right: BetterAuthOrganizationMemberMirror,
): number => {
	const createdAtDifference =
		left.createdAt.getTime() - right.createdAt.getTime();
	if (createdAtDifference !== 0) return createdAtDifference;
	if (left.id < right.id) return -1;
	if (left.id > right.id) return 1;
	return 0;
};

/**
 * Reconcile Better Auth's potentially multi-owner roster to Polar's one owner.
 * A still-valid current Polar owner is retained; otherwise the earliest Better
 * Auth owner (then opaque membership ID) is promoted before anyone is demoted.
 */
export const reconcileOwner = async (
	api: PolarOrganizationAPI,
	options: PolarOrganizationRoleSyncOptions,
	data: {
		organizationId: string;
		members: readonly BetterAuthOrganizationMemberMirror[];
	},
) => {
	const customer = await findTeamCustomer(api, data.organizationId);
	if (!customer) {
		throw new PolarOrganizationTeamCustomerNotFoundError(data.organizationId);
	}

	const creatorRole = options.creatorRole ?? "owner";
	const ownerCandidates = data.members
		.filter((member) => hasBetterAuthCreatorRole(member.role, creatorRole))
		.sort(compareOwnerCandidates);
	if (ownerCandidates.length === 0) {
		throw new PolarOrganizationOwnerInvariantError(
			data.organizationId,
			`Better Auth has no member with creator role "${creatorRole}"`,
		);
	}

	const polarOwners = (
		await api.listMembersByExternalCustomerId(data.organizationId, {
			role: "owner",
			limit: 100,
		})
	).result.items;
	if (polarOwners.length > 1) {
		throw new PolarOrganizationOwnerInvariantError(
			data.organizationId,
			"Polar returned more than one owner",
		);
	}

	const currentOwner = polarOwners[0];
	const retainedOwner = currentOwner?.externalId
		? ownerCandidates.find(
				(candidate) => candidate.userId === currentOwner.externalId,
			)
		: undefined;
	const canonicalOwner = retainedOwner ?? ownerCandidates[0];
	if (!canonicalOwner) {
		throw new PolarOrganizationOwnerInvariantError(
			data.organizationId,
			"the canonical owner candidate disappeared",
		);
	}

	// Resolve each non-owner mapping once. The canonical member uses a temporary
	// billing-manager role only if it must be created; custom mapping applies
	// exclusively to non-canonical members.
	const nonOwnerRoles = new Map<string, PolarNonOwnerMemberRole>();
	for (const member of data.members) {
		nonOwnerRoles.set(
			member.userId,
			member.userId === canonicalOwner.userId
				? "billing_manager"
				: await resolveNonOwnerRole(options, data.organizationId, member),
		);
	}

	// First ensure every current Better Auth member exists and has fresh profile
	// data. Existing owners are never demoted during this phase.
	const mirrors = new Map<string, PolarMember>();
	for (const member of data.members) {
		const role = nonOwnerRoles.get(member.userId);
		if (!role) {
			throw new PolarOrganizationOwnerInvariantError(
				data.organizationId,
				`member "${member.userId}" has no resolved non-owner role`,
			);
		}
		mirrors.set(
			member.userId,
			await ensureMemberRecord(api, data.organizationId, member, role, true),
		);
	}

	let canonicalMirror = mirrors.get(canonicalOwner.userId);
	if (!canonicalMirror) {
		throw new PolarOrganizationOwnerInvariantError(
			data.organizationId,
			"the selected Better Auth owner could not be mirrored",
		);
	}
	if (canonicalMirror.role !== "owner") {
		canonicalMirror = assertMemberExternalId(
			await api.updateMemberByExternalIds(
				data.organizationId,
				canonicalOwner.userId,
				{ role: "owner" },
			),
			data.organizationId,
			canonicalOwner.userId,
		);
		mirrors.set(canonicalOwner.userId, canonicalMirror);
	}

	// Promotion automatically demotes the old Polar owner. Refetch and
	// reconcile everyone else so custom/default non-owner roles still win.
	for (const member of data.members) {
		const isCanonicalOwner = member.userId === canonicalOwner.userId;
		const role = isCanonicalOwner ? "owner" : nonOwnerRoles.get(member.userId);
		if (!role) {
			throw new PolarOrganizationOwnerInvariantError(
				data.organizationId,
				`member "${member.userId}" has no final role`,
			);
		}
		const latest = isCanonicalOwner
			? mirrors.get(member.userId)
			: await findMember(api, data.organizationId, member.userId);
		if (!latest) {
			throw new PolarOrganizationOwnerInvariantError(
				data.organizationId,
				`member "${member.userId}" disappeared during reconciliation`,
			);
		}
		mirrors.set(
			member.userId,
			await reconcileMember(api, data.organizationId, latest, {
				user: member.user,
				externalMemberId: member.userId,
				role,
			}),
		);
	}

	return {
		canonicalOwner,
		ownerTransferred: currentOwner?.externalId !== canonicalOwner.userId,
		members: mirrors,
	};
};

export const ensureMemberMirror = async (
	api: PolarOrganizationAPI,
	options: PolarOrganizationRoleSyncOptions,
	data: {
		organizationId: string;
		user: { id: string; email: string; name?: string | null };
		betterAuthRole: string;
		members: readonly BetterAuthOrganizationMemberMirror[];
		/** Only the initial creator hook may run before the team customer exists. */
		deferIfCustomerMissing?: boolean;
	},
): Promise<"deferred" | "synchronized"> => {
	const customer = await findTeamCustomer(api, data.organizationId);
	if (!customer) {
		if (data.deferIfCustomerMissing) return "deferred";
		throw new PolarOrganizationTeamCustomerNotFoundError(data.organizationId);
	}

	await reconcileOwner(api, options, {
		organizationId: data.organizationId,
		members: data.members,
	});
	return "synchronized";
};

export const updateMemberMirror = ensureMemberMirror;

export const removeMemberMirror = async (
	api: PolarOrganizationAPI,
	options: PolarOrganizationRoleSyncOptions,
	data: {
		organizationId: string;
		externalMemberId: string;
		members: readonly BetterAuthOrganizationMemberMirror[];
	},
) => {
	const remainingMembers = data.members.filter(
		(member) => member.userId !== data.externalMemberId,
	);
	await reconcileOwner(api, options, {
		organizationId: data.organizationId,
		members: remainingMembers,
	});

	try {
		await api.deleteMemberByExternalIds(
			data.organizationId,
			data.externalMemberId,
		);
		return "deleted" as const;
	} catch (error) {
		if (error instanceof ResourceNotFound) return "already-missing" as const;
		throw error;
	}
};
