import type { AuthPluginSchema } from "better-auth";
import type { PolarOptions } from "./types";

export const getSchema = (options: PolarOptions) => {
	const subscriptions = {
		subscription: {
			fields: {
				plan: {
					type: "string",
					required: true,
				},
				referenceId: {
					type: "string",
					required: true,
				},
				polarSubscriptionId: {
					type: "string",
					required: false,
				},
				status: {
					type: "string",
					defaultValue: "incomplete",
				},
				periodStart: {
					type: "date",
					required: false,
				},
				periodEnd: {
					type: "date",
					required: false,
				},
				cancelAtPeriodEnd: {
					type: "boolean",
					required: false,
					defaultValue: false,
				},
			},
		},
	} satisfies AuthPluginSchema;

	return {
		...(options.subscription?.enabled ? subscriptions : {}),
	} as typeof subscriptions;
};
