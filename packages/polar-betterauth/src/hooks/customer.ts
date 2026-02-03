import type { GenericEndpointContext, User } from "better-auth";
import { APIError } from "better-auth/api";
import type { ResolvedPolarOptions } from "../types";

export const onBeforeUserCreate =
	(options: ResolvedPolarOptions) =>
	async (user: Partial<User>, context: GenericEndpointContext | null) => {
		if (context && options.createCustomerOnSignUp) {
			try {
				if (user.isAnonymous) {
					return;
				}

				const params = options.getCustomerCreateParams
					? await options.getCustomerCreateParams({
							user,
						})
					: {};

				if (!user.email) {
					throw new APIError("BAD_REQUEST", {
						message: "An associated email is required",
					});
				}

				// Check if customer already exists
				const { result: existingCustomers } =
					await options.client.customers.list({ email: user.email });
				const existingCustomer = existingCustomers.items[0];

				// Skip creation if customer already exists
				if (!existingCustomer) {
					await options.client.customers.create({
						...params,
						email: user.email,
						name: user.name,
					});
				}
			} catch (e: unknown) {
				if (e instanceof Error) {
					throw new APIError("INTERNAL_SERVER_ERROR", {
						message: `Polar customer creation failed. Error: ${e.message}`,
					});
				}

				throw new APIError("INTERNAL_SERVER_ERROR", {
					message: `Polar customer creation failed. Error: ${e}`,
				});
			}
		}
	};

export const onAfterUserCreate =
	(options: ResolvedPolarOptions) =>
	async (user: User, context: GenericEndpointContext | null) => {
		if (context && options.createCustomerOnSignUp) {
			if (user.isAnonymous) {
				return;
			}

			try {
				const externalCustomerId = await options.getExternalCustomerId(context) ?? user.id;

				const { result: existingCustomers } =
					await options.client.customers.list({ email: user.email });
				const existingCustomer = existingCustomers.items[0];

				if (existingCustomer) {
					if (existingCustomer.externalId !== externalCustomerId) {
						await options.client.customers.update({
							id: existingCustomer.id,
							customerUpdate: {
								externalId: externalCustomerId,
							},
						});
					}
				}
			} catch (e: unknown) {
				if (e instanceof Error) {
					throw new APIError("INTERNAL_SERVER_ERROR", {
						message: `Polar customer creation failed. Error: ${e.message}`,
					});
				}

				throw new APIError("INTERNAL_SERVER_ERROR", {
					message: `Polar customer creation failed. Error: ${e}`,
				});
			}
		}
	};

export const onUserUpdate =
	(options: ResolvedPolarOptions) =>
	async (user: User, context: GenericEndpointContext | null) => {
		if (context && options.createCustomerOnSignUp) {
			try {
				if (user.isAnonymous) {
					return;
				}

				const externalCustomerId = await options.getExternalCustomerId(context) ?? user.id;

				await options.client.customers.updateExternal({
					externalId: externalCustomerId,
					customerUpdateExternalID: {
						email: user.email,
						name: user.name,
					},
				});
			} catch (e: unknown) {
				if (e instanceof Error) {
					context.context.logger.error(
						`Polar customer update failed. Error: ${e.message}`,
					);
				} else {
					context.context.logger.error(
						`Polar customer update failed. Error: ${e}`,
					);
				}
			}
		}
	};

export const onUserDelete =
	(options: ResolvedPolarOptions) =>
	async (user: User, context: GenericEndpointContext | null) => {
		if (context && options.createCustomerOnSignUp) {
			try {
				if (user.isAnonymous) {
					return;
				}

				if (user.email) {
					const { result: existingCustomers } =
						await options.client.customers.list({ email: user.email });
					const existingCustomer = existingCustomers.items[0];
					if (existingCustomer) {
						await options.client.customers.delete({
							id: existingCustomer.id,
						});
					}
				}
			} catch (e: unknown) {
				if (e instanceof Error) {
					context?.context.logger.error(
						`Polar customer delete failed. Error: ${e.message}`,
					);
					return;
				}
				context?.context.logger.error(
					`Polar customer delete failed. Error: ${e}`,
				);
			}
		}
	};
