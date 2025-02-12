// Define mock values at the top level
const mockCustomerPortalUrl = "https://mock-customer-portal-url.com/";
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

import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { CustomerPortal } from "./customerPortal";

describe("CustomerPortal middleware", () => {
	it("should redirect to customer portal when customerId is valid", async () => {
		const app = fastify();
		const mockGetCustomerId = async () => "valid-customer-id";

		app.get(
			"/",
			CustomerPortal({
				getCustomerId: mockGetCustomerId,
			}),
		);

		const response = await app.inject({
			url: "http://localhost/",
			method: "GET",
		});

		expect(response.statusCode).toBe(302);
		// biome-ignore lint/complexity/useLiteralKeys: fix ci
		expect(response.headers["location"]).toBe(mockCustomerPortalUrl);
	});

	it("should return 400 when customerId is not defined", async () => {
		const app = fastify();
		const mockGetCustomerId = async () => "";
		app.get(
			"/",
			CustomerPortal({
				getCustomerId: mockGetCustomerId,
			}),
		);

		const response = await app.inject({
			url: "http://localhost/",
			method: "GET",
		});

		expect(response.statusCode).toBe(400);
		expect(response.json()).toEqual({ error: "customerId not defined" });
	});
});
