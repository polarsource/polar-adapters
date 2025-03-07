import type { BetterAuthPlugin } from "better-auth";
import { checkout } from "./endpoints/checkout";
import { customerPortal } from "./endpoints/customerPortal";
import { customerState } from "./endpoints/customerState";
import { webhooks } from "./endpoints/webhooks";
import { onUserCreate, onUserUpdate } from "./hooks/customer";
import type { PolarOptions } from "./types";

export const polar = <O extends PolarOptions>(options: O) => {
	return {
		id: "polar",
		endpoints: {
			polarCheckout: checkout(options),
			polarWebhooks: webhooks(options),
			polarCustomerPortal: customerPortal(options),
			polarCustomerState: customerState(options),
		},
		init() {
			return {
				options: {
					databaseHooks: {
						user: {
							create: {
								after: onUserCreate(options),
							},
							update: {
								after: onUserUpdate(options),
							},
						},
					},
				},
			};
		},
	} satisfies BetterAuthPlugin;
};
