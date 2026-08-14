import type { Polar } from "@polar-sh/sdk";
import type { AuthContext, BetterAuthPlugin, User } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import type { Member } from "better-auth/plugins/organization";
import * as z from "zod/v4";
import type { PolarOptions } from "../types";
import { removeMemberMirror, updateMemberMirror } from "./sync";
import type {
  BetterAuthOrganizationMemberMirror,
  PolarOrganizationRoleSyncOptions,
} from "./types";

export const ORGANIZATION_LEAVE_PATH = "/organization/leave";

type BetterAuthMember = Member & Record<string, unknown>;
type BetterAuthUser = User & Record<string, unknown>;

export interface OrganizationMemberState extends BetterAuthMember {
  user: BetterAuthUser;
}

export class BetterAuthOrganizationStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BetterAuthOrganizationStateError";
  }
}

const getOrganizationCreatorRole = (authContext: AuthContext) => {
  const plugin = authContext.getPlugin("organization");
  const creatorRole = (plugin?.options as { creatorRole?: unknown } | undefined)
    ?.creatorRole;
  return typeof creatorRole === "string" ? creatorRole : "owner";
};

/**
 * Read organization members through Better Auth's logical model names. Better
 * Auth's adapter layer maps these names and fields when an application uses a
 * custom organization schema.
 */
const loadBetterAuthOrganizationMembers = async (
  authContext: AuthContext,
  organizationId: string,
): Promise<OrganizationMemberState[]> => {
  const members = await authContext.adapter.findMany<BetterAuthMember>({
    model: "member",
    where: [{ field: "organizationId", value: organizationId }],
  });
  if (members.length === 0) {
    return [];
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

  return members.map((member) => {
    const user = usersById.get(member.userId);
    if (!user) {
      throw new BetterAuthOrganizationStateError(
        `Better Auth user "${member.userId}" for organization "${organizationId}" was not found`,
      );
    }
    return { ...member, user };
  });
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

export const synchronizeUserOrganizationProfiles = async (
  authContext: AuthContext,
  client: Polar,
  user: User,
) => {
  const memberships = await listBetterAuthMembershipsForUser(
    authContext,
    user.id,
  );

  const results = await Promise.allSettled(
    memberships.map((membership) =>
      updateMemberMirror(client, {
        organizationId: membership.organizationId,
        user,
      }),
    ),
  );

  const rejection = results.find((result) => result.status === "rejected");
  if (rejection?.status === "rejected") {
    throw rejection.reason;
  }
};

/**
 * Shared removal primitive for self-leave and user deletion. The organization
 * hook composer can call this same helper for any future bypass path.
 */
export const removeOrganizationMemberMirror = async (input: {
  authContext: AuthContext;
  client: Polar;
  organizationId: string;
  userId: string;
  roleOptions?: PolarOrganizationRoleSyncOptions;
}) => {
  const members = await loadBetterAuthOrganizationMembers(
    input.authContext,
    input.organizationId,
  );
  await removeMemberMirror(
    input.client,
    roleSyncOptions(input.authContext, input.roleOptions),
    {
      organizationId: input.organizationId,
      externalMemberId: input.userId,
      members: toMemberMirrors(members),
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

const leaveMembershipSchema = z.object({
  organizationId: z.string(),
  userId: z.string(),
});

const readLeaveMembership = async (returned: unknown) => {
  const value = await endpointResult(returned);

  if (value === null || value === undefined) {
    return null;
  }

  const result = leaveMembershipSchema.safeParse(value);

  if (!result.success) {
    throw new BetterAuthOrganizationStateError(
      "Better Auth organization leave returned no deleted membership",
    );
  }

  return result.data;
};

export const synchronizeOrganizationLeave = async (
  options: PolarOptions,
  context: { context: AuthContext & { returned?: unknown } },
) => {
  const membership = await readLeaveMembership(context.context["returned"]);
  if (!membership) {
    return;
  }
  await removeOrganizationMemberMirror({
    authContext: context.context,
    client: options.client,
    ...membership,
    roleOptions: {
      mapMemberRole: options.organization?.mapMemberRole,
    },
  });
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
  client: Polar,
  user: User,
  options?: PolarOrganizationRoleSyncOptions,
) => {
  const memberships = await listBetterAuthMembershipsForUser(
    authContext,
    user.id,
  );

  const results = await Promise.allSettled(
    memberships.map((membership) =>
      removeOrganizationMemberMirror({
        authContext,
        client,
        organizationId: membership.organizationId,
        userId: user.id,
        roleOptions: options,
      }),
    ),
  );

  const rejection = results.find((result) => result.status === "rejected");
  if (rejection?.status === "rejected") {
    throw rejection.reason;
  }
};
