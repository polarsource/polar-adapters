// Define mock values at the top level
const mockCustomerPortalUrl = "https://polar.sh/portal/session-123";
const mockCustomerSessionCreate = vi.fn(() => ({
	customerPortalUrl: mockCustomerPortalUrl,
}));

// Mock the module before any imports
vi.mock("@polar-sh/sdk", async (importOriginal) => {
	class Polar {
		customerSessions = {
			create: mockCustomerSessionCreate,
		};
	}

	return {
		...(await importOriginal()),
		Polar,
	};
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { CustomerPortal } from "./customerPortal";

describe("CustomerPortal", () => {
	beforeEach(() => {
		mockCustomerSessionCreate.mockClear();
	});

	describe("configuration", () => {
		it("should create customer portal function", () => {
			const portal = CustomerPortal({
				accessToken: "test-token",
				server: "sandbox",
				getCustomerId: async () => "customer-123",
			});

			expect(portal).toBeDefined();
			expect(typeof portal).toBe("function");
		});
	});

	describe("request handling", () => {
		it("should return 400 when customerId is not provided", async () => {
			const portal = CustomerPortal({
				accessToken: "test-token",
				server: "sandbox",
				getCustomerId: async () => "",
			});

			const request = new Request("https://example.com/portal");
			const response = await portal(request);
			const data = await response.json();

			expect(response.status).toBe(400);
			expect(data.error).toBe("customerId not defined");
		});

		it("should create customer session and redirect", async () => {
			const getCustomerIdCalls: Request[] = [];
			const getCustomerId = async (req: Request) => {
				getCustomerIdCalls.push(req);
				return "customer-123";
			};

			const portal = CustomerPortal({
				accessToken: "test-token",
				server: "sandbox",
				getCustomerId,
			});

			const request = new Request("https://example.com/portal");
			const response = await portal(request);

			expect(getCustomerIdCalls).toHaveLength(1);
			expect(getCustomerIdCalls[0]).toBe(request);
			expect(mockCustomerSessionCreate).toHaveBeenCalledTimes(1);
			expect(mockCustomerSessionCreate).toHaveBeenCalledWith({
				customerId: "customer-123",
			});
			expect(response.status).toBe(302);
			expect(response.headers.get("location")).toBe(
				"https://polar.sh/portal/session-123",
			);
		});

		it("should handle errors and return 500", async () => {
			mockCustomerSessionCreate.mockRejectedValueOnce(new Error("API Error"));

			const portal = CustomerPortal({
				accessToken: "test-token",
				server: "sandbox",
				getCustomerId: async () => "customer-123",
			});

			const request = new Request("https://example.com/portal");
			const response = await portal(request);

			expect(response.status).toBe(500);
		});

		it("should pass request to getCustomerId function", async () => {
			const getCustomerIdCalls: Request[] = [];
			const getCustomerId = async (req: Request) => {
				getCustomerIdCalls.push(req);
				return "customer-456";
			};

			const portal = CustomerPortal({
				accessToken: "test-token",
				server: "production",
				getCustomerId,
			});

			const request = new Request("https://example.com/portal?token=abc123");
			await portal(request);

			expect(getCustomerIdCalls).toHaveLength(1);
			expect(getCustomerIdCalls[0]).toBe(request);
		});
	});
});
