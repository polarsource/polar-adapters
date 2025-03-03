"use server";

import { auth } from "@/lib/auth";

export const signIn = async (email: string, password: string) => {
	await auth.api.signInEmail({
		body: {
			email,
			password,
		},
	});
};
