import type { Session, User } from "better-auth";
import type { Polar } from "@polar-sh/sdk";
import type { Customer } from "@polar-sh/sdk/models/components/customer";
import type { WebhookSubscriptionUpdatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionupdatedpayload.js";
import type { WebhookSubscriptionCanceledPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncanceledpayload.js";
import type { CustomerCancellationReason } from "@polar-sh/sdk/models/components/customercancellationreason.js";
import type { Subscription } from "@polar-sh/sdk/models/components/subscription.js";
import type { WebhookSubscriptionRevokedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptionrevokedpayload.js";
import type { CheckoutCreate } from "@polar-sh/sdk/models/components/checkoutcreate.js";
import type { validateEvent } from "@polar-sh/sdk/webhooks.js";
import type { WebhookSubscriptionCreatedPayload } from "@polar-sh/sdk/models/components/webhooksubscriptioncreatedpayload.js";

export type SubscriptionProduct = {
	/**
	 * Subscription Product Id
	 */
	productId: string;
};

export interface PolarOptions {
	/**
	 * Polar Client
	 */
	client: Polar;
	/**
	 * Polar Webhook Secret
	 *
	 * @description Polar webhook secret key
	 */
	webhookSecret: string;
	/**
	 * Enable customer creation when a user signs up
	 */
	createCustomerOnSignUp?: boolean;
	/**
	 * A callback to run after a customer has been created
	 * @param customer - Polar Customer
	 * @returns
	 */
	onCustomerCreate?: (
		data: {
			customer: Customer;
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
	) => Promise<{
		metadata?: Record<string, string>;
	}>;
	/**
	 * Subscriptions
	 */
	subscription?: {
		enabled: boolean;
		/**
		 * Subscription Configuration
		 */
		/**
		 * List of products
		 */
		products: SubscriptionProduct[] | (() => Promise<SubscriptionProduct[]>);
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
				subscription: Subscription;
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
				user: User & Record<string, unknown>;
				session: Session & Record<string, unknown>;
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
				user: User & Record<string, unknown>;
				session: Session & Record<string, unknown>;
				product: SubscriptionProduct;
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
