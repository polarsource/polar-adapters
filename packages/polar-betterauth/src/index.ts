import type { BetterAuthPlugin, GenericEndpointContext } from "better-auth";
import { getSessionFromCtx } from "better-auth/api";
import {
	onAfterUserCreate,
	onBeforeUserCreate,
	onUserDelete,
	onUserUpdate,
} from "./hooks/customer";
import type { GetExternalCustomerId, PolarEndpoints, PolarOptions, ResolvedPolarOptions } from "./types";

const defaultGetExternalCustomerId: GetExternalCustomerId = async (
	context: GenericEndpointContext
) => {
	const session = await getSessionFromCtx(context);
	return session?.user.id;
};

export { polarClient } from "./client";

export * from "./plugins/portal";
export * from "./plugins/checkout";
export * from "./plugins/usage";
export * from "./plugins/webhooks";

export const polar = <O extends PolarOptions>(options: O) => {
	const resolvedOptions: ResolvedPolarOptions = {
		...options,
		getExternalCustomerId:
			options.getExternalCustomerId ?? defaultGetExternalCustomerId,
	};

	const plugins = options.use
		.map((use) => use(resolvedOptions))
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
								before: onBeforeUserCreate(resolvedOptions),
								after: onAfterUserCreate(resolvedOptions),
							},
							update: {
								after: onUserUpdate(resolvedOptions),
							},
							delete: {
								after: onUserDelete(resolvedOptions),
							},
						},
					},
				},
			};
		},
	} satisfies BetterAuthPlugin;
};
