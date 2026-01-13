import type { Polar } from "@polar-sh/sdk";
import type { Customer } from "@polar-sh/sdk/models/components/customer.js";
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
	}) as unknown as Polar;

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

export const createMockCustomer = (
	overrides: Partial<Customer> = {},
): Customer => ({
	id: "customer-123",
	email: "test@example.com",
	emailVerified: true,
	name: "Test Customer",
	billingAddress: null,
	taxId: null,
	organizationId: "org-123",
	avatarUrl: "",
	createdAt: new Date(),
	modifiedAt: new Date(),
	externalId: "external-id-123",
	deletedAt: null,
	metadata: {},
	...overrides,
});
