import { beforeEach, describe, expect, it, vi } from "vitest";
import { portal } from "../../plugins/portal";
import { mockApiError } from "../utils/helpers";
import { createMockPolarClient } from "../utils/mocks";

vi.mock("better-auth/api", () => ({
	APIError: class APIError extends Error {
		constructor(
			public code: string,
			public data: { message: string },
		) {
			super(data.message);
		}
	},
	sessionMiddleware: vi.fn(),
}));

vi.mock("better-auth/plugins", () => ({
	createAuthEndpoint: vi.fn((path, config, handler) => ({
		path,
		config,
		handler,
	})),
}));

const { APIError, sessionMiddleware } = (await vi.importMock(
	"better-auth/api",
)) as any;
const { createAuthEndpoint } = (await vi.importMock(
	"better-auth/plugins",
)) as any;

describe("portal plugin", () => {
	let mockClient: ReturnType<typeof createMockPolarClient>;

	beforeEach(() => {
		mockClient = createMockPolarClient();
		vi.clearAllMocks();
	});

	describe("plugin creation", () => {
		it("should create portal plugin with all endpoints", () => {
			const plugin = portal();
			const endpoints = plugin(mockClient);

			expect(endpoints).toHaveProperty("portal");
			expect(endpoints).toHaveProperty("state");
			expect(endpoints).toHaveProperty("benefits");
			expect(endpoints).toHaveProperty("subscriptions");
			expect(endpoints).toHaveProperty("orders");
		});

		it("should configure endpoints with correct paths and middleware", () => {
			const plugin = portal();
			plugin(mockClient);

			expect(createAuthEndpoint).toHaveBeenCalledWith(
				"/customer/portal",
				expect.objectContaining({
					method: ["GET", "POST"],
					use: [sessionMiddleware],
				}),
				expect.any(Function),
			);

			expect(createAuthEndpoint).toHaveBeenCalledWith(
				"/customer/state",
				expect.objectContaining({
					method: "GET",
					use: [sessionMiddleware],
				}),
				expect.any(Function),
			);
		});
	});

	describe("portal endpoint", () => {
		let handler: Function;

		beforeEach(() => {
			const plugin = portal();
			const endpoints = plugin(mockClient);
			handler = endpoints.portal.handler;
		});

		it("should create customer portal session and return URL", async () => {
			const mockSession = {
				token: "session-token-123",
				customerPortalUrl: "https://polar.sh/portal/session-123",
			};

			vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
				mockSession,
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
				},
				json: vi.fn(),
			};

			await handler(ctx);

			expect(mockClient.customerSessions.create).toHaveBeenCalledWith({
				externalCustomerId: "user-123",
			});

			expect(ctx.json).toHaveBeenCalledWith({
				url: "https://polar.sh/portal/session-123",
				redirect: true,
			});
		});

		it("should throw error when user not found", async () => {
			const ctx = {
				context: {
					session: null,
				},
			};

			await expect(handler(ctx)).rejects.toThrow("User not found");
		});

		it("should return redirect: false when body param is false (POST)", async () => {
			const mockSession = {
				token: "session-token-123",
				customerPortalUrl: "https://polar.sh/portal/session-123",
			};

			vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
				mockSession,
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
				},
				body: { redirect: false },
				json: vi.fn(),
			};

			await handler(ctx);

			expect(ctx.json).toHaveBeenCalledWith({
				url: "https://polar.sh/portal/session-123",
				redirect: false,
			});
		});

		it("should return redirect: true when body param is true (POST)", async () => {
			const mockSession = {
				token: "session-token-123",
				customerPortalUrl: "https://polar.sh/portal/session-123",
			};

			vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
				mockSession,
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
				},
				body: { redirect: true },
				json: vi.fn(),
			};

			await handler(ctx);

			expect(ctx.json).toHaveBeenCalledWith({
				url: "https://polar.sh/portal/session-123",
				redirect: true,
			});
		});

		it("should handle API errors", async () => {
			vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
				mockApiError(400, "Customer not found"),
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
					logger: { error: vi.fn() },
				},
			};

			await expect(handler(ctx)).rejects.toThrow(
				"Customer portal creation failed",
			);
			expect(ctx.context.logger.error).toHaveBeenCalledWith(
				expect.stringContaining("Polar customer portal creation failed"),
			);
		});
	});

	describe("state endpoint", () => {
		let handler: Function;

		beforeEach(() => {
			const plugin = portal();
			const endpoints = plugin(mockClient);
			handler = endpoints.state.handler;
		});

		it("should get customer state", async () => {
			const mockState = {
				customer: { id: "customer-123", email: "test@example.com" },
				subscriptions: [],
				orders: [],
			};

			vi.mocked(mockClient.customers.getStateExternal).mockResolvedValue(
				mockState,
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
				},
				json: vi.fn(),
			};

			await handler(ctx);

			expect(mockClient.customers.getStateExternal).toHaveBeenCalledWith({
				externalId: "user-123",
			});

			expect(ctx.json).toHaveBeenCalledWith(mockState);
		});

		it("should throw error when user not found", async () => {
			const ctx = {
				context: {
					session: { user: { id: null } },
				},
			};

			await expect(handler(ctx)).rejects.toThrow("User not found");
		});

		it("should handle API errors", async () => {
			vi.mocked(mockClient.customers.getStateExternal).mockRejectedValue(
				mockApiError(404, "Customer not found"),
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
					logger: { error: vi.fn() },
				},
			};

			await expect(handler(ctx)).rejects.toThrow("Subscriptions list failed");
			expect(ctx.context.logger.error).toHaveBeenCalledWith(
				expect.stringContaining("Polar subscriptions list failed"),
			);
		});
	});

	describe("benefits endpoint", () => {
		let handler: Function;

		beforeEach(() => {
			const plugin = portal();
			const endpoints = plugin(mockClient);
			handler = endpoints.benefits.handler;
		});

		it("should list customer benefits with pagination", async () => {
			const mockSession = { token: "session-token-123" };
			const mockBenefits = {
				items: [
					{ id: "benefit-1", name: "Premium Feature" },
					{ id: "benefit-2", name: "Extra Storage" },
				],
				pagination: { total: 2, maxPage: 1 },
			};

			vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
				mockSession,
			);
			vi.mocked(mockClient.customerPortal.benefitGrants.list).mockResolvedValue(
				mockBenefits,
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
				},
				query: { page: 1, limit: 10 },
				json: vi.fn(),
			};

			await handler(ctx);

			expect(mockClient.customerSessions.create).toHaveBeenCalledWith({
				externalCustomerId: "user-123",
			});

			expect(mockClient.customerPortal.benefitGrants.list).toHaveBeenCalledWith(
				{ customerSession: "session-token-123" },
				{ page: 1, limit: 10 },
			);

			expect(ctx.json).toHaveBeenCalledWith(mockBenefits);
		});

		it("should handle missing query parameters", async () => {
			const mockSession = { token: "session-token-123" };
			const mockBenefits = { items: [], pagination: { total: 0, maxPage: 1 } };

			vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
				mockSession,
			);
			vi.mocked(mockClient.customerPortal.benefitGrants.list).mockResolvedValue(
				mockBenefits,
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
				},
				query: undefined,
				json: vi.fn(),
			};

			await handler(ctx);

			expect(mockClient.customerPortal.benefitGrants.list).toHaveBeenCalledWith(
				{ customerSession: "session-token-123" },
				{ page: undefined, limit: undefined },
			);
		});

		it("should handle API errors", async () => {
			vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
				mockApiError(400, "Session creation failed"),
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
					logger: { error: vi.fn() },
				},
			};

			await expect(handler(ctx)).rejects.toThrow("Benefits list failed");
		});
	});

	describe("subscriptions endpoint", () => {
		let handler: Function;

		beforeEach(() => {
			const plugin = portal();
			const endpoints = plugin(mockClient);
			handler = endpoints.subscriptions.handler;
		});

		it("should list subscriptions via customer portal", async () => {
			const mockSession = { token: "session-token-123" };
			const mockSubscriptions = {
				items: [{ id: "sub-1", status: "active" }],
				pagination: { total: 1, maxPage: 1 },
			};

			vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
				mockSession,
			);
			vi.mocked(mockClient.customerPortal.subscriptions.list).mockResolvedValue(
				mockSubscriptions,
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
				},
				query: { page: 1, limit: 5, active: true },
				json: vi.fn(),
			};

			await handler(ctx);

			expect(mockClient.customerPortal.subscriptions.list).toHaveBeenCalledWith(
				{ customerSession: "session-token-123" },
				{ page: 1, limit: 5, active: true },
			);

			expect(ctx.json).toHaveBeenCalledWith(mockSubscriptions);
		});

		it("should list subscriptions by reference ID", async () => {
			const mockSubscriptions = {
				items: [{ id: "sub-1", metadata: { referenceId: "ref-123" } }],
				pagination: { total: 1, maxPage: 1 },
			};

			vi.mocked(mockClient.subscriptions.list).mockResolvedValue(
				mockSubscriptions,
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
				},
				query: { referenceId: "ref-123", page: 1, limit: 10 },
				json: vi.fn(),
			};

			await handler(ctx);

			expect(mockClient.subscriptions.list).toHaveBeenCalledWith({
				page: 1,
				limit: 10,
				active: undefined,
				metadata: { referenceId: "ref-123" },
			});

			expect(ctx.json).toHaveBeenCalledWith(mockSubscriptions);
		});

		it("should handle API errors for reference ID lookup", async () => {
			vi.mocked(mockClient.subscriptions.list).mockRejectedValue(
				mockApiError(400, "Subscription lookup failed"),
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
					logger: { error: vi.fn() },
				},
				query: { referenceId: "ref-123" },
			};

			await expect(handler(ctx)).rejects.toThrow(
				"Subscriptions list with referenceId failed",
			);
		});

		it("should handle API errors for customer portal lookup", async () => {
			vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
				mockApiError(400, "Session creation failed"),
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
					logger: { error: vi.fn() },
				},
				query: {},
			};

			await expect(handler(ctx)).rejects.toThrow(
				"Polar subscriptions list failed",
			);
		});
	});

	describe("orders endpoint", () => {
		let handler: Function;

		beforeEach(() => {
			const plugin = portal();
			const endpoints = plugin(mockClient);
			handler = endpoints.orders.handler;
		});

		it("should list customer orders with filters", async () => {
			const mockSession = { token: "session-token-123" };
			const mockOrders = {
				items: [{ id: "order-1", productBillingType: "recurring" }],
				pagination: { total: 1, maxPage: 1 },
			};

			vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
				mockSession,
			);
			vi.mocked(mockClient.customerPortal.orders.list).mockResolvedValue(
				mockOrders,
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
				},
				query: { page: 1, limit: 20, productBillingType: "recurring" },
				json: vi.fn(),
			};

			await handler(ctx);

			expect(mockClient.customerPortal.orders.list).toHaveBeenCalledWith(
				{ customerSession: "session-token-123" },
				{ page: 1, limit: 20, productBillingType: "recurring" },
			);

			expect(ctx.json).toHaveBeenCalledWith(mockOrders);
		});

		it("should handle one_time billing type filter", async () => {
			const mockSession = { token: "session-token-123" };
			const mockOrders = { items: [], pagination: { total: 0, maxPage: 1 } };

			vi.mocked(mockClient.customerSessions.create).mockResolvedValue(
				mockSession,
			);
			vi.mocked(mockClient.customerPortal.orders.list).mockResolvedValue(
				mockOrders,
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
				},
				query: { productBillingType: "one_time" },
				json: vi.fn(),
			};

			await handler(ctx);

			expect(mockClient.customerPortal.orders.list).toHaveBeenCalledWith(
				{ customerSession: "session-token-123" },
				expect.objectContaining({ productBillingType: "one_time" }),
			);
		});

		it("should throw error when user not found", async () => {
			const ctx = {
				context: {
					session: { user: { id: null } },
				},
			};

			await expect(handler(ctx)).rejects.toThrow("User not found");
		});

		it("should handle API errors", async () => {
			vi.mocked(mockClient.customerSessions.create).mockRejectedValue(
				mockApiError(400, "Session creation failed"),
			);

			const ctx = {
				context: {
					session: { user: { id: "user-123" } },
					logger: { error: vi.fn() },
				},
			};

			await expect(handler(ctx)).rejects.toThrow("Orders list failed");
		});
	});
});
