import type { PolarOptions } from "../../types";
import { createMockPolarClient } from "./mocks";

export const createTestPolarOptions = (
	overrides: Partial<PolarOptions> = {},
): PolarOptions => ({
	client: createMockPolarClient(),
	createCustomerOnSignUp: true,
	use: [],
	...overrides,
});

export { createMockPolarClient };

export const mockApiError = (status: number, message: string) => {
	const error = new Error(message) as Error & {
		status: number;
		response: { status: number; data: { error: { message: string } } };
	};
	error.status = status;
	error.response = {
		status,
		data: { error: { message } },
	};
	return error;
};
