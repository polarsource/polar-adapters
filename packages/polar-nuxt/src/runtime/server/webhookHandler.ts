import {
	type WebhooksConfig,
	handleWebhookPayload,
} from "@polar-sh/adapter-utils";
import {
	WebhookVerificationError,
	validateEvent,
} from "@polar-sh/sdk/webhooks";
import { type H3Event, createError, getHeader, readBody } from "h3";

export interface CustomerPortalConfig {
	accessToken: string;
	server?: "sandbox" | "production";
	getCustomerId: (event: H3Event) => Promise<string>;
}

export const Webhooks = ({
	webhookSecret,
	onPayload,
	entitlements,
	...eventHandlers
}: WebhooksConfig) => {
	return async (event: H3Event) => {
		const requestBody = await readBody(event);

		const webhookHeaders = {
			"webhook-id": getHeader(event, "webhook-id") ?? "",
			"webhook-timestamp": getHeader(event, "webhook-timestamp") ?? "",
			"webhook-signature": getHeader(event, "webhook-signature") ?? "",
		};

		let webhookPayload: ReturnType<typeof validateEvent>;

		try {
			webhookPayload = validateEvent(
				JSON.stringify(requestBody),
				webhookHeaders,
				webhookSecret,
			);
		} catch (error) {
			if (error instanceof WebhookVerificationError) {
				return { received: false };
			}
			throw error;
		}

		try {
			await handleWebhookPayload(webhookPayload, {
				webhookSecret,
				entitlements,
				onPayload,
				...eventHandlers,
			});

			return { received: true };
		} catch (error) {
			console.error(error);
			throw createError({
				statusCode: 500,
				statusMessage: error.statusMessage,
				message: error.message ?? "Internal server error",
			});
		}
	};
};
