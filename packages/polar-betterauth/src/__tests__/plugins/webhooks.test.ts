import { describe, expect, it, vi } from "vitest";
import { getTestInstance } from "better-auth/test";
import { polar, webhooks } from "../../index";
import { polarClient } from "../../client";
import { createMockPolarClient } from "../utils/mocks";

vi.mock("@polar-sh/adapter-utils", () => ({
	handleWebhookPayload: vi.fn(),
}));

vi.mock("@polar-sh/sdk/webhooks", () => ({
	validateEvent: vi.fn(),
}));

const { handleWebhookPayload } = (await vi.importMock(
	"@polar-sh/adapter-utils",
)) as any;
const { validateEvent } = (await vi.importMock(
	"@polar-sh/sdk/webhooks",
)) as any;

describe("webhooks plugin", () => {
	const setupTestInstance = async (
		webhookOptions: Parameters<typeof webhooks>[0],
	) => {
		const mockClient = createMockPolarClient();

		vi.mocked(mockClient.customers.list).mockResolvedValue({
			result: {
				items: [],
				pagination: { totalCount: 0, maxPage: 1 },
			},
		});

		const { auth } = await getTestInstance(
			{
				plugins: [
					polar({
						client: mockClient,
						use: [webhooks(webhookOptions)],
					}),
				],
			},
			{
				clientOptions: {
					plugins: [polarClient()],
				},
			},
		);

		return { auth, mockClient };
	};

	const createWebhookRequest = (
		body: string,
		headers: Record<string, string> = {},
	) => {
		const defaultHeaders = {
			"webhook-id": "wh_123",
			"webhook-timestamp": "1234567890",
			"webhook-signature": "v1,signature123",
			...headers,
		};

		return {
			headers: new Headers(defaultHeaders),
			text: vi.fn().mockResolvedValue(body),
			body,
		} as unknown as Request;
	};

	describe("webhook endpoint", () => {
		it("should process valid webhook successfully", async () => {
			const { auth } = await setupTestInstance({
				secret: "test-webhook-secret",
				onCheckoutCreated: vi.fn(),
			});

			const mockEvent = {
				type: "checkout.created",
				data: { id: "checkout-123" },
			};

			vi.mocked(validateEvent).mockReturnValue(mockEvent);
			vi.mocked(handleWebhookPayload).mockResolvedValue(undefined);

			const request = createWebhookRequest(
				'{"type": "checkout.created", "data": {}}',
			);

			const response = await auth.api.polarWebhooks({ request });

			expect(validateEvent).toHaveBeenCalledWith(
				'{"type": "checkout.created", "data": {}}',
				{
					"webhook-id": "wh_123",
					"webhook-timestamp": "1234567890",
					"webhook-signature": "v1,signature123",
				},
				"test-webhook-secret",
			);

			expect(handleWebhookPayload).toHaveBeenCalledWith(
				mockEvent,
				expect.objectContaining({
					webhookSecret: "test-webhook-secret",
				}),
			);

			expect(response).toEqual({ received: true });
		});

		it("should throw error when webhook secret is missing", async () => {
			const { auth } = await setupTestInstance({
				secret: "",
			});

			const request = createWebhookRequest('{"type": "test"}');

			await expect(auth.api.polarWebhooks({ request })).rejects.toThrow(
				"Polar webhook secret not found",
			);
		});

		it("should handle invalid webhook signature", async () => {
			const { auth } = await setupTestInstance({
				secret: "test-secret",
			});

			vi.mocked(validateEvent).mockImplementation(() => {
				throw new Error("Invalid signature");
			});

			const request = createWebhookRequest('{"type": "test"}');

			await expect(auth.api.polarWebhooks({ request })).rejects.toThrow(
				"Webhook Error: Invalid signature",
			);
		});

		it("should handle missing webhook headers", async () => {
			const { auth } = await setupTestInstance({
				secret: "test-secret",
			});

			vi.mocked(validateEvent).mockImplementation(() => {
				throw new Error("Missing required headers");
			});

			const request = {
				headers: new Headers({}),
				text: vi.fn().mockResolvedValue('{"type": "test"}'),
				body: '{"type": "test"}',
			} as unknown as Request;

			await expect(auth.api.polarWebhooks({ request })).rejects.toThrow(
				"Webhook Error: Missing required headers",
			);
		});

		it("should handle webhook payload processing errors", async () => {
			const { auth } = await setupTestInstance({
				secret: "test-secret",
			});

			const mockEvent = { type: "checkout.created", data: {} };
			vi.mocked(validateEvent).mockReturnValue(mockEvent);
			vi.mocked(handleWebhookPayload).mockRejectedValue(
				new Error("Handler processing failed"),
			);

			const request = createWebhookRequest('{"type": "checkout.created"}');

			await expect(auth.api.polarWebhooks({ request })).rejects.toThrow(
				"Webhook error: See server logs for more information.",
			);
		});

		it("should handle non-Error webhook payload failures", async () => {
			const { auth } = await setupTestInstance({
				secret: "test-secret",
			});

			const mockEvent = { type: "checkout.created", data: {} };
			vi.mocked(validateEvent).mockReturnValue(mockEvent);
			vi.mocked(handleWebhookPayload).mockRejectedValue("Unknown error");

			const request = createWebhookRequest('{"type": "checkout.created"}');

			await expect(auth.api.polarWebhooks({ request })).rejects.toThrow(
				"Webhook error: See server logs for more information.",
			);
		});

		it("should handle non-Error validation failures", async () => {
			const { auth } = await setupTestInstance({
				secret: "test-secret",
			});

			vi.mocked(validateEvent).mockImplementation(() => {
				throw "Unknown validation error";
			});

			const request = createWebhookRequest('{"type": "test"}');

			await expect(auth.api.polarWebhooks({ request })).rejects.toThrow(
				"Webhook Error: Unknown validation error",
			);
		});

		it("should pass all event handlers to handleWebhookPayload", async () => {
			const mockHandlers = {
				onPayload: vi.fn(),
				onCheckoutCreated: vi.fn(),
				onOrderPaid: vi.fn(),
				onSubscriptionActive: vi.fn(),
			};

			const { auth } = await setupTestInstance({
				secret: "test-secret",
				...mockHandlers,
			});

			const mockEvent = { type: "checkout.created", data: {} };
			vi.mocked(validateEvent).mockReturnValue(mockEvent);
			vi.mocked(handleWebhookPayload).mockResolvedValue(undefined);

			const request = createWebhookRequest('{"type": "checkout.created"}');

			await auth.api.polarWebhooks({ request });

			expect(handleWebhookPayload).toHaveBeenCalledWith(
				mockEvent,
				expect.objectContaining({
					webhookSecret: "test-secret",
					onPayload: mockHandlers.onPayload,
					onCheckoutCreated: mockHandlers.onCheckoutCreated,
					onOrderPaid: mockHandlers.onOrderPaid,
					onSubscriptionActive: mockHandlers.onSubscriptionActive,
				}),
			);
		});

		it("should handle different webhook event types", async () => {
			const { auth } = await setupTestInstance({
				secret: "test-secret",
			});

			const testCases = [
				{ type: "checkout.created", data: { id: "checkout-123" } },
				{ type: "order.paid", data: { id: "order-456" } },
				{ type: "subscription.active", data: { id: "sub-789" } },
				{ type: "customer.created", data: { id: "customer-abc" } },
			];

			for (const mockEvent of testCases) {
				vi.mocked(validateEvent).mockReturnValue(mockEvent);
				vi.mocked(handleWebhookPayload).mockResolvedValue(undefined);

				const request = createWebhookRequest(JSON.stringify(mockEvent));

				await auth.api.polarWebhooks({ request });

				expect(handleWebhookPayload).toHaveBeenCalledWith(
					mockEvent,
					expect.any(Object),
				);
			}
		});

		it("should extract headers correctly from request", async () => {
			const { auth } = await setupTestInstance({
				secret: "test-secret",
			});

			const mockEvent = { type: "test", data: {} };
			vi.mocked(validateEvent).mockReturnValue(mockEvent);
			vi.mocked(handleWebhookPayload).mockResolvedValue(undefined);

			const request = createWebhookRequest('{"type": "test"}', {
				"webhook-id": "custom-id-456",
				"webhook-timestamp": "9876543210",
				"webhook-signature": "v1,custom-signature",
			});

			await auth.api.polarWebhooks({ request });

			expect(validateEvent).toHaveBeenCalledWith(
				'{"type": "test"}',
				{
					"webhook-id": "custom-id-456",
					"webhook-timestamp": "9876543210",
					"webhook-signature": "v1,custom-signature",
				},
				"test-secret",
			);
		});
	});
});
