import type { BetterAuthPlugin } from "better-auth";
import { checkout } from "./endpoints/checkout";
import { customerPortal } from "./endpoints/customerPortal";
import { customerState } from "./endpoints/customerState";
import { webhooks } from "./endpoints/webhooks";
import { onUserCreate, onUserUpdate } from "./hooks/customer";
import type { PolarOptions } from "./types";
import { getSchema } from "./schema";

export { polarClient } from "./client";

export const polar = <O extends PolarOptions>(options: O) => {
	return {
		id: "polar",
		endpoints: {
			polarWebhook: webhooks(options),
			checkout: checkout(options),
			customerPortal: customerPortal(options),
			customerState: customerState(options),
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
		schema: getSchema(options),
	} satisfies BetterAuthPlugin;
};
