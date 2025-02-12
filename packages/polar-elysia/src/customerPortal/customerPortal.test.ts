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

import Elysia from "elysia";
import { describe, expect, it, vi } from "vitest";
import { CustomerPortal } from "./customerPortal";

describe("CustomerPortal middleware", () => {
	it("should redirect to customer portal when customerId is valid", async () => {
		const app = new Elysia();
		const mockGetCustomerId = async () => "valid-customer-id";

		app.get(
			"/",
			CustomerPortal({
				getCustomerId: mockGetCustomerId,
			}),
		);

		const response = await app.handle(new Request("http://localhost/"));

		expect(response.status).toBe(302);
		expect(response.headers.get("location")).toBe(mockCustomerPortalUrl);
	});

	it("should return 400 when customerId is not defined", async () => {
		const app = new Elysia();
		const mockGetCustomerId = async () => "";
		app.get(
			"/",
			CustomerPortal({
				getCustomerId: mockGetCustomerId,
			}),
		);

		const response = await app.handle(new Request("http://localhost/"));

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({ error: "customerId not defined" });
	});
});
