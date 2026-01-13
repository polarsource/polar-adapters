import { describe, expect, it, vi } from "vitest";
import { getTestInstance } from "better-auth/test";
import { polar, portal } from "../../index";
import { polarClient } from "../../client";
import { createMockPolarClient } from "../utils/mocks";

describe("portal plugin", () => {
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
						use: [portal()],
					}),
				],
			},
			{ clientOptions: { plugins: [polarClient()] } },
		);

		const { headers } = await signInWithTestUser();
		return { auth, client, headers, mockClient };
	};

	describe("portal endpoint", () => {
		it("calls customerSessions.create with user ID", async () => {
			const { auth, headers, mockClient } = await setupTestInstance();

			await auth.api.portal({ headers });

			expect(mockClient.customerSessions.create).toHaveBeenCalledWith({
				externalCustomerId: expect.any(String),
				returnUrl: undefined,
			});
		});

		it("handles errors", async () => {
			const { auth, headers, mockClient } = await setupTestInstance();
			vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
				new Error("Not found"),
			);

			await expect(auth.api.portal({ headers })).rejects.toThrow(
				"Customer portal creation failed",
			);
		});
	});

	describe("state endpoint", () => {
		it("calls customers.getStateExternal with user ID", async () => {
			const { auth, headers, mockClient } = await setupTestInstance();
			vi.mocked(mockClient.customers.getStateExternal).mockResolvedValue({});

			await auth.api.state({ headers });

			expect(mockClient.customers.getStateExternal).toHaveBeenCalledWith({
				externalId: expect.any(String),
			});
		});

		it("handles errors", async () => {
			const { auth, headers, mockClient } = await setupTestInstance();
			vi.mocked(mockClient.customers.getStateExternal).mockRejectedValue(
				new Error("Not found"),
			);

			await expect(auth.api.state({ headers })).rejects.toThrow(
				"Subscriptions list failed",
			);
		});
	});

	describe("benefits endpoint", () => {
		it("calls customerPortal.benefitGrants.list with session token", async () => {
			const { client, headers, mockClient } = await setupTestInstance();
			vi.mocked(mockClient.customerPortal.benefitGrants.list).mockResolvedValue(
				{ items: [] },
			);

			await client.customer.benefits.list(
				{ query: { page: 2, limit: 20 } },
				{ headers },
			);

			expect(mockClient.customerPortal.benefitGrants.list).toHaveBeenCalledWith(
				{ customerSession: "token-123" },
				{ page: 2, limit: 20 },
			);
		});

		it("handles errors", async () => {
			const { client, headers, mockClient } = await setupTestInstance();
			vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
				new Error("Failed"),
			);

			const { error } = await client.customer.benefits.list(
				{ query: {} },
				{ headers },
			);

			expect(error?.message).toContain("Benefits list failed");
		});
	});

	describe("subscriptions endpoint", () => {
		it("calls customerPortal.subscriptions.list with session token", async () => {
			const { client, headers, mockClient } = await setupTestInstance();
			vi.mocked(
				mockClient.customerPortal.subscriptions.list,
			).mockResolvedValue({ items: [] });

			await client.customer.subscriptions.list(
				{ query: { page: 1, limit: 10, active: true } },
				{ headers },
			);

			expect(
				mockClient.customerPortal.subscriptions.list,
			).toHaveBeenCalledWith(
				{ customerSession: "token-123" },
				{ page: 1, limit: 10, active: true },
			);
		});

		it("calls subscriptions.list when referenceId provided", async () => {
			const { client, headers, mockClient } = await setupTestInstance();
			vi.mocked(mockClient.subscriptions.list).mockResolvedValue({
				result: { items: [] },
			});

			await client.customer.subscriptions.list(
				{ query: { referenceId: "ref-123" } },
				{ headers },
			);

			expect(mockClient.subscriptions.list).toHaveBeenCalledWith({
				page: undefined,
				limit: undefined,
				active: undefined,
				metadata: { referenceId: "ref-123" },
			});
		});

		it("handles errors", async () => {
			const { client, headers, mockClient } = await setupTestInstance();
			vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
				new Error("Failed"),
			);

			const { error } = await client.customer.subscriptions.list(
				{ query: {} },
				{ headers },
			);

			expect(error?.message).toContain("subscriptions list failed");
		});
	});

	describe("orders endpoint", () => {
		it("calls customerPortal.orders.list with session token and filters", async () => {
			const { client, headers, mockClient } = await setupTestInstance();
			vi.mocked(mockClient.customerPortal.orders.list).mockResolvedValue({
				items: [],
			});

			await client.customer.orders.list(
				{ query: { page: 1, limit: 10, productBillingType: "recurring" } },
				{ headers },
			);

			expect(mockClient.customerPortal.orders.list).toHaveBeenCalledWith(
				{ customerSession: "token-123" },
				{ page: 1, limit: 10, productBillingType: "recurring" },
			);
		});

		it("handles errors", async () => {
			const { client, headers, mockClient } = await setupTestInstance();
			vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
				new Error("Failed"),
			);

			const { error } = await client.customer.orders.list(
				{ query: {} },
				{ headers },
			);

			expect(error?.message).toContain("Orders list failed");
		});
	});
});
