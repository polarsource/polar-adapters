import { describe, expect, it, vi } from "vitest";
import { getTestInstance } from "better-auth/test";
import { polar, checkout } from "../../index";
import { polarClient } from "../../client";
import { createMockPolarClient } from "../utils/mocks";

describe("checkout plugin", () => {
	const setupTestInstance = async (
		checkoutOptions: Parameters<typeof checkout>[0] = {},
	) => {
		const mockClient = createMockPolarClient();

		vi.mocked(mockClient.customers.list).mockResolvedValue({
			result: { items: [], pagination: { totalCount: 0, maxPage: 1 } },
		});
		vi.mocked(mockClient.checkouts.create).mockResolvedValue({
			id: "checkout-123",
			url: "https://polar.sh/checkout/123",
		});

		const { client, signInWithTestUser } = await getTestInstance(
			{
				plugins: [
					polar({
						client: mockClient,
						use: [checkout(checkoutOptions)],
					}),
				],
			},
			{ clientOptions: { plugins: [polarClient()] } },
		);

		const { headers } = await signInWithTestUser();
		return { client, headers, mockClient };
	};

	it("calls checkouts.create with product IDs", async () => {
		const { client, headers, mockClient } = await setupTestInstance({
			products: [{ productId: "prod-123", slug: "pro" }],
			successUrl: "https://example.com/success",
		});

		await client.checkout({ products: ["prod-123", "prod-456"] }, { headers });

		expect(mockClient.checkouts.create).toHaveBeenCalledWith(
			expect.objectContaining({
				products: ["prod-123", "prod-456"],
				successUrl: "https://example.com/success",
				externalCustomerId: expect.any(String),
			}),
		);
	});

	it("resolves product slug to product ID", async () => {
		const { client, headers, mockClient } = await setupTestInstance({
			products: [{ productId: "prod-123", slug: "pro" }],
		});

		await client.checkout({ slug: "pro" }, { headers });

		expect(mockClient.checkouts.create).toHaveBeenCalledWith(
			expect.objectContaining({ products: ["prod-123"] }),
		);
	});

	it("throws error for unknown product slug", async () => {
		const { client, headers } = await setupTestInstance({
			products: [{ productId: "prod-123", slug: "pro" }],
		});

		const { error } = await client.checkout({ slug: "unknown" }, { headers });

		expect(error?.message).toContain("Product not found");
	});

	it("passes metadata and customFieldData", async () => {
		const { client, headers, mockClient } = await setupTestInstance({
			products: [{ productId: "prod-123", slug: "pro" }],
		});

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
				metadata: { referenceId: "ref-123", key: "value" },
				customFieldData: { field: "data" },
			}),
		);
	});

	it("allows unauthenticated checkout when configured", async () => {
		const mockClient = createMockPolarClient();
		vi.mocked(mockClient.checkouts.create).mockResolvedValue({
			id: "checkout-123",
			url: "https://polar.sh/checkout/123",
		});

		const { client } = await getTestInstance(
			{
				plugins: [
					polar({
						client: mockClient,
						use: [
							checkout({
								products: [{ productId: "prod-123", slug: "pro" }],
								authenticatedUsersOnly: false,
							}),
						],
					}),
				],
			},
			{ clientOptions: { plugins: [polarClient()] } },
		);

		await client.checkout({ products: ["prod-123"] });

		expect(mockClient.checkouts.create).toHaveBeenCalledWith(
			expect.objectContaining({ externalCustomerId: undefined }),
		);
	});

	it("rejects unauthenticated checkout when required", async () => {
		const mockClient = createMockPolarClient();

		const { client } = await getTestInstance(
			{
				plugins: [
					polar({
						client: mockClient,
						use: [
							checkout({
								products: [{ productId: "prod-123", slug: "pro" }],
								authenticatedUsersOnly: true,
							}),
						],
					}),
				],
			},
			{ clientOptions: { plugins: [polarClient()] } },
		);

		const { error } = await client.checkout({ products: ["prod-123"] });

		expect(error?.message).toContain("You must be logged in");
	});

	it("handles checkout creation errors", async () => {
		const { client, headers, mockClient } = await setupTestInstance({
			products: [{ productId: "prod-123", slug: "pro" }],
		});

		vi.mocked(mockClient.checkouts.create).mockRejectedValue(
			new Error("Invalid product"),
		);

		const { error } = await client.checkout(
			{ products: ["prod-123"] },
			{ headers },
		);

		expect(error?.message).toContain("Checkout creation failed");
	});
});
