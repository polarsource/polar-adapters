// Define mock values at the top level
const mockCheckoutUrl = "https://polar.sh/checkout/123";
const mockCheckoutCreate = vi.fn(() => ({ url: mockCheckoutUrl }));

// Mock the module before any imports
vi.mock("@polar-sh/sdk", async (importOriginal) => {
	class Polar {
		checkouts = {
			create: mockCheckoutCreate,
		};
	}

	return {
		...(await importOriginal()),
		Polar,
	};
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { Checkout } from "./checkout";

describe("Checkout", () => {
	beforeEach(() => {
		mockCheckoutCreate.mockClear();
	});

	describe("configuration", () => {
		it("should create checkout function", () => {
			const checkout = Checkout({
				accessToken: "test-token",
				server: "sandbox",
			});

			expect(checkout).toBeDefined();
			expect(typeof checkout).toBe("function");
		});

		it("should handle default includeCheckoutId", () => {
			const checkout = Checkout({
				accessToken: "test-token",
			});

			expect(checkout).toBeDefined();
		});
	});

	describe("request handling", () => {
		it("should return 400 when no products provided", async () => {
			const checkout = Checkout({ accessToken: "test-token" });
			const request = new Request("https://example.com/checkout");

			const response = await checkout(request);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe("Missing products in query params");
		});

		it("should create checkout with single product", async () => {
			const checkout = Checkout({ accessToken: "test-token" });
			const request = new Request(
				"https://example.com/checkout?products=prod_123",
			);

			const response = await checkout(request);

			expect(mockCheckoutCreate).toHaveBeenCalledTimes(1);
			expect(mockCheckoutCreate).toHaveBeenCalledWith({
				products: ["prod_123"],
			});
			expect(response.status).toBe(302);
		});

		it("should create checkout with multiple products", async () => {
			const checkout = Checkout({ accessToken: "test-token" });
			const request = new Request(
				"https://example.com/checkout?products=prod_123&products=prod_456",
			);

			await checkout(request);

			expect(mockCheckoutCreate).toHaveBeenCalledWith({
				products: ["prod_123", "prod_456"],
			});
		});

		it("should include successUrl with checkoutId when configured", async () => {
			const checkout = Checkout({
				accessToken: "test-token",
				successUrl: "https://example.com/success",
				includeCheckoutId: true,
			});
			const request = new Request(
				"https://example.com/checkout?products=prod_123",
			);

			await checkout(request);

			expect(mockCheckoutCreate).toHaveBeenCalledWith({
				products: ["prod_123"],
				successUrl: "https://example.com/success?checkoutId={CHECKOUT_ID}",
			});
		});

		it("should include successUrl without checkoutId when disabled", async () => {
			const checkout = Checkout({
				accessToken: "test-token",
				successUrl: "https://example.com/success",
				includeCheckoutId: false,
			});
			const request = new Request(
				"https://example.com/checkout?products=prod_123",
			);

			await checkout(request);

			expect(mockCheckoutCreate).toHaveBeenCalledWith({
				products: ["prod_123"],
				successUrl: "https://example.com/success",
			});
		});

		it("should add theme parameter to redirect URL", async () => {
			const checkout = Checkout({
				accessToken: "test-token",
				theme: "dark",
			});
			const request = new Request(
				"https://example.com/checkout?products=prod_123",
			);

			const response = await checkout(request);

			expect(response.headers.get("location")).toBe(
				"https://polar.sh/checkout/123?theme=dark",
			);
		});

		it("should parse customer parameters correctly", async () => {
			const checkout = Checkout({ accessToken: "test-token" });
			const billingAddress = JSON.stringify({
				street: "123 Main St",
				city: "NYC",
			});
			const metadata = JSON.stringify({ source: "website" });
			const customerMetadata = JSON.stringify({ plan: "premium" });

			const requestUrl = new URL("https://example.com/checkout");
			requestUrl.searchParams.set("products", "prod_123");
			requestUrl.searchParams.set("customerId", "cust_123");
			requestUrl.searchParams.set("customerExternalId", "ext_123");
			requestUrl.searchParams.set("customerEmail", "test@example.com");
			requestUrl.searchParams.set("customerName", "John Doe");
			requestUrl.searchParams.set("customerBillingAddress", billingAddress);
			requestUrl.searchParams.set("customerTaxId", "TAX123");
			requestUrl.searchParams.set("customerIpAddress", "192.168.1.1");
			requestUrl.searchParams.set("customerMetadata", customerMetadata);
			requestUrl.searchParams.set("allowDiscountCodes", "true");
			requestUrl.searchParams.set("discountId", "disc_123");
			requestUrl.searchParams.set("metadata", metadata);

			const request = new Request(requestUrl.toString());

			await checkout(request);

			expect(mockCheckoutCreate).toHaveBeenCalledWith({
				products: ["prod_123"],
				customerId: "cust_123",
				externalCustomerId: "ext_123",
				customerEmail: "test@example.com",
				customerName: "John Doe",
				customerBillingAddress: {
					street: "123 Main St",
					city: "NYC",
				},
				customerTaxId: "TAX123",
				customerIpAddress: "192.168.1.1",
				customerMetadata: { plan: "premium" },
				allowDiscountCodes: true,
				discountId: "disc_123",
				metadata: { source: "website" },
			});
		});

		it("should handle allowDiscountCodes as false", async () => {
			const checkout = Checkout({ accessToken: "test-token" });
			const request = new Request(
				"https://example.com/checkout?products=prod_123&allowDiscountCodes=false",
			);

			await checkout(request);

			expect(mockCheckoutCreate).toHaveBeenCalledWith({
				products: ["prod_123"],
				allowDiscountCodes: false,
			});
		});

		it("should return error response when checkout creation fails", async () => {
			mockCheckoutCreate.mockRejectedValueOnce(new Error("API Error"));

			const checkout = Checkout({ accessToken: "test-token" });
			const request = new Request(
				"https://example.com/checkout?products=prod_123",
			);

			const response = await checkout(request);

			expect(response.status).toBe(500);
		});
	});
});
