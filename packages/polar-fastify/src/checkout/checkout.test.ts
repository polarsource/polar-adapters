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

import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { Checkout } from "./checkout";

describe("Checkout middleware", () => {
	it("should redirect to checkout when productId is valid", async () => {
		const app = fastify();
		app.get(
			"/",
			Checkout({
				accessToken: "mock-access-token",
			}),
		);

		const response = await app.inject({
			url: "http://localhost/?productId=mock-product-id",
			method: "GET",
		});

		expect(response.statusCode).toBe(302);
		// biome-ignore lint/complexity/useLiteralKeys: fix ci
		expect(response.headers["location"]).toBe(mockCheckoutUrl);
	});

	it("should redirect to checkout when productPriceId is valid", async () => {
		const app = fastify();
		app.get(
			"/",
			Checkout({
				accessToken: "mock-access-token",
			}),
		);

		const response = await app.inject({
			url: "http://localhost/?productPriceId=mock-product-price-id",
			method: "GET",
		});

		expect(response.statusCode).toBe(302);
		// biome-ignore lint/complexity/useLiteralKeys: fix ci
		expect(response.headers["location"]).toBe(mockCheckoutUrl);
	});

	it("should return 400 when productId and productPriceId are not defined", async () => {
		const app = fastify();
		app.get(
			"/",
			Checkout({
				accessToken: "mock-access-token",
			}),
		);

		const response = await app.inject({
			url: "http://localhost/",
			method: "GET",
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({
			error: "Missing productId or productPriceId in query params",
		});
	});
});
