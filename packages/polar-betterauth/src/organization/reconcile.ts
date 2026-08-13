import type { Polar } from "@polar-sh/sdk";
import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
import type { Member as PolarMember } from "@polar-sh/sdk/models/components/member.js";
import { ResourceNotFound } from "@polar-sh/sdk/models/errors/resourcenotfound.js";
import type { AuthContext } from "better-auth";
import {
	BetterAuthOrganizationStateError,
	type OrganizationMemberState,
	getOrganizationCreatorRole,
	hasBetterAuthRole,
	loadBetterAuthOrganizationState,
} from "./lifecycle";
import { createPolarOrganizationAPI } from "./polar-api";
import type { PolarOrganizationAPI } from "./polar-api";
import { ensureTeamCustomer, reconcileOwner } from "./sync";
import type {
	BetterAuthOrganizationMemberMirror,
	PolarOrganizationOptions,
	PolarOrganizationRoleSyncOptions,
} from "./types";

export interface ReconcileOrganizationSummary {
	organizationId: string;
	customer: "created" | "updated" | "unchanged";
	members: {
		created: number;
		updated: number;
		deleted: number;
		unchanged: number;
	};
	ownerTransferred: boolean;
	warnings: string[];
	errors: string[];
}

export interface ReconcileOrganizationInput {
	authContext: AuthContext;
	polarClient: Polar;
	organizationId: string;
	organizationOptions?: PolarOrganizationOptions;
	/** Delete Polar members absent from Better Auth. Disabled by default. */
	deleteStaleMembers?: boolean;
}

const getCustomerIfPresent = async (
	api: PolarOrganizationAPI,
	organizationId: string,
): Promise<Customer | null> => {
	try {
		return await api.getCustomerByExternalId(organizationId);
	} catch (error) {
		if (error instanceof ResourceNotFound) {
			return null;
		}
		throw error;
	}
};

const listAllPolarMembers = async (
	api: PolarOrganizationAPI,
	organizationId: string,
) => {
	const members: PolarMember[] = [];
	let page = 1;
	while (true) {
		const { result } = await api.listMembersByExternalCustomerId(
			organizationId,
			{ page, limit: 100 },
		);
		members.push(...result.items);
		if (page >= result.pagination.maxPage) {
			return members;
		}
		page += 1;
	}
};

const byCreationThenId = (
	left: OrganizationMemberState,
	right: OrganizationMemberState,
) => {
	const dateDifference =
		new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
	return dateDifference || left.id.localeCompare(right.id);
};

const toMemberMirrors = (
	members: OrganizationMemberState[],
): BetterAuthOrganizationMemberMirror[] =>
	members.map((member) => ({
		id: member.id,
		organizationId: member.organizationId,
		userId: member.userId,
		role: member.role,
		createdAt: member.createdAt,
		user: {
			id: member.user.id,
			email: member.user.email,
			name: member.user.name,
		},
	}));

const memberChanged = (before: PolarMember, after: PolarMember) =>
	before.email !== after.email ||
	before.name !== after.name ||
	before.role !== after.role ||
	before.externalId !== after.externalId;

/**
 * Rebuild one Polar team mirror from Better Auth, without deleting the team
 * customer. This is an internal server-side helper and installs no endpoint.
 *
 * This calls the roster helper exports owned by organization/sync.ts. If that
 * concurrently-owned module changes signatures, the compile adaptation is
 * intentionally limited to the two calls below.
 */
export const reconcileOrganization = async (
	input: ReconcileOrganizationInput,
): Promise<ReconcileOrganizationSummary> => {
	const { authContext, organizationId } = input;
	const summary: ReconcileOrganizationSummary = {
		organizationId,
		customer: "unchanged",
		members: { created: 0, updated: 0, deleted: 0, unchanged: 0 },
		ownerTransferred: false,
		warnings: [],
		errors: [],
	};

	try {
		const api = createPolarOrganizationAPI(input.polarClient);
		const state = await loadBetterAuthOrganizationState(
			authContext,
			organizationId,
		);
		const creatorRole = getOrganizationCreatorRole(authContext);
		const ownerCandidates = state.members
			.filter((member) => hasBetterAuthRole(member.role, creatorRole))
			.sort(byCreationThenId);
		const fallbackOwner = ownerCandidates[0];
		if (!fallbackOwner) {
			throw new BetterAuthOrganizationStateError(
				`Better Auth organization "${organizationId}" has no "${creatorRole}" owner`,
			);
		}

		const existingCustomer = await getCustomerIfPresent(api, organizationId);
		const polarMembersBefore =
			existingCustomer?.type === "team"
				? await listAllPolarMembers(api, organizationId)
				: [];
		const currentOwnerExternalId = polarMembersBefore.find(
			(member) => member.role === "owner",
		)?.externalId;
		const selectedOwner =
			ownerCandidates.find(
				(candidate) => candidate.userId === currentOwnerExternalId,
			) ?? fallbackOwner;

		await ensureTeamCustomer(
			api,
			input.organizationOptions ?? { enabled: true },
			{
				organization: state.organization,
				owner: selectedOwner.user,
			},
		);
		summary.customer = existingCustomer
			? existingCustomer.name === state.organization.name
				? "unchanged"
				: "updated"
			: "created";

		const roleOptions: PolarOrganizationRoleSyncOptions = {
			creatorRole,
			mapMemberRole: input.organizationOptions?.mapMemberRole,
		};
		const reconciliation = await reconcileOwner(api, roleOptions, {
			organizationId,
			members: toMemberMirrors(state.members),
		});
		summary.ownerTransferred = reconciliation.ownerTransferred;

		const beforeByExternalId = new Map(
			polarMembersBefore.flatMap((member) =>
				member.externalId ? [[member.externalId, member] as const] : [],
			),
		);
		for (const member of state.members) {
			const before = beforeByExternalId.get(member.userId);
			const after = reconciliation.members.get(member.userId);
			if (!after) {
				throw new BetterAuthOrganizationStateError(
					`Polar member "${member.userId}" was absent after reconciliation`,
				);
			}
			if (!before) {
				summary.members.created += 1;
			} else if (memberChanged(before, after)) {
				summary.members.updated += 1;
			} else {
				summary.members.unchanged += 1;
			}
		}

		const betterAuthUserIds = new Set(
			state.members.map((member) => member.userId),
		);
		const staleMembers = polarMembersBefore.filter(
			(member) =>
				member.externalId !== null && !betterAuthUserIds.has(member.externalId),
		);
		const unidentifiedMembers = polarMembersBefore.filter(
			(member) => member.externalId === null,
		);
		if (unidentifiedMembers.length > 0) {
			summary.warnings.push(
				`${unidentifiedMembers.length} Polar member(s) have no external ID and were retained`,
			);
		}
		if (input.deleteStaleMembers) {
			for (const member of staleMembers) {
				if (member.externalId === null) continue;
				await api.deleteMemberByExternalIds(organizationId, member.externalId);
				summary.members.deleted += 1;
			}
		} else if (staleMembers.length > 0) {
			summary.warnings.push(
				`${staleMembers.length} stale Polar member(s) were retained; pass deleteStaleMembers to remove them`,
			);
		}

		return summary;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		authContext.logger.error(
			`Polar organization reconciliation failed operation=organization.reconcile organizationId=${organizationId} result=error error=${message}`,
		);
		throw error;
	}
};
