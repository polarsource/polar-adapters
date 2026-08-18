import type { AuthContext, BetterAuthPlugin } from "better-auth";
import {
  type OrganizationOptions,
  getOrgAdapter,
} from "better-auth/plugins/organization";
import type { PolarOptions } from "../types";
import {
  ensureMemberMirror,
  ensureTeamCustomer,
  isTeamCustomerSynchronized,
  removeMemberMirror,
  updateMemberRoleMirror,
  updateTeamCustomer,
} from "./sync";
import type {
  BetterAuthOrganizationMemberMirror,
  PolarOrganizationRoleSyncOptions,
} from "./types";

type BetterAuthOrganizationPlugin = BetterAuthPlugin & {
  id: "organization";
  options: OrganizationOptions;
};

type OrganizationHooks = NonNullable<OrganizationOptions["organizationHooks"]>;
type AfterCreateOrganizationData = Parameters<
  NonNullable<OrganizationHooks["afterCreateOrganization"]>
>[0];
type AfterUpdateOrganizationData = Parameters<
  NonNullable<OrganizationHooks["afterUpdateOrganization"]>
>[0];
type AfterAddMemberData = Parameters<
  NonNullable<OrganizationHooks["afterAddMember"]>
>[0];
type AfterAcceptInvitationData = Parameters<
  NonNullable<OrganizationHooks["afterAcceptInvitation"]>
>[0];
type AfterUpdateMemberRoleData = Parameters<
  NonNullable<OrganizationHooks["afterUpdateMemberRole"]>
>[0];
type AfterRemoveMemberData = Parameters<
  NonNullable<OrganizationHooks["afterRemoveMember"]>
>[0];

/**
 * Compose Polar's customer, roster, and single-owner synchronization into
 * Better Auth's organization lifecycle hooks. Application after-hooks run
 * first; Polar synchronization runs only after they succeed.
 */
export const installOrganizationHooks = (
  ctx: AuthContext,
  options: PolarOptions,
) => {
  const organizationOptions = options.experimental_organization;
  if (!organizationOptions?.enabled) {
    return;
  }

  const organizationPlugin =
    ctx.getPlugin<BetterAuthOrganizationPlugin>("organization");

  if (!organizationPlugin) {
    throw new Error(
      "Polar organization support requires Better Auth's organization plugin",
    );
  }

  const client = options.client;
  const betterAuthOrganizationOptions = organizationPlugin.options;

  const existingHooks = betterAuthOrganizationOptions.organizationHooks ?? {};

  const roleSyncOptions: PolarOrganizationRoleSyncOptions = {
    creatorRole: betterAuthOrganizationOptions.creatorRole ?? "owner",
    mapBetterAuthRoleToPolarRole:
      organizationOptions.mapBetterAuthRoleToPolarRole,
  };

  const organizationAdapter = getOrgAdapter(ctx, betterAuthOrganizationOptions);

  const listOrganizationMembers = async (
    organizationId: string,
  ): Promise<BetterAuthOrganizationMemberMirror[]> => {
    let result = await organizationAdapter.listMembers({ organizationId });
    if (result.members.length < result.total) {
      result = await organizationAdapter.listMembers({
        organizationId,
        limit: result.total,
      });
    }
    if (result.members.length < result.total) {
      throw new Error(
        `Better Auth returned only ${result.members.length} of ${result.total} members for organization "${organizationId}"`,
      );
    }

    return result.members.map((member) => ({
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
  };

  const syncCreatedOrganization = async (data: AfterCreateOrganizationData) => {
    await ensureTeamCustomer(client, organizationOptions, {
      organization: data.organization,
      owner: data.user,
    });
  };

  const syncUpdatedOrganization = async (data: AfterUpdateOrganizationData) => {
    const updatedOrganization = data.organization;
    if (!updatedOrganization) {
      ctx.logger.warn(
        "Polar organization update sync skipped because the Better Auth adapter returned no organization",
      );
      return;
    }
    if (!(await isTeamCustomerSynchronized(client, updatedOrganization.id))) {
      return;
    }

    await updateTeamCustomer(client, updatedOrganization);
  };

  const syncMember = async (
    data: AfterAddMemberData | AfterAcceptInvitationData,
    deferInitialCreator: boolean,
  ) => {
    if (!(await isTeamCustomerSynchronized(client, data.organization.id))) {
      return;
    }

    const members = deferInitialCreator
      ? await listOrganizationMembers(data.organization.id)
      : [];
    await ensureMemberMirror(client, roleSyncOptions, {
      organizationId: data.organization.id,
      user: data.user,
      betterAuthRole: data.member.role,
      deferIfCustomerMissing:
        members.length === 1 && members[0]?.userId === data.member.userId,
    });
  };

  const syncUpdatedMemberRole = async (data: AfterUpdateMemberRoleData) => {
    if (!(await isTeamCustomerSynchronized(client, data.organization.id))) {
      return;
    }
    const members = await listOrganizationMembers(data.organization.id);
    await updateMemberRoleMirror(client, roleSyncOptions, {
      organizationId: data.organization.id,
      user: data.user,
      betterAuthRole: data.member.role,
      members,
    });
  };

  const syncRemovedMember = async (data: AfterRemoveMemberData) => {
    if (!(await isTeamCustomerSynchronized(client, data.organization.id))) {
      return;
    }
    const members = await listOrganizationMembers(data.organization.id);
    await removeMemberMirror(client, roleSyncOptions, {
      organizationId: data.organization.id,
      externalMemberId: data.member.userId,
      members,
    });
  };

  betterAuthOrganizationOptions.organizationHooks = {
    ...existingHooks,
    afterCreateOrganization: async (data: AfterCreateOrganizationData) => {
      await existingHooks.afterCreateOrganization?.(data);
      await syncCreatedOrganization(data);
    },
    afterUpdateOrganization: async (data: AfterUpdateOrganizationData) => {
      await existingHooks.afterUpdateOrganization?.(data);
      await syncUpdatedOrganization(data);
    },
    afterAddMember: async (data: AfterAddMemberData) => {
      await existingHooks.afterAddMember?.(data);
      await syncMember(data, true);
    },
    afterAcceptInvitation: async (data: AfterAcceptInvitationData) => {
      await existingHooks.afterAcceptInvitation?.(data);
      await syncMember(data, false);
    },
    afterUpdateMemberRole: async (data: AfterUpdateMemberRoleData) => {
      await existingHooks.afterUpdateMemberRole?.(data);
      await syncUpdatedMemberRole(data);
    },
    afterRemoveMember: async (data: AfterRemoveMemberData) => {
      await existingHooks.afterRemoveMember?.(data);
      await syncRemovedMember(data);
    },
  };
};
