"use server";

import { auth } from "@/lib/auth";

export const register = async (
	name: string,
	email: string,
	password: string,
) => {
	await auth.api.signUpEmail({
		body: {
			email,
			password,
			name,
		},
	});
};
