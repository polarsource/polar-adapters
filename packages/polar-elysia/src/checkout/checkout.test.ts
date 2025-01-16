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
			custom: {
				create: mockCheckoutCreate,
			},
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
	it("should redirect to checkout when productId is valid", async () => {
		const app = new Elysia();
		app.get(
			"/",
			Checkout({
				accessToken: "mock-access-token",
			}),
		);

		const response = await app.handle(
			new Request("http://localhost/?productId=mock-product-id"),
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(mockCheckoutUrl);
	});

	it("should redirect to checkout when productPriceId is valid", async () => {
		const app = new Elysia();
		app.get(
			"/",
			Checkout({
				accessToken: "mock-access-token",
			}),
		);

		const response = await app.handle(
			new Request("http://localhost/?productPriceId=mock-product-price-id"),
		);

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(mockCheckoutUrl);
	});

	it("should return 400 when productId and productPriceId are not defined", async () => {
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
			error: "Missing productId or productPriceId in query params",
		});
	});
});
