# @polar-sh/nuxt

Payments and Checkouts made dead simple with Nuxt.

`pnpm install @polar-sh/nuxt zod`

## Checkout

Create a Checkout handler which takes care of redirections.

```typescript
import { Checkout } from "@polar-sh/nuxt";

const checkout = Checkout({
  accessToken: "xxx", // Or set an environment variable to POLAR_ACCESS_TOKEN
  successUrl: process.env.SUCCESS_URL,
  server: "sandbox", // Use sandbox if you're testing Polar - omit the parameter or pass 'production' otherwise
});

export default defineEventHandler(checkout);
```

### Query Params

Pass query params to this route.

- productId (or productPriceId) `?productId=xxx`
- productPriceId (or productId) `?productPriceId=xxx`
- customerId (optional) `?productId=xxx&customerId=xxx`
- customerEmail (optional) `?productId=xxx&customerEmail=janedoe@gmail.com`
- customerName (optional) `?productId=xxx&customerName=Jane`

## Customer Portal

Create a customer portal where your customer can view orders and subscriptions.

```typescript
import { CustomerPortal } from "@polar-sh/nuxt";

const customerPortal = CustomerPortal({
  accessToken: "xxx", // Or set an environment variable to POLAR_ACCESS_TOKEN
  getCustomerId: (event) => "", // Fuction to resolve a Polar Customer ID
  server: "sandbox", // Use sandbox if you're testing Polar - omit the parameter or pass 'production' otherwise
});

export default defineEventHandler(customerPortal);
```

## Webhooks

A simple utility which resolves incoming webhook payloads by signing the webhook secret properly.

```typescript
import { Webhooks } from "@polar-sh/nuxt";

const webhooks = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onPayload: async (payload) => /** Handle payload */,
})

export default defineEventHandler(webhooks)
```

#### Payload Handlers

The Webhook handler also supports granular handlers for easy integration.

- onCheckoutCreated: (payload) =>
- onCheckoutUpdated: (payload) =>
- onOrderCreated: (payload) =>
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
