import type { BetterAuthClientPlugin } from "better-auth";
import type { CheckoutParams, polar } from "./index";
import type { BetterFetchOption } from "better-auth/client";
import { PolarEmbedCheckout } from "@polar-sh/checkout/embed";

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
