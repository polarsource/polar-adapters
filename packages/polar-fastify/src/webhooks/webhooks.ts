import {
	type WebhooksConfig,
	handleWebhookPayload,
} from "@polar-sh/adapter-utils";
import {
	WebhookVerificationError,
	validateEvent,
} from "@polar-sh/sdk/webhooks";
import type { FastifyReply, FastifyRequest, RouteHandler } from "fastify";

export {
	EntitlementContext,
	EntitlementHandler,
	EntitlementProperties,
	EntitlementStrategy,
	Entitlements,
} from "@polar-sh/adapter-utils";

export const Webhooks = ({
	webhookSecret,
	onPayload,
	entitlements,
	...eventHandlers
}: WebhooksConfig): RouteHandler => {
	return async (request: FastifyRequest, reply: FastifyReply) => {
		const requestBody =
			typeof request.body === "string"
				? request.body
				: JSON.stringify(request.body);

		const webhookHeaders: Record<string, string> = {
			"webhook-id": request.headers["webhook-id"] as string,
			"webhook-timestamp": request.headers["webhook-timestamp"] as string,
			"webhook-signature": request.headers["webhook-signature"] as string,
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
				return reply.status(400).send({ received: false });
			}

			return reply.status(500).send({ error: "Internal server error" });
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
