import type { BetterAuthPlugin } from "better-auth";
import { onUserCreate, onUserUpdate } from "./hooks/customer";
import type { PolarOptions } from "./types";
import { getSchema } from "./schema";
import type { checkout } from "./plugins/checkout";
import type { portal } from "./plugins/portal";
import type { webhooks } from "./plugins/webhooks";
import type { usage } from "./plugins/usage";

export { polarClient } from "./client";

export * from "./plugins/portal";
export * from "./plugins/checkout";
export * from "./plugins/usage";
export * from "./plugins/webhooks";

type PolarEndpoints = ReturnType<ReturnType<typeof checkout>> &
	ReturnType<ReturnType<typeof usage>> &
	ReturnType<ReturnType<typeof portal>> &
	ReturnType<ReturnType<typeof webhooks>>;

export const polar = <O extends PolarOptions>(options: O) => {
	return {
		id: "polar",
		endpoints: {
			...(options.use.reduce((acc, use) => {
				const endpoints = use(options.client);
				Object.assign(acc, endpoints);
				return acc;
			}, {}) as PolarEndpoints),
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
