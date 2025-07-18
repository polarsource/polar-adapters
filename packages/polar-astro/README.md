# @polar-sh/astro

Payments and Checkouts made dead simple with Astro.

`pnpm install @polar-sh/astro`

## Checkout

Create a Checkout handler which takes care of redirections.

```typescript
import { Checkout } from "@polar-sh/astro";
import { POLAR_ACCESS_TOKEN, POLAR_SUCCESS_URL } from "astro:env/server";

export const GET = Checkout({
  accessToken: POLAR_ACCESS_TOKEN,
  successUrl: POLAR_SUCCESS_URL,
  server: "sandbox", // Use sandbox if you're testing Polar - omit the parameter or pass 'production' otherwise
  theme: "dark" // Enforces the theme - System-preferred theme will be set if left omitted
});
```

### Query Params

Pass query params to this route.

- products `?products=123`
- customerId (optional) `?products=123&customerId=xxx`
- customerExternalId (optional) `?products=123&customerExternalId=xxx`
- customerEmail (optional) `?products=123&customerEmail=janedoe@gmail.com`
- customerName (optional) `?products=123&customerName=Jane`
- metadata (optional) `URL-Encoded JSON string`

## Customer Portal

Create a customer portal where your customer can view orders and subscriptions.

```typescript
import { CustomerPortal } from "@polar-sh/astro";
import { POLAR_ACCESS_TOKEN } from "astro:env/server";

export const GET = CustomerPortal({
  accessToken: POLAR_ACCESS_TOKEN,
  getCustomerId: (event) => "", // Fuction to resolve a Polar Customer ID
  server: "sandbox", // Use sandbox if you're testing Polar - omit the parameter or pass 'production' otherwise
});
```

## Webhooks

A simple utility which resolves incoming webhook payloads by signing the webhook secret properly.

```typescript
import { Webhooks } from '@polar-sh/astro';
import { POLAR_WEBHOOK_SECRET } from "astro:env/server"

export const POST = Webhooks({
  webhookSecret: POLAR_WEBHOOK_SECRET,
  onPayload: async (payload) => /** Handle payload */,
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
