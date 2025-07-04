import type { BetterAuthPlugin } from "better-auth";
import { beforeUserCreate, onUserCreate, onUserUpdate } from "./hooks/customer";
import type { PolarEndpoints, PolarOptions } from "./types";

export { polarClient } from "./client";

export * from "./plugins/portal";
export * from "./plugins/checkout";
export * from "./plugins/usage";
export * from "./plugins/webhooks";

export const polar = <O extends PolarOptions>(options: O) => {
	const plugins = options.use
		.map((use) => use(options.client))
		.reduce((acc, plugin) => {
			Object.assign(acc, plugin);
			return acc;
		}, {} as PolarEndpoints);

	return {
		id: "polar",
		endpoints: {
			...plugins,
		},
		init() {
			return {
				options: {
					databaseHooks: {
						user: {
							create: {
								before: beforeUserCreate(options),
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
