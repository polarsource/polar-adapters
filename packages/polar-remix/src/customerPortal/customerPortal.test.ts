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

import { describe, expect, it, vi } from "vitest";
import { CustomerPortal } from "./customerPortal";

describe("CustomerPortal middleware", () => {
	it("should redirect to customer portal when customerId is valid", async () => {
		const response = await CustomerPortal({
			getCustomerId: async () => "valid-customer-id",
		})({
			request: new Request("http://localhost:3000/"),
			context: {},
			params: {},
		});

		expect(response).toBeInstanceOf(Response);
		expect((response as Response).status).toBe(302);
		expect((response as Response).headers.get("Location")).toBe(
			mockCustomerPortalUrl,
		);
	});

	it("should return 400 when customerId is not defined", async () => {
		const response = await CustomerPortal({
			getCustomerId: async () => "",
		})({
			request: new Request("http://localhost:3000/"),
			context: {},
			params: {},
		});

		expect(response).toBeInstanceOf(Response);
		expect((response as Response).status).toBe(400);
		expect(await (response as Response).json()).toEqual({
			error: "customerId not defined",
		});
	});
});
