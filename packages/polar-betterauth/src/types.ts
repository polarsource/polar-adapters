import type { Polar } from "@polar-sh/sdk";

import type { GenericEndpointContext, UnionToIntersection, User } from "better-auth";
import type { checkout } from "./plugins/checkout";
import type { portal } from "./plugins/portal";
import type { usage } from "./plugins/usage";
import type { webhooks } from "./plugins/webhooks";

export type GetExternalCustomerId = (
	context: GenericEndpointContext
) => Promise<string | undefined>;

export type Product = {
	/**
	 * Product Id from Polar Product
	 */
	productId: string;
	/**
	 * Easily identifiable slug for the product
	 */
	slug: string;
};

export type PolarPlugin =
	| ReturnType<typeof checkout>
	| ReturnType<typeof usage>
	| ReturnType<typeof portal>
	| ReturnType<typeof webhooks>;

export type PolarPlugins = [PolarPlugin, ...PolarPlugin[]];

export type PolarEndpoints = UnionToIntersection<ReturnType<PolarPlugin>>;

export interface PolarOptions {
	/**
	 * Polar Client
	 */
	client: Polar;
	/**
	 * Enable customer creation when a user signs up
	 */
	createCustomerOnSignUp?: boolean;
	/**
	 * A custom function to get the customer create
	 * params
	 * @param data - data containing user and session
	 * @returns
	 */
	getCustomerCreateParams?: (
		data: {
			user: Partial<User>;
		},
		request?: Request,
	) => Promise<{
		metadata?: Record<string, string | number | boolean>;
	}>;
	/**
	 * Custom function to resolve the external customer ID from the request context.
	 * Defaults to using the session user ID via Better Auth's getSessionFromCtx.
	 */
	getExternalCustomerId?: GetExternalCustomerId;
	/**
	 * Use Polar plugins
	 */
	use: PolarPlugins;
}

export type ResolvedPolarOptions = PolarOptions & {
	getExternalCustomerId: GetExternalCustomerId;
};
