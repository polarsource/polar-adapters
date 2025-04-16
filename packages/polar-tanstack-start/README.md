# @polar-sh/tanstack-start

Payments and Checkouts made dead simple with [Tanstack Start](https://tanstack.com/start)

`pnpm install @polar-sh/tanstack-start zod`

## Checkout

Create a Checkout handler which takes care of redirections.

```typescript
// routes/api/checkout.ts
import { Checkout } from '@polar-sh/tanstack-start'
import { createAPIFileRoute } from '@tanstack/react-start/api'

export const APIRoute = createAPIFileRoute('/api/checkout')({
    GET: Checkout({
        accessToken: process.env.POLAR_ACCESS_TOKEN,
        successUrl: process.env.SUCCESS_URL,
		server: "sandbox", // Use sandbox if you're testing Polar - omit the parameter or pass 'production' otherwise
    })
})
```

### Query Params

Pass query params to this route.

- productId (or productPriceId) `?productId=xxx`
- productPriceId (or productId) `?productPriceId=xxx`
- customerId (optional) `?productId=xxx&customerId=xxx`
- customerExternalId (optional) `?productdId=xxx&customerExternalId=xxx`
- customerEmail (optional) `?productId=xxx&customerEmail=janedoe@gmail.com`
- customerName (optional) `?productId=xxx&customerName=Jane`
- metadata (optional) `URL-Encoded JSON string`

## Customer Portal

Create a customer portal where your customer can view orders and subscriptions.

```typescript
// routes/api/portal.ts
import { CustomerPortal } from '@polar-sh/tanstack-start';
import { createAPIFileRoute } from '@tanstack/react-start/api';
import { getSupabaseServerClient } from '~/servers/supabase-server';

export const APIRoute = createAPIFileRoute('/api/portal')({
    GET: CustomerPortal({
      	accessToken: process.env.POLAR_ACCESS_TOKEN,
		getCustomerId: async (request: Request) => "", // Fuction to resolve a Polar Customer ID
		server: "sandbox", // Use sandbox if you're testing Polar - omit the parameter or pass 'production' otherwise
	})
})
```

## Webhooks

A simple utility which resolves incoming webhook payloads by signing the webhook secret properly.

```typescript
// api/webhook/polar.ts
import { Webhooks } from '@polar-sh/tanstack-start'
import { createAPIFileRoute } from '@tanstack/react-start/api'

export const APIRoute = createAPIFileRoute('/api/webhook/polar')({
  POST: Webhooks({
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
    onPayload: async (payload) => {
      // Handle the payload
      // No need to return an acknowledge response
    },
  })
})
```

#### Payload Handlers

The Webhook handler also supports granular handlers for easy integration.

- onCheckoutCreated: (payload) =>
- onCheckoutUpdated: (payload) =>
- onOrderCreated: (payload) =>
- onOrderUpdated: (payload) =>
- onOrderPaid: (payload) =>
- onSubscriptionCreated: (payload) =>
- onSubscriptionUpdated: (payload) =>
- onSubscriptionActive: (payload) =>
- onSubscriptionCanceled: (payload) =>
- onSubscriptionRevoked: (payload) =>
- onProductCreated: (payload) =>
- onProductUpdated: (payload) =>
- onOrganizationUpdated: (payload) =>
- onBenefitCreated: (payload) =>
- onBenefitUpdated: (payload) =>
- onBenefitGrantCreated: (payload) =>
- onBenefitGrantUpdated: (payload) =>
- onBenefitGrantRevoked: (payload) =>
- onCustomerCreated: (payload) =>
- onCustomerUpdated: (payload) =>
- onCustomerDeleted: (payload) =>
- onCustomerStateChanged: (payload) =>
