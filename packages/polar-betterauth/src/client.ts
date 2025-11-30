import type { BetterAuthPlugin } from "better-auth";
import {
	onAfterUserCreate,
	onBeforeUserCreate,
	onUserDelete,
	onUserUpdate,
} from "./hooks/customer";
import type { PolarEndpoints, PolarOptions } from "./types";
import { PolarEmbedCheckout } from "@polar-sh/checkout/embed";
import type { BetterAuthClientPlugin } from "better-auth";
import type { BetterFetchOption } from "better-auth/client";
import type { CheckoutParams } from "./shared-types";

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

export const polarClient = () => {
	return {
		id: "polar-client",
		$InferServerPlugin: {} as ReturnType<typeof polar>,
		getActions: ($fetch) => {
			return {
				checkoutEmbed: async (
					data: Omit<CheckoutParams, "redirect" | "embedOrigin">,
					fetchOptions?: BetterFetchOption,
				) => {
					const res = await $fetch("/checkout", {
						method: "POST",
						body: {
							...data,
							redirect: false,
							embedOrigin: window.location.origin,
						},
						...fetchOptions,
					});

					if (res.error) {
						throw new Error(res.error.message);
					}

					const checkout = res.data as { url: string };

					const theme =
						(new URL(checkout.url).searchParams.get("theme") as
							| "light"
							| "dark"
							| undefined) ?? "light";

					return await PolarEmbedCheckout.create(checkout.url, theme);
				},
			};
		},
	} satisfies BetterAuthClientPlugin;
};
