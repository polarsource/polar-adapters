import { describe, it, expect, vi, beforeEach } from 'vitest'
import { onUserCreate, onUserUpdate } from '../../hooks/customer'
import { createMockPolarClient, createMockUser, createMockCustomer } from '../utils/mocks'
import { createTestPolarOptions, mockApiError } from '../utils/helpers'

vi.mock('better-auth/api', () => ({
	APIError: class APIError extends Error {
		constructor(public code: string, public data: { message: string }) {
			super(data.message)
		}
	},
}))

const { APIError } = await vi.importMock('better-auth/api') as any

describe('customer hooks', () => {
	let mockClient: ReturnType<typeof createMockPolarClient>

	beforeEach(() => {
		mockClient = createMockPolarClient()
		vi.clearAllMocks()
		// Mock console.log to avoid test output noise
		vi.spyOn(console, 'log').mockImplementation(() => {})
	})

	describe('onUserCreate', () => {
		it('should create customer when createCustomerOnSignUp is enabled', async () => {
			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: true,
			})

			const mockUser = createMockUser({
				id: 'user-123',
				email: 'test@example.com',
				name: 'Test User',
			})

			const mockCustomer = createMockCustomer()

			// Mock empty customer list (no existing customer)
			vi.mocked(mockClient.customers.list).mockResolvedValue({
				result: { items: [], pagination: { total: 0, maxPage: 1 } },
			})

			vi.mocked(mockClient.customers.create).mockResolvedValue(mockCustomer)

			const ctx = { context: { logger: { error: vi.fn() } } } as any
			const hook = onUserCreate(options)

			await hook(mockUser, ctx)

			expect(mockClient.customers.list).toHaveBeenCalledWith({
				email: 'test@example.com',
			})

			expect(mockClient.customers.create).toHaveBeenCalledWith({
				email: 'test@example.com',
				name: 'Test User',
				externalId: 'user-123',
			})
		})

		it('should update existing customer without external ID', async () => {
			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: true,
			})

			const mockUser = createMockUser({
				id: 'user-123',
				email: 'test@example.com',
				name: 'Test User',
			})

			const existingCustomer = {
				...createMockCustomer(),
				id: 'customer-456',
				externalId: null, // No external ID set
			}

			// Mock existing customer found
			vi.mocked(mockClient.customers.list).mockResolvedValue({
				result: { items: [existingCustomer], pagination: { total: 1, maxPage: 1 } },
			})

			vi.mocked(mockClient.customers.update).mockResolvedValue(existingCustomer)

			const ctx = { context: { logger: { error: vi.fn() } } } as any
			const hook = onUserCreate(options)

			await hook(mockUser, ctx)

			expect(mockClient.customers.update).toHaveBeenCalledWith({
				id: 'customer-456',
				customerUpdate: {
					externalId: 'user-123',
				},
			})

			expect(mockClient.customers.create).not.toHaveBeenCalled()
		})

		it('should update existing customer with different external ID', async () => {
			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: true,
			})

			const mockUser = createMockUser({
				id: 'user-123',
				email: 'test@example.com',
			})

			const existingCustomer = {
				...createMockCustomer(),
				id: 'customer-456',
				externalId: 'different-user-id',
			}

			vi.mocked(mockClient.customers.list).mockResolvedValue({
				result: { items: [existingCustomer], pagination: { total: 1, maxPage: 1 } },
			})

			vi.mocked(mockClient.customers.update).mockResolvedValue(existingCustomer)

			const ctx = { context: { logger: { error: vi.fn() } } } as any
			const hook = onUserCreate(options)

			await hook(mockUser, ctx)

			expect(mockClient.customers.update).toHaveBeenCalledWith({
				id: 'customer-456',
				customerUpdate: {
					externalId: 'user-123',
				},
			})
		})

		it('should not update existing customer with same external ID', async () => {
			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: true,
			})

			const mockUser = createMockUser({
				id: 'user-123',
				email: 'test@example.com',
			})

			const existingCustomer = {
				...createMockCustomer(),
				id: 'customer-456',
				externalId: 'user-123', // Same external ID
			}

			vi.mocked(mockClient.customers.list).mockResolvedValue({
				result: { items: [existingCustomer], pagination: { total: 1, maxPage: 1 } },
			})

			const ctx = { context: { logger: { error: vi.fn() } } } as any
			const hook = onUserCreate(options)

			await hook(mockUser, ctx)

			expect(mockClient.customers.update).not.toHaveBeenCalled()
			expect(mockClient.customers.create).not.toHaveBeenCalled()
		})

		it('should use custom getCustomerCreateParams when provided', async () => {
			const mockGetCustomerCreateParams = vi.fn().mockResolvedValue({
				metadata: { source: 'website', plan: 'premium' },
			})

			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: true,
				getCustomerCreateParams: mockGetCustomerCreateParams,
			})

			const mockUser = createMockUser()
			const mockCustomer = createMockCustomer()

			vi.mocked(mockClient.customers.list).mockResolvedValue({
				result: { items: [], pagination: { total: 0, maxPage: 1 } },
			})

			vi.mocked(mockClient.customers.create).mockResolvedValue(mockCustomer)

			const ctx = { context: { logger: { error: vi.fn() } } } as any
			const hook = onUserCreate(options)

			await hook(mockUser, ctx)

			expect(mockGetCustomerCreateParams).toHaveBeenCalledWith({ user: mockUser })

			expect(mockClient.customers.create).toHaveBeenCalledWith({
				email: mockUser.email,
				name: mockUser.name,
				externalId: mockUser.id,
				metadata: { source: 'website', plan: 'premium' },
			})
		})

		it('should use custom params for existing customer update', async () => {
			const mockGetCustomerCreateParams = vi.fn().mockResolvedValue({
				metadata: { updated: 'true' },
			})

			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: true,
				getCustomerCreateParams: mockGetCustomerCreateParams,
			})

			const mockUser = createMockUser()
			const existingCustomer = {
				...createMockCustomer(),
				externalId: null,
			}

			vi.mocked(mockClient.customers.list).mockResolvedValue({
				result: { items: [existingCustomer], pagination: { total: 1, maxPage: 1 } },
			})

			const ctx = { context: { logger: { error: vi.fn() } } } as any
			const hook = onUserCreate(options)

			await hook(mockUser, ctx)

			expect(mockClient.customers.update).toHaveBeenCalledWith({
				id: existingCustomer.id,
				customerUpdate: {
					externalId: mockUser.id,
					metadata: { updated: 'true' },
				},
			})
		})

		it('should not create customer when createCustomerOnSignUp is disabled', async () => {
			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: false,
			})

			const mockUser = createMockUser()
			const ctx = { context: { logger: { error: vi.fn() } } } as any
			const hook = onUserCreate(options)

			await hook(mockUser, ctx)

			expect(mockClient.customers.list).not.toHaveBeenCalled()
			expect(mockClient.customers.create).not.toHaveBeenCalled()
		})

		it('should not create customer when context is missing', async () => {
			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: true,
			})

			const mockUser = createMockUser()
			const hook = onUserCreate(options)

			await hook(mockUser) // No context provided

			expect(mockClient.customers.list).not.toHaveBeenCalled()
			expect(mockClient.customers.create).not.toHaveBeenCalled()
		})

		it('should handle API errors during customer creation', async () => {
			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: true,
			})

			const mockUser = createMockUser()

			vi.mocked(mockClient.customers.list).mockRejectedValue(
				mockApiError(500, 'Internal server error')
			)

			const ctx = { context: { logger: { error: vi.fn() } } } as any
			const hook = onUserCreate(options)

			await expect(hook(mockUser, ctx)).rejects.toThrow(
				'Polar customer creation failed. Error: Internal server error'
			)
		})

		it('should handle non-Error exceptions', async () => {
			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: true,
			})

			const mockUser = createMockUser()

			vi.mocked(mockClient.customers.list).mockRejectedValue('Unknown error')

			const ctx = { context: { logger: { error: vi.fn() } } } as any
			const hook = onUserCreate(options)

			await expect(hook(mockUser, ctx)).rejects.toThrow(
				'Polar customer creation failed. Error: Unknown error'
			)
		})
	})

	describe('onUserUpdate', () => {
		it('should update customer when createCustomerOnSignUp is enabled', async () => {
			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: true,
			})

			const mockUser = createMockUser({
				id: 'user-123',
				email: 'updated@example.com',
				name: 'Updated User',
			})

			const mockCustomer = createMockCustomer()
			vi.mocked(mockClient.customers.updateExternal).mockResolvedValue(mockCustomer)

			const ctx = {
				context: { logger: { error: vi.fn() } },
			} as any

			const hook = onUserUpdate(options)

			await hook(mockUser, ctx)

			expect(mockClient.customers.updateExternal).toHaveBeenCalledWith({
				externalId: 'user-123',
				customerUpdateExternalID: {
					email: 'updated@example.com',
					name: 'Updated User',
				},
			})
		})

		it('should not update customer when createCustomerOnSignUp is disabled', async () => {
			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: false,
			})

			const mockUser = createMockUser()
			const ctx = {
				context: { logger: { error: vi.fn() } },
			} as any

			const hook = onUserUpdate(options)

			await hook(mockUser, ctx)

			expect(mockClient.customers.updateExternal).not.toHaveBeenCalled()
		})

		it('should not update customer when context is missing', async () => {
			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: true,
			})

			const mockUser = createMockUser()
			const hook = onUserUpdate(options)

			await hook(mockUser) // No context provided

			expect(mockClient.customers.updateExternal).not.toHaveBeenCalled()
		})

		it('should handle API errors during customer update', async () => {
			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: true,
			})

			const mockUser = createMockUser()

			vi.mocked(mockClient.customers.updateExternal).mockRejectedValue(
				mockApiError(404, 'Customer not found')
			)

			const ctx = {
				context: { logger: { error: vi.fn() } },
			} as any

			const hook = onUserUpdate(options)

			// Should not throw, just log the error
			await hook(mockUser, ctx)

			expect(ctx.context.logger.error).toHaveBeenCalledWith(
				'Polar customer update failed. Error: Customer not found'
			)
		})

		it('should handle non-Error exceptions during update', async () => {
			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: true,
			})

			const mockUser = createMockUser()

			vi.mocked(mockClient.customers.updateExternal).mockRejectedValue('Unknown error')

			const ctx = {
				context: { logger: { error: vi.fn() } },
			} as any

			const hook = onUserUpdate(options)

			await hook(mockUser, ctx)

			expect(ctx.context.logger.error).toHaveBeenCalledWith(
				'Polar customer update failed. Error: Unknown error'
			)
		})

		it('should handle network timeouts gracefully', async () => {
			const options = createTestPolarOptions({
				client: mockClient,
				createCustomerOnSignUp: true,
			})

			const mockUser = createMockUser()

			vi.mocked(mockClient.customers.updateExternal).mockRejectedValue(
				new Error('Network timeout')
			)

			const ctx = {
				context: { logger: { error: vi.fn() } },
			} as any

			const hook = onUserUpdate(options)

			await hook(mockUser, ctx)

			expect(ctx.context.logger.error).toHaveBeenCalledWith(
				'Polar customer update failed. Error: Network timeout'
			)
		})
	})
})