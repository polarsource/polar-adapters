import { describe, expect, it, vi } from "vitest";
import { getTestInstance } from "better-auth/test";
import { polar, usage } from "../../index";
import { polarClient } from "../../client";
import { createMockCustomer, createMockPolarClient } from "../utils/mocks";

describe("usage plugin", () => {
	const setupTestInstance = async (usageOptions: Parameters<typeof usage>[0] = {}) => {
		const mockClient = createMockPolarClient();
		const mockCustomer = createMockCustomer();

		vi.mocked(mockClient.customers.list).mockResolvedValue({
			result: {
				items: [],
				pagination: { totalCount: 0, maxPage: 1 },
			},
		});
		vi.mocked(mockClient.customers.create).mockResolvedValue(mockCustomer);

		const { auth, client, signInWithTestUser } = await getTestInstance(
			{
				plugins: [
					polar({
						client: mockClient,
						createCustomerOnSignUp: true,
						use: [usage(usageOptions)],
					}),
				],
			},
			{
				clientOptions: {
					plugins: [polarClient()],
				},
			},
		);

		const { headers } = await signInWithTestUser();

		return { auth, client, headers, mockClient };
	};

	describe("meters endpoint", () => {
		it("should list customer meters with pagination", async () => {
			const { client, headers, mockClient } = await setupTestInstance();

			vi.mocked(mockClient.customerSessions.create).mockResolvedValue({
				id: "session-123",
				token: "session-token-123",
				customerPortalUrl: "https://polar.sh/portal",
				createdAt: new Date(),
				modifiedAt: new Date(),
				expiresAt: new Date(Date.now() + 1000 * 60 * 60),
				customerId: "customer-123",
			});

			const mockMeters = {
				items: [
					{
						id: "meter-1",
						name: "API Calls",
						slug: "api-calls",
						currentBalance: 100,
						limit: 1000,
					},
					{
						id: "meter-2",
						name: "Storage",
						slug: "storage",
						currentBalance: 250,
						limit: 500,
					},
				],
				pagination: { totalCount: 2, maxPage: 1 },
			};

			vi.mocked(mockClient.customerPortal.customerMeters.list).mockResolvedValue(
				mockMeters,
			);

			const { data } = await client.usage.meters.list(
				{ query: { page: 1, limit: 10 } },
				{ headers },
			);

			expect(mockClient.customerSessions.create).toHaveBeenCalledWith({
				externalCustomerId: expect.any(String),
			});

			expect(mockClient.customerPortal.customerMeters.list).toHaveBeenCalledWith(
				{ customerSession: "session-token-123" },
				{ page: 1, limit: 10 },
			);

			expect(data).toEqual(mockMeters);
		});

		it("should handle missing pagination parameters", async () => {
			const { client, headers, mockClient } = await setupTestInstance();

			vi.mocked(mockClient.customerSessions.create).mockResolvedValue({
				id: "session-123",
				token: "session-token-123",
				customerPortalUrl: "https://polar.sh/portal",
				createdAt: new Date(),
				modifiedAt: new Date(),
				expiresAt: new Date(Date.now() + 1000 * 60 * 60),
				customerId: "customer-123",
			});

			const mockMeters = { items: [], pagination: { totalCount: 0, maxPage: 1 } };

			vi.mocked(mockClient.customerPortal.customerMeters.list).mockResolvedValue(
				mockMeters,
			);

			await client.usage.meters.list({ query: {} }, { headers });

			expect(mockClient.customerPortal.customerMeters.list).toHaveBeenCalledWith(
				{ customerSession: "session-token-123" },
				{ page: undefined, limit: undefined },
			);
		});

		it("should handle customer session creation failure", async () => {
			const { client, headers, mockClient } = await setupTestInstance();

			vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
				new Error("Customer not found"),
			);

			const { error } = await client.usage.meters.list(
				{ query: {} },
				{ headers },
			);

			expect(error?.message).toContain("Meters list failed");
		});

		it("should handle meters list API failure", async () => {
			const { client, headers, mockClient } = await setupTestInstance();

			vi.mocked(mockClient.customerSessions.create).mockResolvedValue({
				id: "session-123",
				token: "session-token-123",
				customerPortalUrl: "https://polar.sh/portal",
				createdAt: new Date(),
				modifiedAt: new Date(),
				expiresAt: new Date(Date.now() + 1000 * 60 * 60),
				customerId: "customer-123",
			});

			vi.mocked(mockClient.customerPortal.customerMeters.list).mockRejectedValue(
				new Error("Internal server error"),
			);

			const { error } = await client.usage.meters.list(
				{ query: {} },
				{ headers },
			);

			expect(error?.message).toContain("Meters list failed");
		});
	});

	describe("ingestion endpoint", () => {
		it("should ingest usage event", async () => {
			const { auth, headers, mockClient } = await setupTestInstance();

			const mockIngestion = {
				success: true,
				events: [
					{
						id: "event-123",
						name: "api_call",
						processed: true,
					},
				],
			};

			vi.mocked(mockClient.events.ingest).mockResolvedValue(mockIngestion);

			// Use auth.api directly since /usage/ingest doesn't end in /list
			const response = await auth.api.ingestion({
				headers,
				body: {
					event: "api_call",
					metadata: {
						endpoint: "/api/users",
						method: "GET",
						responseTime: 150,
					},
				},
			});

			expect(mockClient.events.ingest).toHaveBeenCalledWith({
				events: [
					{
						name: "api_call",
						metadata: {
							endpoint: "/api/users",
							method: "GET",
							responseTime: 150,
						},
						externalCustomerId: expect.any(String),
					},
				],
			});

			expect(response).toEqual(mockIngestion);
		});

		it("should handle string metadata values", async () => {
			const { auth, headers, mockClient } = await setupTestInstance();

			const mockIngestion = { success: true, events: [] };
			vi.mocked(mockClient.events.ingest).mockResolvedValue(mockIngestion);

			await auth.api.ingestion({
				headers,
				body: {
					event: "document_processed",
					metadata: {
						documentId: "doc-456",
						fileName: "report.pdf",
						size: 1024,
						processed: true,
					},
				},
			});

			expect(mockClient.events.ingest).toHaveBeenCalledWith({
				events: [
					{
						name: "document_processed",
						metadata: {
							documentId: "doc-456",
							fileName: "report.pdf",
							size: 1024,
							processed: true,
						},
						externalCustomerId: expect.any(String),
					},
				],
			});
		});

		it("should handle mixed metadata types", async () => {
			const { auth, headers, mockClient } = await setupTestInstance();

			const mockIngestion = { success: true, events: [] };
			vi.mocked(mockClient.events.ingest).mockResolvedValue(mockIngestion);

			await auth.api.ingestion({
				headers,
				body: {
					event: "mixed_event",
					metadata: {
						stringValue: "test",
						numberValue: 42,
						booleanValue: false,
					},
				},
			});

			expect(mockClient.events.ingest).toHaveBeenCalledWith({
				events: [
					{
						name: "mixed_event",
						metadata: {
							stringValue: "test",
							numberValue: 42,
							booleanValue: false,
						},
						externalCustomerId: expect.any(String),
					},
				],
			});
		});

		it("should handle ingestion API failure", async () => {
			const { auth, headers, mockClient } = await setupTestInstance();

			vi.mocked(mockClient.events.ingest).mockRejectedValue(
				new Error("Invalid event data"),
			);

			await expect(
				auth.api.ingestion({
					headers,
					body: {
						event: "invalid_event",
						metadata: { test: "data" },
					},
				}),
			).rejects.toThrow("Ingestion failed");
		});

		it("should handle network errors", async () => {
			const { auth, headers, mockClient } = await setupTestInstance();

			vi.mocked(mockClient.events.ingest).mockRejectedValue(
				new Error("Network timeout"),
			);

			await expect(
				auth.api.ingestion({
					headers,
					body: {
						event: "network_test",
						metadata: { test: "data" },
					},
				}),
			).rejects.toThrow("Ingestion failed");
		});
	});
});
