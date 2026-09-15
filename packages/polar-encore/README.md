# @polar-sh/encore

Payments and Checkouts made dead simple with Encore.ts.

`npm install @polar-sh/encore`

## Setup

Set your Polar credentials using Encore's secrets:

```bash
encore secret set --type local PolarAccessToken
encore secret set --type local PolarWebhookSecret
```

Get your credentials from [Polar Settings → API](https://polar.sh/settings/api).

## Checkout

Create a Checkout handler which takes care of redirections.

```typescript
import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { Checkout } from "@polar-sh/encore";

const polarAccessToken = secret("PolarAccessToken");

export const checkout = api.raw(
  { expose: true, path: "/checkout", method: "GET" },
  Checkout({
    accessToken: polarAccessToken(),
    successUrl: "https://myapp.com/success",
    returnUrl: "https://myapp.com",
    server: "sandbox",
    theme: "dark",
  })
);
```

### Query Params

Pass query params to this route.

- products `?products=123`
- customerId (optional) `?products=123&customerId=xxx`
- customerExternalId (optional) `?products=123&customerExternalId=xxx`
- customerEmail (optional) `?products=123&customerEmail=janedoe@gmail.com`
- customerName (optional) `?products=123&customerName=Jane`
- seats (optional) `?products=123&seats=5` - Number of seats for seat-based products
- metadata (optional) `URL-Encoded JSON string`

## Customer Portal

Create a customer portal where your customer can view orders and subscriptions.

```typescript
import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { CustomerPortal } from "@polar-sh/encore";
import { getAuthData } from "~encore/auth";

const polarAccessToken = secret("PolarAccessToken");

export const portal = api.raw(
  { expose: true, path: "/portal", method: "GET", auth: true },
  CustomerPortal({
    accessToken: polarAccessToken(),
    getCustomerId: async (req) => {
      const auth = getAuthData();
      return auth!.polarCustomerId;
    },
    returnUrl: "https://myapp.com/dashboard",
    server: "sandbox",
  })
);
```

## Webhooks

Handle Polar webhooks with automatic signature verification.

```typescript
import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { Webhooks } from "@polar-sh/encore";

const polarWebhookSecret = secret("PolarWebhookSecret");

export const webhooks = api.raw(
  { expose: true, path: "/webhooks/polar", method: "POST" },
  Webhooks({
    webhookSecret: polarWebhookSecret(),
    onPayload: async (payload) => {
      console.log("Received webhook:", payload.type);
    },
  })
);
```

### Payload Handlers

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
- onBenefitCreated: (payload) =>
- onBenefitUpdated: (payload) =>
- onBenefitGrantCreated: (payload) =>
- onBenefitGrantUpdated: (payload) =>
- onBenefitGrantRevoked: (payload) =>
- onCustomerCreated: (payload) =>
- onCustomerUpdated: (payload) =>
- onCustomerDeleted: (payload) =>
- onCustomerStateChanged: (payload) =>

### Example with Specific Handlers

```typescript
import { api } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { Webhooks } from "@polar-sh/encore";
import { db } from "./db";

const polarWebhookSecret = secret("PolarWebhookSecret");

export const webhooks = api.raw(
  { expose: true, path: "/webhooks/polar", method: "POST" },
  Webhooks({
    webhookSecret: polarWebhookSecret(),
    onSubscriptionActive: async (payload) => {
      await db.exec`
        UPDATE users 
        SET subscription_status = 'active',
            subscription_id = ${payload.data.id}
        WHERE polar_customer_id = ${payload.data.customerId}
      `;
    },
    onSubscriptionCanceled: async (payload) => {
      await db.exec`
        UPDATE users 
        SET subscription_status = 'canceled'
        WHERE subscription_id = ${payload.data.id}
      `;
    },
  })
);
```

## Full Example

See the `/example` directory for a complete working example of integrating Polar with Encore.ts, including:
- Checkout sessions with product selection
- Customer portal access
- Webhook handling for subscriptions
- Database integration for user management
- Feature gating based on subscription status

## Learn More

- [Polar Documentation](https://polar.sh/docs)
- [Encore.ts Documentation](https://encore.dev/docs/ts)
- [Polar API Reference](https://polar.sh/docs/api-reference)

