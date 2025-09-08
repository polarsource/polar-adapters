import type { GenericEndpointContext, User } from "better-auth";
import { APIError } from "better-auth/api";
import type { PolarOptions } from "../types";

export const onBeforeUserCreate =
	(options: PolarOptions) =>
	async (user: Partial<User>, context?: GenericEndpointContext | undefined) => {
		if (context && options.createCustomerOnSignUp) {
			try {
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

				await options.client.customers.create({
					...params,
					email: user.email,
					name: user.name,
				});
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
	(options: PolarOptions) =>
	async (user: User, context?: GenericEndpointContext | undefined) => {
		if (context && options.createCustomerOnSignUp) {
			try {
				const { result: existingCustomers } =
					await options.client.customers.list({ email: user.email });
				const existingCustomer = existingCustomers.items[0];

				if (existingCustomer) {
					if (existingCustomer.externalId !== user.id) {
						await options.client.customers.update({
							id: existingCustomer.id,
							customerUpdate: {
								externalId: user.id,
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
	(options: PolarOptions) =>
	async (user: User, context?: GenericEndpointContext | undefined) => {
		if (context && options.createCustomerOnSignUp) {
			try {
				await options.client.customers.updateExternal({
					externalId: user.id,
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
