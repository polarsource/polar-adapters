import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTestInstance } from "better-auth/test";
import { polar, checkout } from "../../index";
import { polarClient } from "../../client";
import {
	createMockCheckout,
	createMockCustomer,
	createMockPolarClient,
} from "../utils/mocks";

describe("checkout plugin", () => {
	const setupTestInstance = async (
		checkoutOptions: Parameters<typeof checkout>[0] = {},
	) => {
		const mockClient = createMockPolarClient();
		const mockCustomer = createMockCustomer();

		// Mock customer API for user creation hooks
		vi.mocked(mockClient.customers.list).mockResolvedValue({
			result: {
				items: [],
				pagination: { totalCount: 0, maxPage: 1 },
			},
		});
		vi.mocked(mockClient.customers.create).mockResolvedValue(mockCustomer);

		const { client, signInWithTestUser } = await getTestInstance(
			{
				plugins: [
					polar({
						client: mockClient,
						createCustomerOnSignUp: true,
						use: [checkout(checkoutOptions)],
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

		return { client, headers, mockClient };
	};

	describe("checkout endpoint", () => {
		it("should create checkout with product IDs", async () => {
			const mockCheckout = createMockCheckout();
			const { client, headers, mockClient } = await setupTestInstance({
				products: [
					{ productId: "prod-123", slug: "test-product" },
					{ productId: "prod-456", slug: "another-product" },
				],
				successUrl: "https://example.com/success",
			});

			vi.mocked(mockClient.checkouts.create).mockResolvedValue(mockCheckout);

			const { data } = await client.checkout(
				{
					products: ["prod-123", "prod-456"],
				},
				{ headers },
			);

			expect(mockClient.checkouts.create).toHaveBeenCalledWith(
				expect.objectContaining({
					products: ["prod-123", "prod-456"],
					successUrl: "https://example.com/success",
				}),
			);
			expect(data?.url).toBeDefined();
			expect(data?.redirect).toBe(true);
		});

		it("should create checkout with single product ID", async () => {
			const mockCheckout = createMockCheckout();
			const { client, headers, mockClient } = await setupTestInstance({
				products: [{ productId: "prod-123", slug: "test-product" }],
			});

			vi.mocked(mockClient.checkouts.create).mockResolvedValue(mockCheckout);

			const { data } = await client.checkout(
				{
					products: "prod-123",
				},
				{ headers },
			);

			expect(mockClient.checkouts.create).toHaveBeenCalledWith(
				expect.objectContaining({
					products: ["prod-123"],
				}),
			);
			expect(data?.url).toBeDefined();
		});

		it("should create checkout with product slug", async () => {
			const mockCheckout = createMockCheckout();
			const { client, headers, mockClient } = await setupTestInstance({
				products: [{ productId: "prod-123", slug: "test-product" }],
			});

			vi.mocked(mockClient.checkouts.create).mockResolvedValue(mockCheckout);

			const { data } = await client.checkout(
				{
					slug: "test-product",
				},
				{ headers },
			);

			expect(mockClient.checkouts.create).toHaveBeenCalledWith(
				expect.objectContaining({
					products: ["prod-123"],
				}),
			);
			expect(data?.url).toBeDefined();
		});

		it("should throw error for unknown product slug", async () => {
			const { client, headers } = await setupTestInstance({
				products: [{ productId: "prod-123", slug: "test-product" }],
			});

			const { error } = await client.checkout(
				{
					slug: "unknown-product",
				},
				{ headers },
			);

			expect(error?.message).toContain("Product not found");
		});

		it("should include metadata and custom field data", async () => {
			const mockCheckout = createMockCheckout();
			const { client, headers, mockClient } = await setupTestInstance({
				products: [{ productId: "prod-123", slug: "test-product" }],
			});

			vi.mocked(mockClient.checkouts.create).mockResolvedValue(mockCheckout);

			await client.checkout(
				{
					products: ["prod-123"],
					referenceId: "ref-123",
					metadata: { key: "value" },
					customFieldData: { field: "data" },
				},
				{ headers },
			);

			expect(mockClient.checkouts.create).toHaveBeenCalledWith(
				expect.objectContaining({
					products: ["prod-123"],
					metadata: { referenceId: "ref-123", key: "value" },
					customFieldData: { field: "data" },
				}),
			);
		});

		it("should apply theme to checkout URL", async () => {
			const mockCheckout = createMockCheckout();
			const { client, headers, mockClient } = await setupTestInstance({
				products: [{ productId: "prod-123", slug: "test-product" }],
				theme: "dark",
			});

			vi.mocked(mockClient.checkouts.create).mockResolvedValue(mockCheckout);

			const { data } = await client.checkout(
				{
					products: ["prod-123"],
				},
				{ headers },
			);

			expect(data?.url).toContain("theme=dark");
		});

		it("should handle API errors from Polar", async () => {
			const { client, headers, mockClient } = await setupTestInstance({
				products: [{ productId: "prod-123", slug: "test-product" }],
			});

			vi.mocked(mockClient.checkouts.create).mockRejectedValue(
				new Error("Invalid product"),
			);

			const { error } = await client.checkout(
				{
					products: ["prod-123"],
				},
				{ headers },
			);

			expect(error?.message).toContain("Checkout creation failed");
		});
	});

	describe("unauthenticated checkout", () => {
		it("should allow unauthenticated checkout when not required", async () => {
			const mockClient = createMockPolarClient();
			const mockCheckout = createMockCheckout();

			vi.mocked(mockClient.customers.list).mockResolvedValue({
				result: {
					items: [],
					pagination: { totalCount: 0, maxPage: 1 },
				},
			});

			const { client } = await getTestInstance(
				{
					plugins: [
						polar({
							client: mockClient,
							use: [
								checkout({
									products: [{ productId: "prod-123", slug: "test-product" }],
									authenticatedUsersOnly: false,
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

			vi.mocked(mockClient.checkouts.create).mockResolvedValue(mockCheckout);

			// Call without headers (unauthenticated)
			const { data } = await client.checkout({
				products: ["prod-123"],
			});

			expect(mockClient.checkouts.create).toHaveBeenCalledWith(
				expect.objectContaining({
					externalCustomerId: undefined,
					products: ["prod-123"],
				}),
			);
			expect(data?.url).toBeDefined();
		});

		it("should reject unauthenticated checkout when required", async () => {
			const mockClient = createMockPolarClient();

			vi.mocked(mockClient.customers.list).mockResolvedValue({
				result: {
					items: [],
					pagination: { totalCount: 0, maxPage: 1 },
				},
			});

			const { client } = await getTestInstance(
				{
					plugins: [
						polar({
							client: mockClient,
							use: [
								checkout({
									products: [{ productId: "prod-123", slug: "test-product" }],
									authenticatedUsersOnly: true,
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

			const { error } = await client.checkout({
				products: ["prod-123"],
			});

			expect(error?.message).toContain("You must be logged in to checkout");
		});
	});

	describe("async product resolution", () => {
		it("should handle async product resolution", async () => {
			const asyncProducts = vi
				.fn()
				.mockResolvedValue([
					{ productId: "async-prod-123", slug: "async-product" },
				]);

			const mockClient = createMockPolarClient();
			const mockCustomer = createMockCustomer();
			const mockCheckout = createMockCheckout();

			vi.mocked(mockClient.customers.list).mockResolvedValue({
				result: {
					items: [],
					pagination: { totalCount: 0, maxPage: 1 },
				},
			});
			vi.mocked(mockClient.customers.create).mockResolvedValue(mockCustomer);
			vi.mocked(mockClient.checkouts.create).mockResolvedValue(mockCheckout);

			const { client, signInWithTestUser } = await getTestInstance(
				{
					plugins: [
						polar({
							client: mockClient,
							createCustomerOnSignUp: true,
							use: [checkout({ products: asyncProducts })],
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

			await client.checkout(
				{
					slug: "async-product",
				},
				{ headers },
			);

			expect(asyncProducts).toHaveBeenCalled();
			expect(mockClient.checkouts.create).toHaveBeenCalledWith(
				expect.objectContaining({
					products: ["async-prod-123"],
				}),
			);
		});
	});
});
