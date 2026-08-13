import type { AuthContext, User } from "better-auth";
import { APIError } from "better-auth/api";
import type { AnonymousSession } from "better-auth/plugins/anonymous";
import type { Member } from "better-auth/plugins/organization";
import {
	mapBetterAuthRoleToPolar,
	parseBetterAuthRoles,
} from "./organization/roles";
import type { BetterAuthRoleMappingOptions } from "./organization/types";

export type BillingAuthorization = "member" | "billing";

export type BillingPrincipal =
	| {
			kind: "individual";
			/** Undefined preserves endpoints that allow checkout without a session. */
			externalCustomerId: string | undefined;
			isAnonymous: boolean;
	  }
	| {
			kind: "team";
			externalCustomerId: string;
			externalMemberId: string;
			betterAuthRole: string;
			isAnonymous: false;
	  };

export interface BillingPrincipalSession {
	user: Pick<User, "id"> &
		Partial<Pick<AnonymousSession["user"], "isAnonymous">>;
}

export interface BillingAuthorizationInput {
	authorization: BillingAuthorization;
	organizationId: string;
	userId: string;
	betterAuthRole: string;
	roles: readonly string[];
	defaultAuthorized: boolean;
}

export type BillingAuthorizationCallback = (
	input: BillingAuthorizationInput,
) => boolean | Promise<boolean>;

export interface ResolveBillingPrincipalInput {
	/** Better Auth context whose adapter understands logical plugin model names. */
	context: {
		adapter: Pick<AuthContext["adapter"], "findOne">;
	};
	/** The endpoint's resolved session, or null when unauthenticated. */
	session: BillingPrincipalSession | null;
	/** Explicit organization selection. Active organization is never inferred. */
	organizationId?: string | undefined;
	/** Reject team billing when the root Polar integration explicitly disabled it. */
	organizationEnabled?: boolean | undefined;
	/** Organization permission required by the endpoint. @default "member" */
	authorization?: BillingAuthorization | undefined;
	/** Role names used by the default billing authorization policy. */
	roleMapping?: BetterAuthRoleMappingOptions | undefined;
	/** Optional final policy override. Membership is always verified first. */
	authorize?: BillingAuthorizationCallback | undefined;
}

const isBillingRole = (
	role: string,
	roleMapping: BetterAuthRoleMappingOptions | undefined,
) =>
	mapBetterAuthRoleToPolar(
		{
			role,
			// Both canonical and additional Better Auth owners are billing-capable.
			// Canonical ownership is irrelevant to this local authorization check.
			isCanonicalOwner: false,
		},
		roleMapping,
	) !== "member";

/**
 * Resolve the Polar billing identity and authorize explicit organization access.
 *
 * This function performs local Better Auth authorization only. It deliberately
 * does not infer an active organization or make Polar reconciliation/API calls.
 */
export const resolveBillingPrincipal = async ({
	context,
	session,
	organizationId,
	organizationEnabled,
	authorization = "member",
	roleMapping,
	authorize,
}: ResolveBillingPrincipalInput): Promise<BillingPrincipal> => {
	if (organizationId === undefined) {
		return {
			kind: "individual",
			externalCustomerId: session?.user.id,
			isAnonymous: session?.user.isAnonymous === true,
		};
	}

	if (organizationEnabled !== true) {
		throw new APIError("BAD_REQUEST", {
			message: "Polar organization support is not enabled",
		});
	}

	if (!session?.user.id) {
		throw new APIError("UNAUTHORIZED", {
			message: "Authentication is required to access organization billing",
		});
	}

	if (session.user.isAnonymous === true) {
		throw new APIError("UNAUTHORIZED", {
			message: "Anonymous users cannot access organization billing",
		});
	}

	const membership = await context.adapter.findOne<Member>({
		model: "member",
		where: [
			{
				field: "userId",
				value: session.user.id,
			},
			{
				field: "organizationId",
				value: organizationId,
			},
		],
	});

	if (!membership) {
		throw new APIError("FORBIDDEN", {
			message: "User is not a member of the requested organization",
		});
	}

	const defaultAuthorized =
		authorization === "member" || isBillingRole(membership.role, roleMapping);
	const authorized = authorize
		? await authorize({
				authorization,
				organizationId,
				userId: session.user.id,
				betterAuthRole: membership.role,
				roles: parseBetterAuthRoles(membership.role),
				defaultAuthorized,
			})
		: defaultAuthorized;

	if (!authorized) {
		throw new APIError("FORBIDDEN", {
			message: "Organization billing access requires a billing role",
		});
	}

	return {
		kind: "team",
		externalCustomerId: organizationId,
		externalMemberId: session.user.id,
		betterAuthRole: membership.role,
		isAnonymous: false,
	};
};
