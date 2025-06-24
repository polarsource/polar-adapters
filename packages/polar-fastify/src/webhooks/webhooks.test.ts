vi.mock("@polar-sh/sdk/webhooks", async (importOriginal) => {
	return {
		...(await importOriginal()),
		WebhookVerificationError: vi.fn(),
		validateEvent: vi.fn((v) => JSON.parse(v)),
	};
});

import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { Webhooks } from "./webhooks";

describe("Webhooks middleware", () => {
	it("should call onPayload with the payload", async () => {
		const app = fastify();
		const mockOnPayload = vi.fn();

		app.post(
			"*",
			Webhooks({
				webhookSecret: "mock-secret",
				onPayload: mockOnPayload,
			}),
		);

		const payload = { event: "mock-event", data: "mock-data" };

		const response = await app.inject({
			url: "http://localhost/",
			method: "POST",
			body: JSON.stringify(payload),
			headers: {
				"webhook-id": "mock-id",
				"webhook-timestamp": "mock-timestamp",
				"webhook-signature": "mock-signature",
				"content-type": "application/json",
			},
		});

		expect(response.statusCode).toBe(200);
		expect(mockOnPayload).toHaveBeenCalledWith(payload);
	});

	it("should acknowledge the webhook", async () => {
		const app = fastify();
		const mockOnPayload = vi.fn();

		app.post(
			"*",
			Webhooks({
				webhookSecret: "mock-secret",
				onPayload: mockOnPayload,
			}),
		);

		const payload = { event: "mock-event", data: "mock-data" };

		const response = await app.inject({
			url: "http://localhost/",
			method: "POST",
			body: JSON.stringify(payload),
			headers: {
				"webhook-id": "mock-id",
				"webhook-timestamp": "mock-timestamp",
				"webhook-signature": "mock-signature",
				"content-type": "application/json",
			},
		});

		expect(response.statusCode).toBe(200);
		expect(response.json()).toEqual({ received: true });
	});
});
