import type { Polar } from "@polar-sh/sdk";

import type { Endpoint, InferOptionSchema, Session, User } from "better-auth";
import type { subscriptions } from "./schema";

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

export interface SubscriptionOptions {
	/**
	 * Optional setting to sync Polar subscriptions data in your database
	 */
	schema?: InferOptionSchema<typeof subscriptions>;
}

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
	use: ((polar: Polar) => Record<string, Endpoint>)[];
}

export type Subscription = {
	userId: string;
	subscriptionId: string;
	referenceId?: string;
	status:
		| "incomplete"
		| "incomplete_expired"
		| "trialing"
		| "active"
		| "past_due"
		| "canceled"
		| "unpaid";
	periodStart?: string;
	periodEnd?: string;
	cancelAtPeriodEnd?: boolean;
};
