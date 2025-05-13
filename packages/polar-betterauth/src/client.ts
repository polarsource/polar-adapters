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
		id: "polar-client",
		$InferServerPlugin: {} as ReturnType<
			typeof polar<
				O["checkout"] extends true
					? {
							client: any;
							checkout: {
								enabled: true;
								products: [];
							};
						}
					: {
							client: any;
						}
			>
		>,
	} satisfies BetterAuthClientPlugin;
};
