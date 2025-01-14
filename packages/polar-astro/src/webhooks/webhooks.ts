import {
  type WebhooksConfig,
  handleWebhookPayload,
} from "@polar-sh/adapter-utils";
import {
  WebhookVerificationError,
  validateEvent,
} from "@polar-sh/sdk/webhooks";
import { APIRoute } from "astro";

export const Webhooks = ({
  webhookSecret,
  onPayload,
  ...eventHandlers
}: WebhooksConfig): APIRoute => {
  return async ({ request }) => {
    if (request.method !== "POST") {
      return Response.json({ message: "Method not allowed" }, { status: 405 });
    }

    const requestBody = await request.text();

    const webhookHeaders: Record<string, string> = {
      "webhook-id": request.headers.get("webhook-id") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
      "webhook-signature": request.headers.get("webhook-signature") ?? "",
    };

    let webhookPayload: ReturnType<typeof validateEvent>;
    try {
      webhookPayload = validateEvent(
        requestBody,
        webhookHeaders,
        webhookSecret
      );
    } catch (error) {
      console.log(error);
      if (error instanceof WebhookVerificationError) {
        return Response.json({ received: false }, { status: 403 });
      }

      return Response.json({ error: "Internal server error" }, { status: 500 });
    }

    await handleWebhookPayload(webhookPayload, {
      webhookSecret,
      onPayload,
      ...eventHandlers,
    });

    return Response.json({ received: true });
  };
};