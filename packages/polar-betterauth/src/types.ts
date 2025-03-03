import type { Session, User } from "better-auth";
import type { Polar } from "@polar-sh/sdk";
import type { Customer as PolarCustomer } from "@polar-sh/sdk/models/components/customer";
import type { WebhookSubscriptionUpdatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionupdatedpayload.js";
import type { WebhookSubscriptionCanceledPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncanceledpayload.js";
import type { CustomerCancellationReason } from "@polar-sh/sdk/models/components/customercancellationreason.js";
import type { Subscription as PolarSubscription } from "@polar-sh/sdk/models/components/subscription.js";
import type { WebhookSubscriptionRevokedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionrevokedpayload.js";
import type { CheckoutCreate } from "@polar-sh/sdk/models/components/checkoutcreate.js";
import type { validateEvent } from "@polar-sh/sdk/webhooks.js";
import type { WebhookSubscriptionCreatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncreatedpayload.js";
export type SubscriptionPlan = {
	/**
	 * Monthly price id
	 */
	priceId?: string;
	/**
	 * To use lookup key instead of price id
	 *
	 * https://docs.polar.com/products-prices/
	 * manage-prices#lookup-keys
	 */
	lookupKey?: string;
	/**
	 * A yearly discount price id
	 *
	 * useful when you want to offer a discount for
	 * yearly subscription
	 */
	annualDiscountPriceId?: string;
	/**
	 * Plan name
	 */
	name: string;
	/**
	 * Limits for the plan
	 */
	limits?: Record<string, number>;
	/**
	 * Plan group name
	 *
	 * useful when you want to group plans or
	 * when a user can subscribe to multiple plans.
	 */
	group?: string;
};

export interface Subscription {
	/**
	 * Database identifier
	 */
	id: string;
	/**
	 * The plan name
	 */
	plan: string;
	/**
	 * Polar customer id
	 */
	polarCustomerId?: string;
	/**
	 * Polar subscription id
	 */
	polarSubscriptionId?: string;
	/**
	 * Price Id for the subscription
	 */
	priceId?: string;
	/**
	 * To what reference id the subscription belongs to
	 * @example
	 * - userId for a user
	 * - workspace id for a saas platform
	 * - website id for a hosting platform
	 *
	 * @default - userId
	 */
	referenceId: string;
	/**
	 * Subscription status
	 */
	status:
		| "active"
		| "canceled"
		| "incomplete"
		| "incomplete_expired"
		| "past_due"
		| "paused"
		| "trialing"
		| "unpaid";
	/**
	 * The billing cycle start date
	 */
	periodStart?: Date;
	/**
	 * The billing cycle end date
	 */
	periodEnd?: Date;
	/**
	 * Cancel at period end
	 */
	cancelAtPeriodEnd?: boolean;
	/**
	 * A field to group subscriptions so you can have multiple subscriptions
	 * for one reference id
	 */
	groupId?: string;
	/**
	 * Number of seats for the subscription (useful for team plans)
	 */
	seats?: number;
}

export interface PolarOptions {
	/**
	 * Polar Client
	 */
	polarClient: Polar;
	/**
	 * Polar Webhook Secret
	 *
	 * @description Polar webhook secret key
	 */
	polarWebhookSecret: string;
	/**
	 * Enable customer creation when a user signs up
	 */
	createCustomerOnSignUp?: boolean;
	/**
	 * A callback to run after a customer has been created
	 * @param customer - Customer Data
	 * @param polarCustomer - Polar Customer Data
	 * @returns
	 */
	onCustomerCreate?: (
		data: {
			customer: Customer;
			polarCustomer: PolarCustomer;
			user: User;
		},
		request?: Request,
	) => Promise<void>;
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
	) => Promise<{}>;
	/**
	 * Subscriptions
	 */
	subscription?: {
		enabled: boolean;
		/**
		 * Subscription Configuration
		 */
		/**
		 * List of plan
		 */
		plans: SubscriptionPlan[] | (() => Promise<SubscriptionPlan[]>);
		/**
		 * Require email verification before a user is allowed to upgrade
		 * their subscriptions
		 *
		 * @default false
		 */
		requireEmailVerification?: boolean;
		/**
		 * A callback to run after a user has subscribed to a package
		 * @param event - Polar Event
		 * @param subscription - Subscription Data
		 * @returns
		 */
		onSubscriptionComplete?: (
			data: {
				event: WebhookSubscriptionCreatedPayload;
				polarSubscription: PolarSubscription;
				subscription: Subscription;
				plan: SubscriptionPlan;
			},
			request?: Request,
		) => Promise<void>;
		/**
		 * A callback to run after a user is about to cancel their subscription
		 * @returns
		 */
		onSubscriptionUpdate?: (data: {
			event: WebhookSubscriptionUpdatedPayload;
			subscription: Subscription;
		}) => Promise<void>;
		/**
		 * A callback to run after a user is about to cancel their subscription
		 * @returns
		 */
		onSubscriptionCancel?: (data: {
			event?: WebhookSubscriptionCanceledPayload;
			subscription: Subscription;
			polarSubscription: PolarSubscription;
			cancellationDetails?: CustomerCancellationReason | null;
		}) => Promise<void>;
		/**
		 * A function to check if the reference id is valid
		 * and belongs to the user
		 *
		 * @param data - data containing user, session and referenceId
		 * @param request - Request Object
		 * @returns
		 */
		authorizeReference?: (
			data: {
				user: User & Record<string, any>;
				session: Session & Record<string, any>;
				referenceId: string;
				action:
					| "upgrade-subscription"
					| "list-subscription"
					| "cancel-subscription";
			},
			request?: Request,
		) => Promise<boolean>;
		/**
		 * A callback to run after a user has deleted their subscription
		 * @returns
		 */
		onSubscriptionDeleted?: (data: {
			event: WebhookSubscriptionRevokedPayload;
			polarSubscription: PolarSubscription;
			subscription: Subscription;
		}) => Promise<void>;
		/**
		 * parameters for session create params
		 *
		 * @param data - data containing user, session and plan
		 * @param request - Request Object
		 */
		getCheckoutSessionParams?: (
			data: {
				user: User & Record<string, any>;
				session: Session & Record<string, any>;
				plan: SubscriptionPlan;
				subscription: Subscription;
			},
			request?: Request,
		) =>
			| Promise<{
					params?: CheckoutCreate;
			  }>
			| {
					params?: CheckoutCreate;
			  };
		/**
		 * Enable organization subscription
		 */
		organization?: {
			enabled: boolean;
		};
	};
	onEvent?: (event: ReturnType<typeof validateEvent>) => Promise<void>;
}

export interface Customer {
	id: string;
	polarCustomerId?: string;
	userId: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface InputSubscription extends Omit<Subscription, "id"> {}
export interface InputCustomer extends Omit<Customer, "id"> {}
