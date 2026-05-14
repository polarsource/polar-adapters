import type { GenericEndpointContext, User } from "better-auth";
import { APIError } from "better-auth/api";
import type { PolarOptions } from "../types";

export const onAfterUserCreate =
	(options: PolarOptions) =>
	async (user: User, context: GenericEndpointContext | null) => {
		if (context && options.createCustomerOnSignUp) {
			if (user.isAnonymous) {
				return;
			}

			try {
				const params = options.getCustomerCreateParams
					? await options.getCustomerCreateParams({
							user,
						})
					: {};

				const { result: existingCustomers } =
					await options.client.customers.list({ email: user.email });
				const existingCustomer = existingCustomers.items[0];

				if (!existingCustomer) {
					await options.client.customers.create({
						...params,
						email: user.email,
						name: user.name,
						externalId: user.id,
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

export const onUserUpdate =
	(options: PolarOptions) =>
	async (user: User, context: GenericEndpointContext | null) => {
		if (context && options.createCustomerOnSignUp) {
			try {
				if (user.isAnonymous) {
					return;
				}

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

export const onUserDelete =
	(options: PolarOptions) =>
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
