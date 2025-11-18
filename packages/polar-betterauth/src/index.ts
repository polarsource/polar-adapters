import type { BetterAuthPlugin } from "better-auth";
import {
	onAfterUserCreate,
	onBeforeUserCreate,
	onUserDelete,
	onUserUpdate,
} from "./hooks/customer";
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
								before: onBeforeUserCreate(options),
								after: onAfterUserCreate(options),
							},
							update: {
								after: onUserUpdate(options),
							},
							delete: {
								after: onUserDelete(options),
							},
						},
					},
				},
			};
		},
	} satisfies BetterAuthPlugin;
};
