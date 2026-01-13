import { describe, expect, it, vi } from "vitest";
import { getTestInstance } from "better-auth/test";
import { polar, checkout, portal, usage, webhooks } from "../index";
import { polarClient } from "../client";
import { createMockPolarClient, createMockCustomer } from "./utils/mocks";

describe("integration", () => {
	it("should properly infer type", async () => {
		const mockClient = createMockPolarClient();
		const mockCustomer = createMockCustomer();

		// Mock customer API responses for user creation hooks
		vi.mocked(mockClient.customers.list).mockResolvedValue({
			result: {
				items: [],
				pagination: { totalCount: 0, maxPage: 1 },
			},
		});

		vi.mocked(mockClient.customers.create).mockResolvedValue(mockCustomer);

		// Mock customer session creation (needed for portal endpoints)
		vi.mocked(mockClient.customerSessions.create).mockResolvedValue({
			id: "session-123",
			token: "test-token",
			customerPortalUrl: "https://polar.sh/portal",
			createdAt: new Date(),
			modifiedAt: new Date(),
			expiresAt: new Date(Date.now() + 1000 * 60 * 60),
			customerId: mockCustomer.id,
		});

		// Mock portal orders endpoint (SDK returns items/pagination directly)
		vi.mocked(mockClient.customerPortal.orders.list).mockResolvedValue({
			items: [],
			pagination: {
				totalCount: 0,
				maxPage: 1,
			},
		});

		const { client, signInWithTestUser } = await getTestInstance(
			{
				plugins: [
					polar({
						client: mockClient,
						createCustomerOnSignUp: true,
						use: [
							checkout({
								products: [
									{
										productId: "123-456-789",
										slug: "pro",
									},
								],
								successUrl: "/success?checkout_id={CHECKOUT_ID}",
								authenticatedUsersOnly: true,
							}),
							portal(),
							usage(),
							webhooks({
								secret: "secret",
							}),
						],
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

		const { data } = await client.customer.orders.list(
			{
				query: {
					page: 1,
					limit: 10,
				},
			},
			{
				headers,
			},
		);

		expect(data?.items).toBeDefined();
		expect(data?.pagination).toBeDefined();
	});
});
