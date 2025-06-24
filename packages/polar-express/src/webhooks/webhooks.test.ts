vi.mock("@polar-sh/sdk/webhooks", async (importOriginal) => {
	return {
		...(await importOriginal()),
		WebhookVerificationError: vi.fn(),
		validateEvent: vi.fn((v) => JSON.parse(v)),
	};
});

import express from "express";
import supertest from "supertest";
import { describe, expect, it, vi } from "vitest";
import { Webhooks } from "./webhooks";

describe("Webhooks middleware", () => {
	it("should call onPayload with the payload", async () => {
		const app = express();
		const mockOnPayload = vi.fn();

		app.use(express.json()).post(
			"*",
			Webhooks({
				webhookSecret: "mock-secret",
				onPayload: mockOnPayload,
			}),
		);

		const payload = { event: "mock-event", data: "mock-data" };

		const res = await supertest(app)
			.post("/")
			.send(payload)
			.set("webhook-id", "mock-id")
			.set("webhook-timestamp", "mock-timestamp")
			.set("webhook-signature", "mock-signature");
		expect(res.status).toBe(200);
		expect(mockOnPayload).toHaveBeenCalledWith(payload);
	});

	it("should acknowledge the webhook", async () => {
		const app = express();
		const mockOnPayload = vi.fn();

		app.use(express.json()).post(
			"*",
			Webhooks({
				webhookSecret: "mock-secret",
				onPayload: mockOnPayload,
			}),
		);

		const payload = { event: "mock-event", data: "mock-data" };

		const res = await supertest(app)
			.post("/")
			.send(payload)
			.set("webhook-id", "mock-id")
			.set("webhook-timestamp", "mock-timestamp")
			.set("webhook-signature", "mock-signature");
		expect(res.status).toBe(200);
		expect(res.body).toEqual({ received: true });
	});
});
