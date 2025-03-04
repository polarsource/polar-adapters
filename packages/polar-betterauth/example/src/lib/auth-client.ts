import { createAuthClient } from "better-auth/react";
export const authClient = createAuthClient({
	baseURL: "http://localhost:3001", // the base url of your auth server
});

export const { signIn, signUp, useSession } = authClient;
