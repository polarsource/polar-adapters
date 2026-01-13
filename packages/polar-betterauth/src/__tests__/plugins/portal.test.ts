import { describe, expect, it, vi } from "vitest";
import { getTestInstance } from "better-auth/test";
import { polar, portal } from "../../index";
import { polarClient } from "../../client";
import { createMockCustomer, createMockPolarClient } from "../utils/mocks";

describe("portal plugin", () => {
	const setupTestInstance = async (portalOptions: Parameters<typeof portal>[0] = {}) => {
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
						use: [portal(portalOptions)],
					}),
				],
			},
			{
				clientOptions: {
					plugins: [polarClient()],
				},
			},
		);

		const { headers, user } = await signInWithTestUser();

		return { auth, client, headers, user, mockClient };
	};

	describe("portal endpoint", () => {
		it("should create customer portal session and return URL", async () => {
			const { auth, headers, mockClient } = await setupTestInstance();

			vi.mocked(mockClient.customerSessions.create).mockResolvedValue({
				id: "session-123",
				token: "session-token-123",
				customerPortalUrl: "https://polar.sh/portal/session-123",
				createdAt: new Date(),
				modifiedAt: new Date(),
				expiresAt: new Date(Date.now() + 1000 * 60 * 60),
				customerId: "customer-123",
			});

			// Call via auth.api directly since client routing doesn't work for /customer/portal
			const response = await auth.api.portal({ headers });

			expect(mockClient.customerSessions.create).toHaveBeenCalledWith(
				expect.objectContaining({
					externalCustomerId: expect.any(String),
				}),
			);
			expect(response.url).toBe("https://polar.sh/portal/session-123");
			expect(response.redirect).toBe(true);
		});

		it("should include returnUrl when configured", async () => {
			const { auth, headers, mockClient } = await setupTestInstance({
				returnUrl: "https://example.com/dashboard",
			});

			vi.mocked(mockClient.customerSessions.create).mockResolvedValue({
				id: "session-123",
				token: "session-token-123",
				customerPortalUrl: "https://polar.sh/portal/session-123",
				createdAt: new Date(),
				modifiedAt: new Date(),
				expiresAt: new Date(Date.now() + 1000 * 60 * 60),
				customerId: "customer-123",
			});

			await auth.api.portal({ headers });

			expect(mockClient.customerSessions.create).toHaveBeenCalledWith(
				expect.objectContaining({
					returnUrl: "https://example.com/dashboard",
				}),
			);
		});

		it("should handle API errors", async () => {
			const { auth, headers, mockClient } = await setupTestInstance();

			vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
				new Error("Customer not found"),
			);

			await expect(auth.api.portal({ headers })).rejects.toThrow(
				"Customer portal creation failed",
			);
		});
	});

	describe("state endpoint", () => {
		it("should get customer state", async () => {
			const { auth, headers, mockClient } = await setupTestInstance();

			const mockState = {
				activeSubscriptions: [],
				grantedBenefits: [],
			};

			vi.mocked(mockClient.customers.getStateExternal).mockResolvedValue(
				mockState,
			);

			const response = await auth.api.state({ headers });

			expect(mockClient.customers.getStateExternal).toHaveBeenCalledWith({
				externalId: expect.any(String),
			});
			expect(response).toEqual(mockState);
		});

		it("should handle API errors", async () => {
			const { auth, headers, mockClient } = await setupTestInstance();

			vi.mocked(mockClient.customers.getStateExternal).mockRejectedValue(
				new Error("Customer not found"),
			);

			await expect(auth.api.state({ headers })).rejects.toThrow(
				"Subscriptions list failed",
			);
		});
	});

	describe("benefits endpoint", () => {
		it("should list customer benefits with pagination", async () => {
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

			const mockBenefits = {
				items: [
					{ id: "benefit-1", name: "Premium Feature" },
					{ id: "benefit-2", name: "Extra Storage" },
				],
				pagination: { totalCount: 2, maxPage: 1 },
			};

			vi.mocked(mockClient.customerPortal.benefitGrants.list).mockResolvedValue(
				mockBenefits,
			);

			const { data } = await client.customer.benefits.list(
				{ query: { page: 1, limit: 10 } },
				{ headers },
			);

			expect(mockClient.customerPortal.benefitGrants.list).toHaveBeenCalledWith(
				{ customerSession: "session-token-123" },
				{ page: 1, limit: 10 },
			);
			expect(data).toEqual(mockBenefits);
		});

		it("should handle API errors", async () => {
			const { client, headers, mockClient } = await setupTestInstance();

			vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
				new Error("Session creation failed"),
			);

			const { error } = await client.customer.benefits.list(
				{ query: {} },
				{ headers },
			);

			expect(error?.message).toContain("Benefits list failed");
		});
	});

	describe("subscriptions endpoint", () => {
		it("should list subscriptions via customer portal", async () => {
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

			const mockSubscriptions = {
				items: [{ id: "sub-1", status: "active" }],
				pagination: { totalCount: 1, maxPage: 1 },
			};

			vi.mocked(mockClient.customerPortal.subscriptions.list).mockResolvedValue(
				mockSubscriptions,
			);

			const { data } = await client.customer.subscriptions.list(
				{ query: { page: 1, limit: 5, active: true } },
				{ headers },
			);

			expect(mockClient.customerPortal.subscriptions.list).toHaveBeenCalledWith(
				{ customerSession: "session-token-123" },
				{ page: 1, limit: 5, active: true },
			);
			expect(data).toEqual(mockSubscriptions);
		});

		it("should list subscriptions by reference ID", async () => {
			const { client, headers, mockClient } = await setupTestInstance();

			const mockSubscriptions = {
				result: {
					items: [{ id: "sub-1", metadata: { referenceId: "ref-123" } }],
					pagination: { totalCount: 1, maxPage: 1 },
				},
			};

			vi.mocked(mockClient.subscriptions.list).mockResolvedValue(
				mockSubscriptions,
			);

			const { data } = await client.customer.subscriptions.list(
				{ query: { referenceId: "ref-123", page: 1, limit: 10 } },
				{ headers },
			);

			expect(mockClient.subscriptions.list).toHaveBeenCalledWith({
				page: 1,
				limit: 10,
				active: undefined,
				metadata: { referenceId: "ref-123" },
			});
			expect(data).toEqual(mockSubscriptions);
		});

		it("should handle API errors for reference ID lookup", async () => {
			const { client, headers, mockClient } = await setupTestInstance();

			vi.mocked(mockClient.subscriptions.list).mockRejectedValue(
				new Error("Subscription lookup failed"),
			);

			const { error } = await client.customer.subscriptions.list(
				{ query: { referenceId: "ref-123" } },
				{ headers },
			);

			expect(error?.message).toContain("Subscriptions list with referenceId failed");
		});

		it("should handle API errors for customer portal lookup", async () => {
			const { client, headers, mockClient } = await setupTestInstance();

			vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
				new Error("Session creation failed"),
			);

			const { error } = await client.customer.subscriptions.list(
				{ query: {} },
				{ headers },
			);

			expect(error?.message).toContain("Polar subscriptions list failed");
		});
	});

	describe("orders endpoint", () => {
		it("should list customer orders with filters", async () => {
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

			const mockOrders = {
				items: [{ id: "order-1", productBillingType: "recurring" }],
				pagination: { totalCount: 1, maxPage: 1 },
			};

			vi.mocked(mockClient.customerPortal.orders.list).mockResolvedValue(
				mockOrders,
			);

			const { data } = await client.customer.orders.list(
				{ query: { page: 1, limit: 20, productBillingType: "recurring" } },
				{ headers },
			);

			expect(mockClient.customerPortal.orders.list).toHaveBeenCalledWith(
				{ customerSession: "session-token-123" },
				{ page: 1, limit: 20, productBillingType: "recurring" },
			);
			expect(data).toEqual(mockOrders);
		});

		it("should handle one_time billing type filter", async () => {
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

			const mockOrders = {
				items: [],
				pagination: { totalCount: 0, maxPage: 1 },
			};

			vi.mocked(mockClient.customerPortal.orders.list).mockResolvedValue(
				mockOrders,
			);

			await client.customer.orders.list(
				{ query: { productBillingType: "one_time" } },
				{ headers },
			);

			expect(mockClient.customerPortal.orders.list).toHaveBeenCalledWith(
				{ customerSession: "session-token-123" },
				expect.objectContaining({ productBillingType: "one_time" }),
			);
		});

		it("should handle API errors", async () => {
			const { client, headers, mockClient } = await setupTestInstance();

			vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
				new Error("Session creation failed"),
			);

			const { error } = await client.customer.orders.list(
				{ query: {} },
				{ headers },
			);

			expect(error?.message).toContain("Orders list failed");
		});
	});
});
