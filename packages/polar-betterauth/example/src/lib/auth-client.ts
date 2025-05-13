import { createAuthClient } from "better-auth/react";
import { polarClient } from "@polar-sh/better-auth";
import { organizationClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
	baseURL: "http://localhost:3001", // the base url of your auth server
	plugins: [organizationClient(), polarClient({ checkout: true })],
});

export const { signIn, signUp, useSession } = authClient;
