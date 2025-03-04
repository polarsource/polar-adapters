import type { Polar } from "@polar-sh/sdk";
import type { BetterAuthClientPlugin } from "better-auth";
import type { polar } from "./index";

export const polarClient = <
	O extends {
		checkout: boolean;
	},
>(
	_options?: O,
) => {
	return {
		id: "stripe-client",
		$InferServerPlugin: {} as ReturnType<
			typeof polar<
				O["checkout"] extends true
					? {
							client: Polar;
							webhookSecret: "";
							checkout: {
								enabled: true;
								products: [];
							};
						}
					: {
							client: Polar;
							webhookSecret: "";
						}
			>
		>,
	} satisfies BetterAuthClientPlugin;
};
