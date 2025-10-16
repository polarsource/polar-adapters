# @polar-sh/supabase

Payments and Checkouts made dead simple with Supabase Edge Functions.

`npm install @polar-sh/supabase`

## Checkout

Create a Checkout handler which takes care of redirections.

```typescript
// supabase/functions/checkout/index.ts
import { Checkout } from "@polar-sh/supabase";

const handler = Checkout({
	accessToken: Deno.env.get("POLAR_ACCESS_TOKEN"),
	successUrl: Deno.env.get("SUCCESS_URL"),
    returnUrl: "https://myapp.com", // Optional Return URL, which renders a Back-button in the Checkout
	server: "sandbox", // Use sandbox if you're testing Polar - omit the parameter or pass 'production' otherwise
	theme: "dark", // Enforces the theme - System-preferred theme will be set if left omitted
});

Deno.serve(handler);
```

### Query Params

Pass query params to this route.

- products `?products=123`
- customerId (optional) `?products=123&customerId=xxx`
- customerExternalId (optional) `?products=123&customerExternalId=xxx`
- customerEmail (optional) `?products=123&customerEmail=janedoe@gmail.com`
- customerName (optional) `?products=123&customerName=Jane`
- customerBillingAddress (optional) `URL-Encoded JSON string`
- customerTaxId (optional) `?products=123&customerTaxId=xxx`
- customerIpAddress (optional) `?products=123&customerIpAddress=192.168.1.1`
- customerMetadata (optional) `URL-Encoded JSON string`
- allowDiscountCodes (optional) `?products=123&allowDiscountCodes=true`
- discountId (optional) `?products=123&discountId=xxx`
- metadata (optional) `URL-Encoded JSON string`

## Customer Portal

Create a customer portal where your customer can view orders and subscriptions.

```typescript
// supabase/functions/portal/index.ts
import { CustomerPortal } from "@polar-sh/supabase";

const handler = CustomerPortal({
	accessToken: Deno.env.get("POLAR_ACCESS_TOKEN")!,
	getCustomerId: async (req: Request) => {
		// Function to resolve a Polar Customer ID
		// You can extract customer ID from auth headers, cookies, etc.
		return "123";
	},
    returnUrl: "https://myapp.com", // Optional Return URL, which renders a Back-button in the Customer Portal
	server: "sandbox", // Use sandbox if you're testing Polar - omit the parameter or pass 'production' otherwise
});

Deno.serve(handler);
```

## Webhooks

A simple utility which resolves incoming webhook payloads by validating the webhook signature.

```typescript
// supabase/functions/webhooks/index.ts
import { Webhooks } from "@polar-sh/supabase";

const handler = Webhooks({
	webhookSecret: Deno.env.get("POLAR_WEBHOOK_SECRET")!,
	onPayload: async (payload) => {
		// Handle the payload
		// No need to return an acknowledge response
	},
});

Deno.serve(handler);
```

### Payload Handlers

The Webhook handler also supports granular handlers for easy integration.

- onCheckoutCreated: (payload) => Promise<void>
- onCheckoutUpdated: (payload) => Promise<void>
- onOrderCreated: (payload) => Promise<void>
- onOrderUpdated: (payload) => Promise<void>
- onOrderPaid: (payload) => Promise<void>
- onOrderRefunded: (payload) => Promise<void>
- onRefundCreated: (payload) => Promise<void>
- onRefundUpdated: (payload) => Promise<void>
- onSubscriptionCreated: (payload) => Promise<void>
- onSubscriptionUpdated: (payload) => Promise<void>
- onSubscriptionActive: (payload) => Promise<void>
- onSubscriptionCanceled: (payload) => Promise<void>
- onSubscriptionRevoked: (payload) => Promise<void>
- onSubscriptionUncanceled: (payload) => Promise<void>
- onProductCreated: (payload) => Promise<void>
- onProductUpdated: (payload) => Promise<void>
- onOrganizationUpdated: (payload) => Promise<void>
- onBenefitCreated: (payload) => Promise<void>
- onBenefitUpdated: (payload) => Promise<void>
- onBenefitGrantCreated: (payload) => Promise<void>
- onBenefitGrantUpdated: (payload) => Promise<void>
- onBenefitGrantRevoked: (payload) => Promise<void>
- onCustomerCreated: (payload) => Promise<void>
- onCustomerUpdated: (payload) => Promise<void>
- onCustomerDeleted: (payload) => Promise<void>
- onCustomerStateChanged: (payload) => Promise<void>

## Edge Runtime Compatibility

This adapter is built to work with Supabase Edge Functions, which run on the Deno runtime. It uses standard Web APIs (`Request`, `Response`) that are compatible with edge environments, making it ideal for:

- Supabase Edge Functions
- Deno Deploy
- Other Deno-based edge runtimes

All handlers return standard `Response` objects and accept standard `Request` objects, ensuring maximum compatibility with edge runtimes.
