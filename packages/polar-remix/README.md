# @polar-sh/remix

Payments and Checkouts made dead simple with Remix.

`pnpm install @polar-sh/remix`

## Checkout

Create a Checkout handler which takes care of redirections.

```typescript
import { Checkout } from "@polar-sh/remix";

export const loader = Checkout({
  accessToken: 'xxx', // Or set an environment variable to POLAR_ACCESS_TOKEN
  successUrl: process.env.SUCCESS_URL,
  server: "sandbox", // Use sandbox if you're testing Polar - omit the parameter or pass 'production' otherwise
})
```

### Query Params

Pass query params to this route.

- productId (required) `?productId=xxx`
- customerId (optional) `?productId=xxx&customerId=xxx`
- customerEmail (optional) `?productId=xxx&customerEmail=janedoe@gmail.com`
- customerName (optional) `?productId=xxx&customerName=Jane`

## Customer Portal

Create a customer portal where your customer can view orders and subscriptions.

```typescript
import { CustomerPortal } from "@polar-sh/remix";

export const loader = CustomerPortal({
  accessToken: 'xxx', // Or set an environment variable to POLAR_ACCESS_TOKEN
  getCustomerId: (event) => "", // Fuction to resolve a Polar Customer ID
  server: "sandbox", // Use sandbox if you're testing Polar - omit the parameter or pass 'production' otherwise
})
```

## Webhooks

A simple utility which resolves incoming webhook payloads by signing the webhook secret properly.

```typescript
import { Webhooks } from "@polar-sh/remix";

export const action = Webhooks({
  webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
  onPayload: async (payload) => /** Handle payload */,
})
```