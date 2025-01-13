import {
	type WebhooksConfig,
	handleWebhookPayload,
} from "@polar-sh/adapter-utils";
import {
	WebhookVerificationError,
	validateEvent,
} from "@polar-sh/sdk/webhooks";
import type { Request, RequestHandler, Response } from "express";

export const Webhooks = ({
	webhookSecret,
	onPayload,
	...eventHandlers
}: WebhooksConfig): RequestHandler => {
	return async (req: Request, res: Response) => {
		const requestBody = JSON.stringify(req.body);

		const webhookHeaders: Record<string, string> = {
			"webhook-id": req.headers["webhook-id"] as string,
			"webhook-timestamp": req.headers["webhook-timestamp"] as string,
			"webhook-signature": req.headers["webhook-signature"] as string,
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
				res.status(403).json({ received: false });
				return;
			}

			res.status(500).json({ error: "Internal server error" });
			return;
		}

		await handleWebhookPayload(webhookPayload, {
			webhookSecret,
			onPayload,
			...eventHandlers,
		});

		res.json({ received: true });
	};
};
