// Define mock values at the top level
const mockCustomerPortalUrl = "https://mock-customer-portal-url.com";
const mockCheckoutUrl = "https://mock-checkout-url.com";
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

import express from "express";
import supertest from "supertest";
import { describe, it, vi } from "vitest";
import { Checkout } from "./checkout";

describe("Checkout middleware", () => {
	it("should redirect to checkout when products is valid", async () => {
		const app = express();
		app.get(
			"/",
			Checkout({
				accessToken: "mock-access-token",
			}),
		);

		supertest(app)
			.get("/?products=mock-product-id")
			.expect(302)
			.expect("location", mockCheckoutUrl)
			.end((err) => {
				if (err) {
					throw err;
				}
			});
	});

	it("should return 400 when products is not defined", async () => {
		const app = express();
		app.get(
			"/",
			Checkout({
				accessToken: "mock-access-token",
			}),
		);

		supertest(app)
			.get("/")
			.expect(400)
			.expect({
				error: "Missing products in query params",
			})
			.end((err) => {
				if (err) {
					throw err;
				}
			});
	});
});
