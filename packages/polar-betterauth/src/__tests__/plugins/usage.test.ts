import { describe, expect, it, vi } from "vitest";
import { getTestInstance } from "better-auth/test";
import { polar, usage } from "../../index";
import { polarClient } from "../../client";
import { createMockPolarClient } from "../utils/mocks";

describe("usage plugin", () => {
	const setupTestInstance = async () => {
		const mockClient = createMockPolarClient();

		vi.mocked(mockClient.customers.list).mockResolvedValue({
			result: { items: [], pagination: { totalCount: 0, maxPage: 1 } },
		});
		vi.mocked(mockClient.customerSessions.create).mockResolvedValue({
			id: "session-123",
			token: "token-123",
			customerPortalUrl: "https://polar.sh/portal/123",
		});

		const { auth, client, signInWithTestUser } = await getTestInstance(
			{
				plugins: [
					polar({
						client: mockClient,
						use: [usage()],
					}),
				],
			},
			{ clientOptions: { plugins: [polarClient()] } },
		);

		const { headers } = await signInWithTestUser();
		return { auth, client, headers, mockClient };
	};

	describe("meters endpoint", () => {
		it("calls customerPortal.customerMeters.list with session token", async () => {
			const { client, headers, mockClient } = await setupTestInstance();
			vi.mocked(
				mockClient.customerPortal.customerMeters.list,
			).mockResolvedValue({ items: [] });

			await client.usage.meters.list(
				{ query: { page: 2, limit: 20 } },
				{ headers },
			);

			expect(
				mockClient.customerPortal.customerMeters.list,
			).toHaveBeenCalledWith(
				{ customerSession: "token-123" },
				{ page: 2, limit: 20 },
			);
		});

		it("handles errors", async () => {
			const { client, headers, mockClient } = await setupTestInstance();
			vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
				new Error("Failed"),
			);

			const { error } = await client.usage.meters.list(
				{ query: {} },
				{ headers },
			);

			expect(error?.message).toContain("Meters list failed");
		});
	});

	describe("ingestion endpoint", () => {
		it("calls events.ingest with event data and user ID", async () => {
			const { auth, headers, mockClient } = await setupTestInstance();
			vi.mocked(mockClient.events.ingest).mockResolvedValue({ success: true });

			await auth.api.ingestion({
				headers,
				body: {
					event: "api_call",
					metadata: { endpoint: "/api/users", count: 1 },
				},
			});

			expect(mockClient.events.ingest).toHaveBeenCalledWith({
				events: [
					{
						name: "api_call",
						metadata: { endpoint: "/api/users", count: 1 },
						externalCustomerId: expect.any(String),
					},
				],
			});
		});

		it("handles errors", async () => {
			const { auth, headers, mockClient } = await setupTestInstance();
			vi.mocked(mockClient.events.ingest).mockRejectedValue(
				new Error("Failed"),
			);

			await expect(
				auth.api.ingestion({
					headers,
					body: { event: "test", metadata: {} },
				}),
			).rejects.toThrow("Ingestion failed");
		});
	});
});
