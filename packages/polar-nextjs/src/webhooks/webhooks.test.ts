import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@polar-sh/adapter-utils', () => ({
  handleWebhookPayload: vi.fn()
}))

vi.mock('@polar-sh/sdk/webhooks', () => ({
  validateEvent: vi.fn(),
  WebhookVerificationError: class WebhookVerificationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'WebhookVerificationError'
    }
  }
}))

import { Webhooks } from './webhooks'
import { handleWebhookPayload } from '@polar-sh/adapter-utils'
import { validateEvent } from '@polar-sh/sdk/webhooks'

const mockHandleWebhookPayload = vi.mocked(handleWebhookPayload)
const mockValidateEvent = vi.mocked(validateEvent)

describe('Webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('webhook validation', () => {
    it('should validate webhook headers and process payload', async () => {
      const mockPayload = { type: 'checkout.completed', data: { id: 'checkout_123' } }
      mockValidateEvent.mockReturnValue(mockPayload)
      mockHandleWebhookPayload.mockResolvedValue(undefined)

      const webhookHandler = Webhooks({
        webhookSecret: 'secret_123',
        entitlements: {},
        onPayload: vi.fn()
      })

      const request = new NextRequest('https://example.com/webhooks', {
        method: 'POST',
        body: JSON.stringify(mockPayload),
        headers: {
          'webhook-id': 'wh_123',
          'webhook-timestamp': '1234567890',
          'webhook-signature': 'v1,signature'
        }
      })

      const response = await webhookHandler(request)
      const data = await response.json()

      expect(mockValidateEvent).toHaveBeenCalledWith(
        JSON.stringify(mockPayload),
        {
          'webhook-id': 'wh_123',
          'webhook-timestamp': '1234567890',
          'webhook-signature': 'v1,signature'
        },
        'secret_123'
      )

      expect(mockHandleWebhookPayload).toHaveBeenCalledWith(
        mockPayload,
        {
          webhookSecret: 'secret_123',
          entitlements: {},
          onPayload: expect.any(Function)
        }
      )

      expect(response.status).toBe(200)
      expect(data.received).toBe(true)
    })

    it('should handle missing webhook headers', async () => {
      const mockPayload = { type: 'checkout.completed', data: { id: 'checkout_123' } }
      mockValidateEvent.mockReturnValue(mockPayload)
      mockHandleWebhookPayload.mockResolvedValue(undefined)

      const webhookHandler = Webhooks({
        webhookSecret: 'secret_123',
        entitlements: {}
      })

      const request = new NextRequest('https://example.com/webhooks', {
        method: 'POST',
        body: JSON.stringify(mockPayload)
      })

      const response = await webhookHandler(request)

      expect(mockValidateEvent).toHaveBeenCalledWith(
        JSON.stringify(mockPayload),
        {
          'webhook-id': '',
          'webhook-timestamp': '',
          'webhook-signature': ''
        },
        'secret_123'
      )

      expect(response.status).toBe(200)
    })

    it('should return 403 for webhook verification errors', async () => {
      const { WebhookVerificationError } = await import('@polar-sh/sdk/webhooks')
      mockValidateEvent.mockImplementation(() => {
        throw new WebhookVerificationError('Invalid signature')
      })

      const webhookHandler = Webhooks({
        webhookSecret: 'secret_123',
        entitlements: {}
      })

      const request = new NextRequest('https://example.com/webhooks', {
        method: 'POST',
        body: 'invalid payload',
        headers: {
          'webhook-id': 'wh_123',
          'webhook-timestamp': '1234567890',
          'webhook-signature': 'invalid'
        }
      })

      const response = await webhookHandler(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.received).toBe(false)
      expect(mockHandleWebhookPayload).not.toHaveBeenCalled()
    })

    it('should re-throw non-verification errors', async () => {
      mockValidateEvent.mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const webhookHandler = Webhooks({
        webhookSecret: 'secret_123',
        entitlements: {}
      })

      const request = new NextRequest('https://example.com/webhooks', {
        method: 'POST',
        body: 'test payload'
      })

      await expect(webhookHandler(request)).rejects.toThrow('Unexpected error')
    })
  })

  describe('webhook configuration', () => {
    it('should pass all configuration to handleWebhookPayload', async () => {
      const mockPayload = { type: 'checkout.completed', data: { id: 'checkout_123' } }
      const onPayload = vi.fn()
      const onCheckoutCompleted = vi.fn()
      const entitlements = { testEntitlement: {} }

      mockValidateEvent.mockReturnValue(mockPayload)
      mockHandleWebhookPayload.mockResolvedValue(undefined)

      const webhookHandler = Webhooks({
        webhookSecret: 'secret_123',
        entitlements,
        onPayload,
        'checkout.completed': onCheckoutCompleted
      })

      const request = new NextRequest('https://example.com/webhooks', {
        method: 'POST',
        body: JSON.stringify(mockPayload),
        headers: {
          'webhook-id': 'wh_123',
          'webhook-timestamp': '1234567890',
          'webhook-signature': 'v1,signature'
        }
      })

      await webhookHandler(request)

      expect(mockHandleWebhookPayload).toHaveBeenCalledWith(
        mockPayload,
        {
          webhookSecret: 'secret_123',
          entitlements,
          onPayload,
          'checkout.completed': onCheckoutCompleted
        }
      )
    })

    it('should handle minimal configuration', async () => {
      const mockPayload = { type: 'test.event', data: {} }
      mockValidateEvent.mockReturnValue(mockPayload)
      mockHandleWebhookPayload.mockResolvedValue(undefined)

      const webhookHandler = Webhooks({
        webhookSecret: 'secret_123'
      })

      const request = new NextRequest('https://example.com/webhooks', {
        method: 'POST',
        body: JSON.stringify(mockPayload)
      })

      const response = await webhookHandler(request)

      expect(mockHandleWebhookPayload).toHaveBeenCalledWith(
        mockPayload,
        {
          webhookSecret: 'secret_123'
        }
      )

      expect(response.status).toBe(200)
    })

    it('should handle multiple event handlers', async () => {
      const mockPayload = { type: 'subscription.created', data: { id: 'sub_123' } }
      const onSubscriptionCreated = vi.fn()
      const onSubscriptionUpdated = vi.fn()

      mockValidateEvent.mockReturnValue(mockPayload)
      mockHandleWebhookPayload.mockResolvedValue(undefined)

      const webhookHandler = Webhooks({
        webhookSecret: 'secret_123',
        'subscription.created': onSubscriptionCreated,
        'subscription.updated': onSubscriptionUpdated
      })

      const request = new NextRequest('https://example.com/webhooks', {
        method: 'POST',
        body: JSON.stringify(mockPayload)
      })

      await webhookHandler(request)

      expect(mockHandleWebhookPayload).toHaveBeenCalledWith(
        mockPayload,
        {
          webhookSecret: 'secret_123',
          'subscription.created': onSubscriptionCreated,
          'subscription.updated': onSubscriptionUpdated
        }
      )
    })
  })

  describe('request body handling', () => {
    it('should read request body as text', async () => {
      const mockPayload = { type: 'test.event', data: {} }
      const payloadString = JSON.stringify(mockPayload)
      
      mockValidateEvent.mockReturnValue(mockPayload)
      mockHandleWebhookPayload.mockResolvedValue(undefined)

      const webhookHandler = Webhooks({
        webhookSecret: 'secret_123'
      })

      const request = new NextRequest('https://example.com/webhooks', {
        method: 'POST',
        body: payloadString
      })

      await webhookHandler(request)

      expect(mockValidateEvent).toHaveBeenCalledWith(
        payloadString,
        expect.any(Object),
        'secret_123'
      )
    })

    it('should handle empty request body', async () => {
      mockValidateEvent.mockReturnValue({})
      mockHandleWebhookPayload.mockResolvedValue(undefined)

      const webhookHandler = Webhooks({
        webhookSecret: 'secret_123'
      })

      const request = new NextRequest('https://example.com/webhooks', {
        method: 'POST',
        body: ''
      })

      const response = await webhookHandler(request)

      expect(mockValidateEvent).toHaveBeenCalledWith(
        '',
        expect.any(Object),
        'secret_123'
      )

      expect(response.status).toBe(200)
    })
  })
})