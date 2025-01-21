import {
	type WebhooksConfig,
	handleWebhookPayload,
} from "@polar-sh/adapter-utils";
import {
	WebhookVerificationError,
	validateEvent,
} from "@polar-sh/sdk/webhooks";
import type { Context } from "elysia";
import type { InlineHandler } from "elysia/dist/types";

export const Webhooks = ({
	webhookSecret,
	onPayload,
	entitlements,
	...eventHandlers
}: WebhooksConfig): InlineHandler => {
	return async (ctx: Context) => {
		const requestBody = await ctx.request.text();

		const webhookHeaders: Record<string, string> = {
			"webhook-id": ctx.request.headers.get("webhook-id") ?? "",
			"webhook-timestamp": ctx.request.headers.get("webhook-timestamp") ?? "",
			"webhook-signature": ctx.request.headers.get("webhook-signature") ?? "",
		};

		let webhookPayload: ReturnType<typeof validateEvent>;
		try {
			webhookPayload = validateEvent(
				requestBody,
				webhookHeaders,
				webhookSecret,
			);
		} catch (error) {
			console.log(error);
			if (error instanceof WebhookVerificationError) {
				return ctx.error(400, { received: false });
			}

			return ctx.error(500, { error: "Internal server error" });
		}

		await handleWebhookPayload(webhookPayload, {
			webhookSecret,
			entitlements,
			onPayload,
			...eventHandlers,
		});

		return { received: true };
	};
};
