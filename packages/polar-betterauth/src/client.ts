import type { BetterAuthClientPlugin } from "better-auth";
import type { polar } from "./index";

export const polarClient = () => {
	return {
		id: "polar-client",
		$InferServerPlugin: {} as ReturnType<typeof polar>,
	} satisfies BetterAuthClientPlugin;
};
