// Mock the modules before any imports
vi.mock("@polar-sh/sdk/webhooks", () => {
	class WebhookVerificationError extends Error {
		constructor(message: string) {
			super(message);
			this.name = "WebhookVerificationError";
		}
	}

	return {
		validateEvent: vi.fn((body: string) => ({
			type: "order.created",
			data: { id: "order-123" },
		})),
		WebhookVerificationError,
	};
});

vi.mock("@polar-sh/adapter-utils", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@polar-sh/adapter-utils")>();
	return {
		...actual,
		handleWebhookPayload: vi.fn(async () => {}),
	};
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { Webhooks } from "./webhooks";
import { validateEvent, WebhookVerificationError } from "@polar-sh/sdk/webhooks";
import { handleWebhookPayload } from "@polar-sh/adapter-utils";

// Get the mocked functions
const mockValidateEvent = vi.mocked(validateEvent);
const mockHandleWebhookPayload = vi.mocked(handleWebhookPayload);

describe("Webhooks", () => {
	beforeEach(() => {
		mockValidateEvent.mockClear();
		mockHandleWebhookPayload.mockClear();
		mockValidateEvent.mockReturnValue({
			type: "order.created",
			data: { id: "order-123" },
		});
	});

	describe("configuration", () => {
		it("should create webhook handler function", () => {
			const handler = Webhooks({
				webhookSecret: "test-secret",
			});

			expect(handler).toBeDefined();
			expect(typeof handler).toBe("function");
		});
	});

	describe("request handling", () => {
		it("should validate webhook and return success", async () => {
			const mockPayload = {
				type: "order.created",
				data: { id: "order-123" },
			};

			mockValidateEvent.mockReturnValue(mockPayload);

			const handler = Webhooks({
				webhookSecret: "test-secret",
			});

			const request = new Request("https://example.com/webhooks", {
				method: "POST",
				headers: {
					"webhook-id": "msg_123",
					"webhook-timestamp": "1234567890",
					"webhook-signature": "v1,signature",
					"content-type": "application/json",
				},
				body: JSON.stringify(mockPayload),
			});

			const response = await handler(request);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.received).toBe(true);
			expect(mockValidateEvent).toHaveBeenCalledTimes(1);
			expect(mockHandleWebhookPayload).toHaveBeenCalledTimes(1);
			expect(mockHandleWebhookPayload).toHaveBeenCalledWith(mockPayload, {
				webhookSecret: "test-secret",
			});
		});

		it("should return 403 on verification error", async () => {
			mockValidateEvent.mockImplementation(() => {
				throw new WebhookVerificationError("Invalid signature");
			});

			const handler = Webhooks({
				webhookSecret: "test-secret",
			});

			const request = new Request("https://example.com/webhooks", {
				method: "POST",
				headers: {
					"webhook-id": "msg_123",
					"webhook-timestamp": "1234567890",
					"webhook-signature": "invalid",
				},
				body: "{}",
			});

			const response = await handler(request);
			const data = await response.json();

			expect(response.status).toBe(403);
			expect(data.received).toBe(false);
		});

		it("should call event handlers", async () => {
			const mockPayload = {
				type: "order.created",
				data: { id: "order-123" },
			};

			mockValidateEvent.mockReturnValue(mockPayload);

			const onOrderCreated = vi.fn();

			const handler = Webhooks({
				webhookSecret: "test-secret",
				onOrderCreated,
			});

			const request = new Request("https://example.com/webhooks", {
				method: "POST",
				headers: {
					"webhook-id": "msg_123",
					"webhook-timestamp": "1234567890",
					"webhook-signature": "v1,signature",
				},
				body: JSON.stringify(mockPayload),
			});

			await handler(request);

			expect(mockHandleWebhookPayload).toHaveBeenCalledTimes(1);
			expect(mockHandleWebhookPayload).toHaveBeenCalledWith(mockPayload, {
				webhookSecret: "test-secret",
				onOrderCreated,
			});
		});

		it("should pass onPayload handler", async () => {
			const mockPayload = {
				type: "subscription.created",
				data: { id: "sub-123" },
			};

			mockValidateEvent.mockReturnValue(mockPayload);

			const onPayload = vi.fn();

			const handler = Webhooks({
				webhookSecret: "test-secret",
				onPayload,
			});

			const request = new Request("https://example.com/webhooks", {
				method: "POST",
				headers: {
					"webhook-id": "msg_123",
					"webhook-timestamp": "1234567890",
					"webhook-signature": "v1,signature",
				},
				body: JSON.stringify(mockPayload),
			});

			await handler(request);

			expect(mockHandleWebhookPayload).toHaveBeenCalledTimes(1);
			expect(mockHandleWebhookPayload).toHaveBeenCalledWith(mockPayload, {
				webhookSecret: "test-secret",
				onPayload,
			});
		});

		it("should extract webhook headers correctly", async () => {
			const mockPayload = {
				type: "checkout.updated",
				data: { id: "checkout-123" },
			};

			mockValidateEvent.mockReturnValue(mockPayload);

			const handler = Webhooks({
				webhookSecret: "test-secret",
			});

			const request = new Request("https://example.com/webhooks", {
				method: "POST",
				headers: {
					"webhook-id": "msg_456",
					"webhook-timestamp": "9876543210",
					"webhook-signature": "v1,abc123",
				},
				body: JSON.stringify(mockPayload),
			});

			await handler(request);

			expect(mockValidateEvent).toHaveBeenCalledTimes(1);
			expect(mockValidateEvent).toHaveBeenCalledWith(
				JSON.stringify(mockPayload),
				{
					"webhook-id": "msg_456",
					"webhook-timestamp": "9876543210",
					"webhook-signature": "v1,abc123",
				},
				"test-secret",
			);
		});

		it("should handle missing webhook headers", async () => {
			const mockPayload = {
				type: "product.created",
				data: { id: "product-123" },
			};

			mockValidateEvent.mockReturnValue(mockPayload);

			const handler = Webhooks({
				webhookSecret: "test-secret",
			});

			const request = new Request("https://example.com/webhooks", {
				method: "POST",
				body: JSON.stringify(mockPayload),
			});

			await handler(request);

			expect(mockValidateEvent).toHaveBeenCalledTimes(1);
			expect(mockValidateEvent).toHaveBeenCalledWith(
				JSON.stringify(mockPayload),
				{
					"webhook-id": "",
					"webhook-timestamp": "",
					"webhook-signature": "",
				},
				"test-secret",
			);
		});
	});
});
