import type { AuthPluginSchema } from "better-auth";
import type { PolarOptions } from "./types";
import { mergeSchema } from "better-auth/db";

export const subscriptions = {
	subscription: {
		fields: {
			userId: {
				type: "string",
				required: false,
			},
			subscriptionId: {
				type: "string",
				required: true,
			},
			referenceId: {
				type: "string",
				required: false,
			},
			status: {
				type: "string",
				defaultValue: "inactive",
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

export const getSchema = (options: PolarOptions) => {
	if (options.subscriptions?.schema && !options.subscriptions?.enabled) {
		options.subscriptions.schema.subscription = undefined;
	}

	return mergeSchema(
		{
			...(options.subscriptions?.enabled ? subscriptions : {}),
		},
		options.subscriptions?.schema,
	);
};
