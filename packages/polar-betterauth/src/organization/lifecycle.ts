import type { AuthContext, BetterAuthPlugin, User } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { Member, Organization } from "better-auth/plugins/organization";
import type { PolarOptions } from "../types";
import { createPolarOrganizationAPI } from "./polar-api";
import type { PolarOrganizationAPI } from "./polar-api";
import { parseBetterAuthRoles } from "./roles";
import {
	PolarOrganizationTeamCustomerNotFoundError,
	removeMemberMirror,
	updateMemberMirror,
} from "./sync";
import type {
	BetterAuthOrganizationMemberMirror,
	PolarOrganizationRoleSyncOptions,
} from "./types";

export const ORGANIZATION_LEAVE_PATH = "/organization/leave";

type BetterAuthMember = Member & Record<string, unknown>;
type BetterAuthOrganization = Organization & Record<string, unknown>;
type BetterAuthUser = User & Record<string, unknown>;

export interface OrganizationMemberState extends BetterAuthMember {
	user: BetterAuthUser;
}

export interface BetterAuthOrganizationState {
	organization: BetterAuthOrganization;
	members: OrganizationMemberState[];
}

export class BetterAuthOrganizationStateError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "BetterAuthOrganizationStateError";
	}
}

export const getOrganizationCreatorRole = (authContext: AuthContext) => {
	const plugin = authContext.getPlugin("organization");
	const creatorRole = (plugin?.options as { creatorRole?: unknown } | undefined)
		?.creatorRole;
	return typeof creatorRole === "string" ? creatorRole : "owner";
};

export const hasBetterAuthRole = (role: string, expectedRole: string) =>
	parseBetterAuthRoles(role).includes(expectedRole);

/**
 * Read organization state through Better Auth's logical model names. Better
 * Auth's adapter layer maps these names and fields when an application uses a
 * custom organization schema.
 */
export const loadBetterAuthOrganizationState = async (
	authContext: AuthContext,
	organizationId: string,
): Promise<BetterAuthOrganizationState> => {
	const organization =
		await authContext.adapter.findOne<BetterAuthOrganization>({
			model: "organization",
			where: [{ field: "id", value: organizationId }],
		});
	if (!organization) {
		throw new BetterAuthOrganizationStateError(
			`Better Auth organization "${organizationId}" was not found`,
		);
	}

	const members = await authContext.adapter.findMany<BetterAuthMember>({
		model: "member",
		where: [{ field: "organizationId", value: organizationId }],
	});
	if (members.length === 0) {
		return { organization, members: [] };
	}

	const users = await authContext.adapter.findMany<BetterAuthUser>({
		model: "user",
		where: [
			{
				field: "id",
				operator: "in",
				value: members.map((member) => member.userId),
			},
		],
	});
	const usersById = new Map(users.map((user) => [user.id, user]));

	return {
		organization,
		members: members.map((member) => {
			const user = usersById.get(member.userId);
			if (!user) {
				throw new BetterAuthOrganizationStateError(
					`Better Auth user "${member.userId}" for organization "${organizationId}" was not found`,
				);
			}
			return { ...member, user };
		}),
	};
};

export const listBetterAuthMembershipsForUser = (
	authContext: AuthContext,
	userId: string,
) =>
	authContext.adapter.findMany<BetterAuthMember>({
		model: "member",
		where: [{ field: "userId", value: userId }],
	});

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

const roleSyncOptions = (
	authContext: AuthContext,
	options?: PolarOrganizationRoleSyncOptions,
): PolarOrganizationRoleSyncOptions => ({
	creatorRole: options?.creatorRole ?? getOrganizationCreatorRole(authContext),
	mapMemberRole: options?.mapMemberRole,
});

/** Sequential by design: a profile update must not fan out without bounds. */
export const synchronizeUserOrganizationProfiles = async (
	authContext: AuthContext,
	api: PolarOrganizationAPI,
	user: User,
	options?: PolarOrganizationRoleSyncOptions,
) => {
	const memberships = await listBetterAuthMembershipsForUser(
		authContext,
		user.id,
	);
	for (const membership of memberships) {
		const state = await loadBetterAuthOrganizationState(
			authContext,
			membership.organizationId,
		);
		const result = await updateMemberMirror(
			api,
			roleSyncOptions(authContext, options),
			{
				organizationId: membership.organizationId,
				user,
				betterAuthRole: membership.role,
				members: toMemberMirrors(state.members),
			},
		);
		if (result === "deferred") {
			throw new PolarOrganizationTeamCustomerNotFoundError(
				membership.organizationId,
			);
		}
	}
	return memberships.length;
};

/**
 * Shared removal primitive for self-leave and user deletion. The organization
 * hook composer can call this same helper for any future bypass path.
 *
 * Compile-adaptation note for the concurrently-owned sync.ts: if its final
 * `reconcileOwner`/`removeMemberMirror` signatures differ, adapt only this
 * boundary; lifecycle callers intentionally depend on this stable function.
 */
export const removeOrganizationMemberMirror = async (input: {
	authContext: AuthContext;
	api: PolarOrganizationAPI;
	organizationId: string;
	userId: string;
	roleOptions?: PolarOrganizationRoleSyncOptions;
}) => {
	const state = await loadBetterAuthOrganizationState(
		input.authContext,
		input.organizationId,
	);
	return removeMemberMirror(
		input.api,
		roleSyncOptions(input.authContext, input.roleOptions),
		{
			organizationId: input.organizationId,
			externalMemberId: input.userId,
			members: toMemberMirrors(state.members),
		},
	);
};

const endpointResult = async (returned: unknown): Promise<unknown> => {
	if (returned instanceof APIError) {
		return null;
	}
	if (returned instanceof Response) {
		if (!returned.ok) {
			return null;
		}
		return returned.clone().json();
	}
	return returned;
};

const readLeaveMembership = async (returned: unknown) => {
	const value = await endpointResult(returned);
	if (value === null || value === undefined) {
		return null;
	}
	if (
		typeof value !== "object" ||
		!("organizationId" in value) ||
		!("userId" in value) ||
		typeof value.organizationId !== "string" ||
		typeof value.userId !== "string"
	) {
		throw new BetterAuthOrganizationStateError(
			"Better Auth organization leave returned no deleted membership",
		);
	}
	return {
		organizationId: value.organizationId,
		userId: value.userId,
	};
};

const logLifecycleFailure = (
	context: AuthContext,
	operation: string,
	organizationId: string | undefined,
	userId: string | undefined,
	error: unknown,
) => {
	const message = error instanceof Error ? error.message : String(error);
	context.logger.error(
		`Polar organization lifecycle failed operation=${operation} organizationId=${organizationId ?? "unknown"} userId=${userId ?? "unknown"} result=error error=${message}`,
	);
};

export const synchronizeOrganizationLeave = async (
	options: PolarOptions,
	context: { context: AuthContext & { returned?: unknown } },
) => {
	const membership = await readLeaveMembership(context.context["returned"]);
	if (!membership) {
		return;
	}
	try {
		await removeOrganizationMemberMirror({
			authContext: context.context,
			api: createPolarOrganizationAPI(options.client),
			...membership,
			roleOptions: {
				mapMemberRole: options.organization?.mapMemberRole,
			},
		});
	} catch (error) {
		logLifecycleFailure(
			context.context,
			"organization.leave",
			membership.organizationId,
			membership.userId,
			error,
		);
		throw error;
	}
};

export const createOrganizationLifecycleHooks = (
	options: PolarOptions,
): BetterAuthPlugin["hooks"] | undefined => {
	if (!options.organization?.enabled) {
		return undefined;
	}
	return {
		after: [
			{
				matcher: (context) => context.path === ORGANIZATION_LEAVE_PATH,
				handler: createAuthMiddleware(async (context) => {
					await synchronizeOrganizationLeave(options, context);
				}),
			},
		],
	};
};

export const synchronizeUserDeletionMemberships = async (
	authContext: AuthContext,
	api: PolarOrganizationAPI,
	user: User,
	options?: PolarOrganizationRoleSyncOptions,
) => {
	const memberships = await listBetterAuthMembershipsForUser(
		authContext,
		user.id,
	);
	for (const membership of memberships) {
		await removeOrganizationMemberMirror({
			authContext,
			api,
			organizationId: membership.organizationId,
			userId: user.id,
			roleOptions: options,
		});
	}
	return memberships.length;
};

export { logLifecycleFailure };
