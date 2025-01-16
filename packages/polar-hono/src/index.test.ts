// Define mock values at the top level
const mockCustomerPortalUrl = "https://mock-customer-portal-url.com";
const mockCheckoutUrl = "https://mock-checkout-url.com";
const mockSessionCreate = vi
	.fn()
	.mockResolvedValue({ customerPortalUrl: mockCustomerPortalUrl });
const mockCheckoutCreate = vi.fn().mockResolvedValue({ url: mockCheckoutUrl });

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

vi.mock("@polar-sh/sdk/webhooks", async (importOriginal) => {
	return {
		...(await importOriginal()),
		WebhookVerificationError: vi.fn(),
		validateEvent: vi.fn((v) => JSON.parse(v)),
	};
});

import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { Checkout, CustomerPortal, Webhooks } from "./index";

describe("Checkout middleware", () => {
	it("should redirect to checkout when productId is valid", async () => {
		const app = new Hono();
		app.use(
			"*",
			Checkout({
				accessToken: "mock-access-token",
			}),
		);

		const res = await app.request("/?productId=mock-product-id");
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toContain(mockCheckoutUrl);
	});

	it("should redirect to checkout when productPriceId is valid", async () => {
		const app = new Hono();
		app.use(
			"*",
			Checkout({
				accessToken: "mock-access-token",
			}),
		);

		const res = await app.request("/?productPriceId=mock-product-price-id");
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toContain(mockCheckoutUrl);
	});

	it("should return 400 when productId and productPriceId are not defined", async () => {
		const app = new Hono();
		app.use(
			"*",
			Checkout({
				accessToken: "mock-access-token",
			}),
		);

		const res = await app.request("/");
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: "Missing productId or productPriceId in query params",
		});
	});
});

describe("CustomerPortal middleware", () => {
	it("should redirect to customer portal when customerId is valid", async () => {
		const app = new Hono();
		const mockGetCustomerId = async () => "valid-customer-id";

		app.use(
			"*",
			CustomerPortal({
				getCustomerId: mockGetCustomerId,
			}),
		);

		const res = await app.request("/");
		expect(res.status).toBe(302);
		expect(res.headers.get("Location")).toContain(mockCustomerPortalUrl);
	});

	it("should return 400 when customerId is not defined", async () => {
		const app = new Hono();
		const mockGetCustomerId = async () => "";
		app.use(
			"*",
			CustomerPortal({
				getCustomerId: mockGetCustomerId,
			}),
		);

		const res = await app.request("/");
		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ error: "customerId not defined" });
	});
});

describe("Webhooks middleware", () => {
	it("should call onPayload with the payload", async () => {
		const app = new Hono();
		const mockOnPayload = vi.fn();
		app.use(
			"*",
			Webhooks({
				webhookSecret: "mock-secret",
				onPayload: mockOnPayload,
			}),
		);

		const payload = { event: "mock-event", data: "mock-data" };

		const res = await app.request("/", {
			method: "POST",
			body: JSON.stringify(payload),
		});
		expect(res.status).toBe(200);
		expect(mockOnPayload).toHaveBeenCalledWith(payload);
	});

	it("should acknowledge the webhook", async () => {
		const app = new Hono();
		const mockOnPayload = vi.fn();
		app.use(
			"*",
			Webhooks({
				webhookSecret: "mock-secret",
				onPayload: mockOnPayload,
			}),
		);

		const payload = { event: "mock-event", data: "mock-data" };

		const res = await app.request("/", {
			method: "POST",
			body: JSON.stringify(payload),
		});
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ received: true });
	});
});
