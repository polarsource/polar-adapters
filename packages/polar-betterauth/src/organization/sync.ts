import type { Polar } from "@polar-sh/sdk";
import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
import type { Member as PolarMember } from "@polar-sh/sdk/models/components/member.js";
import { HTTPValidationError } from "@polar-sh/sdk/models/errors/httpvalidationerror.js";
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound.js";
import type { Organization } from "better-auth/plugins/organization";
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
	NonNullable<PolarOrganizationOptions["getTeamCustomerCreateParams"]>
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
			`Cannot synchronize Polar owner for organization "${organizationId}": ${detail}`,
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
	client: Polar,
	externalCustomerId: string,
): Promise<Customer | null> => {
	try {
		const customer = await client.customers.getExternal({
			externalId: externalCustomerId,
		});
		assertTeamCustomer(customer, externalCustomerId);
		return customer;
	} catch (error) {
		if (error instanceof ResourceNotFound) {
			return null;
		}
		throw error;
	}
};

export const ensureTeamCustomer = async (
	client: Polar,
	organizationOptions: PolarOrganizationOptions,
	data: PolarOrganizationCustomerData,
) => {
	const existingCustomer = await findTeamCustomer(client, data.organization.id);

	if (existingCustomer) {
		return;
	}

	const customParams = organizationOptions.getTeamCustomerCreateParams
		? await organizationOptions.getTeamCustomerCreateParams(data)
		: {};

	try {
		const customer = await client.customers.create({
			...customParams,
			externalId: data.organization.id,
			name: data.organization.name,
			owner: {
				externalId: data.owner.id,
				email: data.owner.email,
				name: data.owner.name,
			},
			type: "team",
		});

		assertTeamCustomer(customer, data.organization.id);
	} catch (error) {
		if (!isExternalIdConflict(error)) {
			throw error;
		}

		const racedCustomer = await findTeamCustomer(client, data.organization.id);
		if (!racedCustomer) {
			throw error;
		}
	}
};

export const updateTeamCustomer = async (
	client: Polar,
	organization: Organization & Record<string, unknown>,
) => {
	const updatedCustomer = await client.customers.updateExternal({
		externalId: organization.id,
		customerUpdateExternalID: { name: organization.name },
	});
	assertTeamCustomer(updatedCustomer, organization.id);
};

const findMember = async (
	client: Polar,
	organizationId: string,
	externalMemberId: string,
): Promise<PolarMember | null> => {
	try {
		return await client.customers.members.getExternal({
			externalId: organizationId,
			memberExternalId: externalMemberId,
		});
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
) => {
	if (member.externalId !== expectedExternalId) {
		throw new PolarOrganizationMemberExternalIdError(
			organizationId,
			expectedExternalId,
			member.externalId,
		);
	}
};

type MemberRoleData = Pick<
	BetterAuthOrganizationMemberMirror,
	"role" | "user" | "userId"
>;

const ensureMemberRecord = async (
	client: Polar,
	organizationId: string,
	member: MemberRoleData,
	role: PolarNonOwnerMemberRole,
): Promise<void> => {
	const existingMember = await findMember(
		client,
		organizationId,
		member.userId,
	);

	if (existingMember) {
		assertMemberExternalId(existingMember, organizationId, member.userId);
		return;
	}

	const createdMember = await client.customers.members.createExternal({
		externalId: organizationId,
		memberCreateFromCustomer: {
			externalId: member.userId,
			email: member.user.email,
			name: member.user.name ?? null,
			role,
		},
	});

	// Polar's create path can be idempotent by email. It cannot repair an
	// absent/different external ID through MemberUpdate, so fail explicitly
	// rather than silently linking the wrong actor.
	assertMemberExternalId(createdMember, organizationId, member.userId);
};

const resolveNonOwnerRole = async (
	options: PolarOrganizationRoleSyncOptions,
	organizationId: string,
	member: MemberRoleData,
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

const updateMemberRole = async (
	client: Polar,
	organizationId: string,
	externalMemberId: string,
	role: PolarMemberRole,
) => {
	const updatedMember = await client.customers.members.updateExternal({
		externalId: organizationId,
		memberExternalId: externalMemberId,
		memberUpdate: { role },
	});
	assertMemberExternalId(updatedMember, organizationId, externalMemberId);
};

/** Transfer ownership only when the current Polar owner is no longer a Better Auth owner. */
const syncOwnerTransfer = async (
	client: Polar,
	options: PolarOrganizationRoleSyncOptions,
	data: {
		organizationId: string;
		members: readonly BetterAuthOrganizationMemberMirror[];
	},
) => {
	const customer = await findTeamCustomer(client, data.organizationId);
	if (!customer) {
		throw new PolarOrganizationTeamCustomerNotFoundError(data.organizationId);
	}

	const creatorRole = options.creatorRole ?? "owner";
	const ownerCandidates = data.members
		.filter((member) => hasBetterAuthCreatorRole(member.role, creatorRole))
		.sort(compareOwnerCandidates);
	const fallbackOwner = ownerCandidates[0];
	if (!fallbackOwner) {
		throw new PolarOrganizationOwnerInvariantError(
			data.organizationId,
			`Better Auth has no member with creator role "${creatorRole}"`,
		);
	}

	const ownerPage = await client.members.listMembers({
		externalCustomerId: data.organizationId,
		role: "owner",
		limit: 100,
	});
	const polarOwners = ownerPage.result.items;
	if (polarOwners.length !== 1) {
		throw new PolarOrganizationOwnerInvariantError(
			data.organizationId,
			`Polar returned ${polarOwners.length} owners`,
		);
	}

	const currentOwner = polarOwners[0];
	if (!currentOwner?.externalId) {
		throw new PolarOrganizationOwnerInvariantError(
			data.organizationId,
			"the current Polar owner has no external ID",
		);
	}

	const retainedOwner = ownerCandidates.find(
		(candidate) => candidate.userId === currentOwner.externalId,
	);
	if (retainedOwner) {
		return { canonicalOwner: retainedOwner, currentOwner, transferred: false };
	}

	const successor = await findMember(
		client,
		data.organizationId,
		fallbackOwner.userId,
	);
	if (!successor) {
		throw new PolarOrganizationOwnerInvariantError(
			data.organizationId,
			`successor "${fallbackOwner.userId}" is not a Polar member`,
		);
	}
	await updateMemberRole(
		client,
		data.organizationId,
		fallbackOwner.userId,
		"owner",
	);

	// Polar automatically demotes the previous owner to billing manager. If the
	// previous owner remains in Better Auth and maps to `member`, apply that
	// explicit role as part of this transfer.
	const previousOwner = data.members.find(
		(member) => member.userId === currentOwner.externalId,
	);
	if (previousOwner) {
		const previousOwnerRole = await resolveNonOwnerRole(
			options,
			data.organizationId,
			previousOwner,
		);
		if (previousOwnerRole !== "billing_manager") {
			await updateMemberRole(
				client,
				data.organizationId,
				previousOwner.userId,
				previousOwnerRole,
			);
		}
	}

	return { canonicalOwner: fallbackOwner, currentOwner, transferred: true };
};

export const ensureMemberMirror = async (
	client: Polar,
	options: PolarOrganizationRoleSyncOptions,
	data: {
		organizationId: string;
		user: { id: string; email: string; name?: string | null };
		betterAuthRole: string;
		/** Only the initial creator hook may run before the team customer exists. */
		deferIfCustomerMissing?: boolean;
	},
) => {
	const customer = await findTeamCustomer(client, data.organizationId);
	if (!customer) {
		if (data.deferIfCustomerMissing) return;
		throw new PolarOrganizationTeamCustomerNotFoundError(data.organizationId);
	}

	const member = {
		role: data.betterAuthRole,
		userId: data.user.id,
		user: data.user,
	};
	const role = await resolveNonOwnerRole(options, data.organizationId, member);
	await ensureMemberRecord(client, data.organizationId, member, role);
};

export const updateMemberRoleMirror = async (
	client: Polar,
	options: PolarOrganizationRoleSyncOptions,
	data: {
		organizationId: string;
		user: { id: string; email: string; name?: string | null };
		betterAuthRole: string;
		members: readonly BetterAuthOrganizationMemberMirror[];
	},
) => {
	const ownership = await syncOwnerTransfer(client, options, {
		organizationId: data.organizationId,
		members: data.members,
	});

	if (
		data.user.id === ownership.canonicalOwner.userId ||
		(ownership.transferred &&
			data.user.id === ownership.currentOwner.externalId)
	) {
		return;
	}

	const member = {
		role: data.betterAuthRole,
		userId: data.user.id,
		user: data.user,
	};
	const role = await resolveNonOwnerRole(options, data.organizationId, member);
	await updateMemberRole(client, data.organizationId, data.user.id, role);
};

export const updateMemberMirror = async (
	client: Polar,
	data: {
		organizationId: string;
		user: { id: string; email: string; name?: string | null };
	},
) => {
	const updatedMember = await client.customers.members.updateExternal({
		externalId: data.organizationId,
		memberExternalId: data.user.id,
		memberUpdate: {
			email: data.user.email,
			name: data.user.name ?? null,
		},
	});
	assertMemberExternalId(updatedMember, data.organizationId, data.user.id);
};

export const removeMemberMirror = async (
	client: Polar,
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
	await syncOwnerTransfer(client, options, {
		organizationId: data.organizationId,
		members: remainingMembers,
	});

	try {
		await client.customers.members.deleteExternal({
			externalId: data.organizationId,
			memberExternalId: data.externalMemberId,
		});
	} catch (error) {
		if (error instanceof ResourceNotFound) return;
		throw error;
	}
};
