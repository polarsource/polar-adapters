// Define mock values at the top level
const mockCustomerPortalUrl = "https://mock-customer-portal-url.com";
const mockCheckoutUrl = "https://mock-checkout-url.com/";
const mockSessionCreate = vi
	.fn()
	.mockResolvedValue({ customerPortalUrl: mockCustomerPortalUrl });
const mockCheckoutCreate = vi.fn(() => ({ url: mockCheckoutUrl }));

// Mock the module before any imports
vi.mock("@polar-sh/sdk", async (importOriginal) => {
	class Polar {
		customerSessions = {
			create: mockSessionCreate,
		};

		checkouts = {
			create: mockCheckoutCreate,
		};
	}

	return {
		...(await importOriginal()),
		Polar,
	};
});

import { Elysia } from "elysia";
import { describe, expect, it, vi } from "vitest";
import { Checkout } from "./checkout";

describe("Checkout middleware", () => {
	it("should redirect to checkout when products is valid", async () => {
		const app = new Elysia();
		app.get(
			"/",
			Checkout({
				accessToken: "mock-access-token",
			}),
		);

		const response = await app.handle(
			new Request("http://localhost/?products=mock-product-id"),
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(mockCheckoutUrl);
	});

	it("should return 400 when products are not defined", async () => {
		const app = new Elysia();
		app.get(
			"/",
			Checkout({
				accessToken: "mock-access-token",
			}),
		);

		const response = await app.handle(new Request("http://localhost/"));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Missing products in query params",
		});
	});

	it("should encode metadata JSON properly", async () => {
		const app = new Elysia();
		app.get(
			"/",
			Checkout({
				accessToken: "mock-access-token",
			}),
		);

		const metadata = {
			foo: "bar",
		};

		const url = new URL("http://localhost/");
		url.searchParams.set("products", "mock-product-id");
		url.searchParams.set("metadata", JSON.stringify(metadata));

		const response = await app.handle(new Request(url.toString()));

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(mockCheckoutUrl);
		expect(mockCheckoutCreate).toHaveBeenCalledWith({
			products: ["mock-product-id"],
			metadata,
		});
	});
});
