import type { Polar } from "@polar-sh/sdk";

import type { Session, UnionToIntersection, User } from "better-auth";
import type { checkout } from "./plugins/checkout";
import type { webhooks } from "./plugins/webhooks";
import type { usage } from "./plugins/usage";

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
			user: User;
			session: Session;
		},
		request?: Request,
	) => Promise<{
		metadata?: Record<string, string>;
	}>;
	/**
	 * Use Polar plugins
	 */
	use: PolarPlugins;
}
