import type { Polar } from "@polar-sh/sdk";
import type { User } from "better-auth";
import { vi } from "vitest";

export const createMockPolarClient = (): Polar =>
	({
		products: {
			get: vi.fn(),
			list: vi.fn(),
		},
		checkouts: {
			create: vi.fn(),
			get: vi.fn(),
		},
		customers: {
			create: vi.fn(),
			update: vi.fn(),
			updateExternal: vi.fn(),
			get: vi.fn(),
			getStateExternal: vi.fn(),
			list: vi.fn(),
		},
		customerSessions: {
			create: vi.fn(),
		},
		customerPortal: {
			create: vi.fn(),
			benefitGrants: {
				list: vi.fn(),
			},
			subscriptions: {
				list: vi.fn(),
			},
			orders: {
				list: vi.fn(),
			},
			customerMeters: {
				list: vi.fn(),
			},
		},
		orders: {
			list: vi.fn(),
		},
		subscriptions: {
			list: vi.fn(),
		},
		benefits: {
			list: vi.fn(),
		},
		events: {
			ingest: vi.fn(),
		},
		usageRecords: {
			create: vi.fn(),
		},
		meters: {
			list: vi.fn(),
		},
		webhookEndpoints: {
			verify: vi.fn(),
		},
	}) as any;

export const createMockUser = (overrides: Partial<User> = {}): User => ({
	id: "user-123",
	email: "test@example.com",
	name: "Test User",
	image: null,
	createdAt: new Date(),
	updatedAt: new Date(),
	emailVerified: false,
	...overrides,
});

export const createMockBetterAuthContext = () => ({
	request: new Request("http://localhost:3000/test"),
	session: {
		session: {
			id: "session-123",
			userId: "user-123",
			expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
			token: "session-token",
			ipAddress: "127.0.0.1",
			userAgent: "test-agent",
			createdAt: new Date(),
			updatedAt: new Date(),
		},
		user: createMockUser(),
	},
	headers: new Headers(),
	body: {},
	method: "GET" as const,
	path: "/test",
	params: {},
	query: {},
});

export const createMockProduct = () => ({
	id: "product-123",
	name: "Test Product",
	description: "A test product",
	isRecurring: false,
	isArchived: false,
	organizationId: "org-123",
	createdAt: new Date().toISOString(),
	modifiedAt: new Date().toISOString(),
	prices: [],
	benefits: [],
	medias: [],
});

export const createMockCheckout = () => ({
	id: "checkout-123",
	url: "https://polar.sh/checkout/checkout-123",
	customerId: "customer-123",
	customerEmail: "test@example.com",
	productId: "product-123",
	productPriceId: "price-123",
	successUrl: "https://example.com/success",
	createdAt: new Date().toISOString(),
	modifiedAt: new Date().toISOString(),
	expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
	allowDiscountCodes: true,
	discountId: undefined,
});

export const createMockCustomer = () => ({
	id: "customer-123",
	email: "test@example.com",
	emailVerified: true,
	name: "Test Customer",
	billingAddress: null,
	taxId: null,
	organizationId: "org-123",
	avatarUrl: null,
	createdAt: new Date().toISOString(),
	modifiedAt: new Date().toISOString(),
	metadata: {},
});
