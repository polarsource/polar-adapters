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
		options: Parameters<typeof webhooks>[0],
	) => {
		const mockClient = createMockPolarClient();

		const { auth } = await getTestInstance(
			{
				plugins: [
					polar({
						client: mockClient,
						use: [webhooks(options)],
					}),
				],
			},
			{ clientOptions: { plugins: [polarClient()] } },
		);

		return { auth };
	};

	const createRequest = (body: string, headers: Record<string, string> = {}) =>
		({
			headers: new Headers({
				"webhook-id": "wh_123",
				"webhook-timestamp": "1234567890",
				"webhook-signature": "v1,sig",
				...headers,
			}),
			text: vi.fn().mockResolvedValue(body),
			body,
		}) as unknown as Request;

	it("validates webhook and calls handleWebhookPayload", async () => {
		const onOrderPaid = vi.fn();
		const { auth } = await setupTestInstance({
			secret: "test-secret",
			onOrderPaid,
		});

		const event = { type: "order.paid", data: { id: "order-123" } };
		vi.mocked(validateEvent).mockReturnValue(event);
		vi.mocked(handleWebhookPayload).mockResolvedValue(undefined);

		const request = createRequest(JSON.stringify(event));
		await auth.api.polarWebhooks({ request });

		expect(validateEvent).toHaveBeenCalledWith(
			JSON.stringify(event),
			{
				"webhook-id": "wh_123",
				"webhook-timestamp": "1234567890",
				"webhook-signature": "v1,sig",
			},
			"test-secret",
		);

		expect(handleWebhookPayload).toHaveBeenCalledWith(
			event,
			expect.objectContaining({
				webhookSecret: "test-secret",
				onOrderPaid,
			}),
		);
	});

	it("throws when secret is missing", async () => {
		const { auth } = await setupTestInstance({ secret: "" });
		const request = createRequest("{}");

		await expect(auth.api.polarWebhooks({ request })).rejects.toThrow(
			"webhook secret not found",
		);
	});

	it("throws on invalid signature", async () => {
		const { auth } = await setupTestInstance({ secret: "test-secret" });
		vi.mocked(validateEvent).mockImplementation(() => {
			throw new Error("Invalid signature");
		});

		const request = createRequest("{}");

		await expect(auth.api.polarWebhooks({ request })).rejects.toThrow(
			"Webhook Error: Invalid signature",
		);
	});

	it("throws on handler error", async () => {
		const { auth } = await setupTestInstance({ secret: "test-secret" });
		vi.mocked(validateEvent).mockReturnValue({ type: "test", data: {} });
		vi.mocked(handleWebhookPayload).mockRejectedValue(new Error("Handler failed"));

		const request = createRequest("{}");

		await expect(auth.api.polarWebhooks({ request })).rejects.toThrow(
			"Webhook error",
		);
	});
});
