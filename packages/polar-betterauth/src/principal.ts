import type { Polar } from "@polar-sh/sdk";
import type { GenericEndpointContext } from "better-auth";
import { APIError } from "better-auth/api";
import { defaultMapRole, ensureMemberMirror } from "./org-hooks";

/**
 * The entity a billing operation acts for: the user themselves
 * (`externalCustomerId = user.id`) or an organization they are a member of
 * (`externalCustomerId = organization.id`, `externalMemberId = user.id`).
 */
export type BillingPrincipal =
	| {
			kind: "user";
			externalCustomerId: string;
			isAnonymous: boolean;
	  }
	| {
			kind: "team";
			externalCustomerId: string;
			externalMemberId: string;
			isAnonymous: boolean;
	  };

export type PrincipalContext = GenericEndpointContext;

export interface ResolvePrincipalOptions {
	/** Act for this organization instead of the user (must be a member). */
	organizationId?: string;
	/** Require an owner or billing-manager role in the organization. */
	requireBillingRole?: boolean;
	/** Return `null` instead of throwing without a session (guest checkout). */
	optional?: boolean;
}

const findMembership = async (
	ctx: PrincipalContext,
	organizationId: string,
	userId: string,
): Promise<{ role?: string } | null> => {
	try {
		const member = await ctx.context.adapter.findOne({
			model: "member",
			where: [
				{ field: "organizationId", value: organizationId },
				{ field: "userId", value: userId },
			],
		});

		return (member as { role?: string } | null) ?? null;
	} catch {
		// No member model when the organization plugin isn't installed
		return null;
	}
};

export const isOrganizationMember = async (
	ctx: PrincipalContext,
	organizationId: string,
	userId: string,
): Promise<boolean> =>
	(await findMembership(ctx, organizationId, userId)) !== null;

const resolveTeamPrincipal = async (
	ctx: PrincipalContext,
	user: { id: string; isAnonymous: boolean },
	options: ResolvePrincipalOptions & { organizationId: string },
): Promise<BillingPrincipal> => {
	const membership = await findMembership(ctx, options.organizationId, user.id);

	if (!membership) {
		throw new APIError("FORBIDDEN", {
			message: "You are not a member of this organization",
		});
	}

	const memberRole = defaultMapRole(membership.role ?? "member");

	if (options.requireBillingRole && memberRole === "member") {
		throw new APIError("FORBIDDEN", {
			message: "You must be an owner or billing manager of this organization",
		});
	}

	return {
		kind: "team",
		externalCustomerId: options.organizationId,
		externalMemberId: user.id,
		isAnonymous: user.isAnonymous,
	};
};

/**
 * Resolve the billing principal for an endpoint.
 *
 * No session throws `BAD_REQUEST`, or returns `null` when `optional`. Org
 * requests always need auth (`UNAUTHORIZED` when optional). With a session,
 * throws `FORBIDDEN` if the user is not a member or lacks the required role.
 */
export function resolvePrincipal(
	ctx: PrincipalContext,
	options: ResolvePrincipalOptions & { optional: true },
): Promise<BillingPrincipal | null>;
export function resolvePrincipal(
	ctx: PrincipalContext,
	options?: ResolvePrincipalOptions & { optional?: false },
): Promise<BillingPrincipal>;
export async function resolvePrincipal(
	ctx: PrincipalContext,
	options: ResolvePrincipalOptions = {},
): Promise<BillingPrincipal | null> {
	const session = ctx.context.session;

	if (!session?.user?.id) {
		if (options.optional) {
			if (options.organizationId) {
				throw new APIError("UNAUTHORIZED", {
					message: "You must be logged in to act for an organization",
				});
			}

			return null;
		}

		throw new APIError("BAD_REQUEST", {
			message: "User not found",
		});
	}

	const user = {
		id: session.user.id,
		isAnonymous: Boolean(session.user["isAnonymous"]),
	};

	if (options.organizationId) {
		return resolveTeamPrincipal(ctx, user, {
			...options,
			organizationId: options.organizationId,
		});
	}

	return {
		kind: "user",
		externalCustomerId: user.id,
		isAnonymous: user.isAnonymous,
	};
}

const findTeamCustomer = async (
	polar: Polar,
	organizationId: string,
): Promise<{ type?: string } | null> => {
	try {
		return (await polar.customers.getExternal({
			externalId: organizationId,
		})) as { type?: string };
	} catch (e: unknown) {
		if (e instanceof Error && e.name === "ResourceNotFound") {
			return null;
		}

		throw e;
	}
};

/**
 * After repairing a missing team customer, mirror existing org members to
 * Polar. Org hooks only see later membership changes, so this backfill is
 * needed for members who joined before the team customer existed.
 * Best-effort: log failures, do not fail checkout.
 */
const backfillTeamRoster = async (
	polar: Polar,
	ctx: PrincipalContext,
	organizationId: string,
): Promise<void> => {
	try {
		const members = (await ctx.context.adapter.findMany({
			model: "member",
			where: [{ field: "organizationId", value: organizationId }],
		})) as Array<{ userId: string; role?: string }>;

		for (const member of members) {
			try {
				const user = (await ctx.context.adapter.findOne({
					model: "user",
					where: [{ field: "id", value: member.userId }],
				})) as { id: string; email?: string; name?: string } | null;

				if (!user?.email) {
					continue;
				}

				await ensureMemberMirror(
					polar,
					organizationId,
					{ id: user.id, email: user.email, name: user.name },
					member.role ?? "member",
				);
			} catch (e: unknown) {
				ctx.context.logger.warn(
					`Failed to mirror member ${member.userId} to the Polar team customer for organization ${organizationId}`,
					e,
				);
			}
		}
	} catch (e: unknown) {
		ctx.context.logger.warn(
			`Failed to backfill the Polar member roster for organization ${organizationId}`,
			e,
		);
	}
};

/**
 * Ensure the Polar team customer for an organization exists.
 * Self-repairs when org hooks failed to create it (e.g. Polar was down).
 * Without this, checkout would create an individual customer under the org id.
 */
export const ensureTeamCustomer = async (
	polar: Polar,
	ctx: PrincipalContext,
	organizationId: string,
): Promise<void> => {
	const existing = await findTeamCustomer(polar, organizationId);

	if (existing) {
		if (existing.type !== "team") {
			throw new APIError("INTERNAL_SERVER_ERROR", {
				message:
					"A non-team Polar customer already uses this organization's id. Resolve the conflict in Polar before billing this organization.",
			});
		}
		return;
	}

	const organization = (await ctx.context.adapter.findOne({
		model: "organization",
		where: [{ field: "id", value: organizationId }],
	})) as { id: string; name: string } | null;

	if (!organization) {
		throw new APIError("NOT_FOUND", {
			message: "Organization not found",
		});
	}

	const sessionUser = ctx.context.session?.user;

	if (!sessionUser?.email) {
		throw new APIError("INTERNAL_SERVER_ERROR", {
			message: "Unable to repair missing Polar team customer",
		});
	}

	try {
		await polar.customers.create({
			type: "team",
			name: organization.name,
			externalId: organization.id,
			owner: {
				email: sessionUser.email,
				name: sessionUser.name,
				externalId: sessionUser.id,
			},
		});
	} catch (e: unknown) {
		// Lost a creation race (a concurrent checkout, or the org hook
		// completing late): the customer existing now is success.
		const raced = await findTeamCustomer(polar, organizationId);

		if (!raced) {
			throw e;
		}

		if (raced.type !== "team") {
			throw new APIError("INTERNAL_SERVER_ERROR", {
				message:
					"A non-team Polar customer already uses this organization's id. Resolve the conflict in Polar before billing this organization.",
			});
		}
	}

	await backfillTeamRoster(polar, ctx, organizationId);
};
