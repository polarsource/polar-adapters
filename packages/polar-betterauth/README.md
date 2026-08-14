# @polar-sh/better-auth

A [Better Auth](https://github.com/better-auth/better-auth) plugin for integrating [Polar](https://polar.sh) payments and subscriptions into your authentication flow.

## Features

- Checkout Integration
- Customer Portal
- Automatic personal customer creation on signup
- Explicit Better Auth organization → Polar team-customer synchronization
- Event Ingestion & Customer Meters for flexible Usage Based Billing
- Handle Polar Webhooks securely with signature verification, including member events
- Generic `referenceId` metadata for legacy checkout/subscription filtering

## Installation

```bash
pnpm add better-auth @polar-sh/better-auth @polar-sh/sdk
```

## Preparation

Go to your Polar Organization Settings, and create an Organization Access Token. Add it to your environment.

```bash
# .env
POLAR_ACCESS_TOKEN=...
```

### Configuring BetterAuth Server

The Polar plugin comes with a handful additional plugins which adds functionality to your stack.

- Checkout - Enables a seamless checkout integration
- Portal - Makes it possible for your customers to manage their orders, subscriptions & granted benefits
- Usage - Simple extension for listing customer meters & ingesting events for Usage Based Billing
- Webhooks - Listen for relevant Polar webhooks

```typescript
import { betterAuth } from "better-auth";
import { organization } from "better-auth/plugins";
import { polar, checkout, portal, usage, webhooks } from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";

const polarClient = new Polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN,
    // Use 'sandbox' if you're using the Polar Sandbox environment
    // Remember that access tokens, products, etc. are completely separated between environments.
    // Access tokens obtained in Production are for instance not usable in the Sandbox environment.
    server: 'sandbox'
});

const auth = betterAuth({
    // ... Better Auth config
    plugins: [
        organization(),
        polar({
            client: polarClient,
            createCustomerOnSignUp: true,
            organization: {
                enabled: true,
                getTeamCustomerCreateParams: async ({ organization, owner }) => ({
                    metadata: {
                        source: "better-auth",
                        createdBy: owner.id,
                    },
                }),
            },
            use: [
                checkout({
                    products: [
                        {
                            productId: "123-456-789", // ID of Product from Polar Dashboard
                            slug: "pro" // Custom slug for easy reference in Checkout URL, e.g. /checkout/pro
                        }
                    ],
                    successUrl: "/success?checkout_id={CHECKOUT_ID}",
                    authenticatedUsersOnly: true,
                    returnUrl: "https://myapp.com", // Optional Return URL, which renders a Back-button in the Checkout
                }),
                portal({
                  returnUrl: "https://myapp.com", // Optional Return URL, which renders a Back-button in the Customer Portal
                }),
                usage(),
                webhooks({
                    secret: process.env.POLAR_WEBHOOK_SECRET,
                    onCustomerStateChanged: (payload) => // Triggered when anything regarding a customer changes
                    onOrderPaid: (payload) => // Triggered when an order was paid (purchase, subscription renewal, etc.)
                    ...  // Over 25 granular webhook handlers
                    onPayload: (payload) => // Catch-all for all events
                })
            ],
        })
    ]
});
```

### Configuring BetterAuth Client

You will be using the BetterAuth Client to interact with the Polar functionalities.

```typescript
import { createAuthClient } from "better-auth/react";
import { polarClient } from "@polar-sh/better-auth";
import { organizationClient } from "better-auth/client/plugins";

// This is all that is needed
// All Polar plugins, etc. should be attached to the server-side BetterAuth config
export const authClient = createAuthClient({
  plugins: [organizationClient(), polarClient()],
});
```

## Configuration Options

```typescript
import { betterAuth } from "better-auth";
import {
  polar,
  checkout,
  portal,
  usage,
  webhooks,
} from "@polar-sh/better-auth";
import { Polar } from "@polar-sh/sdk";
import { organization } from "better-auth/plugins";

const polarClient = new Polar({
  accessToken: process.env.POLAR_ACCESS_TOKEN,
  // Use 'sandbox' if you're using the Polar Sandbox environment
  // Remember that access tokens, products, etc. are completely separated between environments.
  // Access tokens obtained in Production are for instance not usable in the Sandbox environment.
  server: "sandbox",
});

const auth = betterAuth({
  // ... Better Auth config
  plugins: [
    organization(),
    polar({
      client: polarClient,
      createCustomerOnSignUp: true,
      getCustomerCreateParams: ({ user }, request) => ({
        metadata: {
          myCustomProperty: 123,
        },
      }),
      organization: {
        enabled: true,
        getTeamCustomerCreateParams: async ({ organization, owner }) => ({
          metadata: {
            source: "better-auth",
            createdBy: owner.id,
          },
        }),
      },
      use: [
        // This is where you add Polar plugins
      ],
    }),
  ],
});
```

### Required Options

- `client`: Polar SDK client instance

### Optional Options

- `createCustomerOnSignUp`: Automatically create a Polar customer when a user signs up
- `getCustomerCreateParams`: Custom function to provide additional personal-customer creation metadata
- `organization`: Explicit Better Auth organization synchronization configuration. Set `organization.enabled` to `true`; `organization.getTeamCustomerCreateParams` can add team-customer fields such as metadata or billing details.

### Customers

When `createCustomerOnSignUp` is enabled, a new Polar Customer is automatically created when a new User is added in the Better-Auth Database.

All new customers are created with an associated `externalId`, which is the ID of your User in the Database. This allows us to skip any Polar <-> User mapping in your Database.

### Organization synchronization

Organization synchronization is opt-in and requires both Better Auth's `organization()` plugin and `organization: { enabled: true }` on `polar()`. Enabling it without the Better Auth plugin fails during startup.

The current mapping is deterministic:

| Better Auth | Polar |
| --- | --- |
| `organization.id` | Team customer `externalId` |
| Organization creator `user.id` | Initial owner member `externalId` |
| `organization.name` | Team customer `name` |

On organization creation, the adapter creates or reuses a team customer and supplies the creator as its explicit owner. The team customer has no email by default, avoiding collisions when one user owns several organizations. `organization.getTeamCustomerCreateParams` may add metadata, locale, address, tax, or other supported team-customer fields, but cannot override `type`, `externalId`, `name`, or owner identity. Organization name changes update the team customer.

This requires Polar's member model to be enabled. The Polar organization access token needs `customers:read`, `customers:write`, `members:read`, and `members:write` scopes.

Better Auth users map to Polar member `externalId` values using `user.id` within each team customer. Direct additions and accepted invitations are mirrored, and profile, role, removal, self-leave, and user-deletion paths are synchronized. Better Auth remains the roster source of truth.

Polar permits one owner. The adapter retains the current valid Better Auth owner as Polar's canonical owner; if a transfer is required, it deterministically selects the earliest eligible owner. Additional Better Auth `owner` roles and `admin` map to `billing_manager`; other roles map to `member`. `organization.mapMemberRole` may map non-owners to `member` or `billing_manager`, but cannot assign ownership.

Organization deletion in Better Auth does **not** delete the Polar team customer or its billing data. Cross-system writes are not transactional: synchronization errors propagate, but an earlier Better Auth or Polar write cannot be rolled back. Polar synchronization uses deterministic external IDs, and each lifecycle hook updates only the customer or members affected by that Better Auth operation.

Organization billing is always selected explicitly; the active Better Auth organization is never used implicitly. Pass `organizationId` in:

- the POST body for checkout and usage ingestion;
- the query for portal (GET or POST), customer state, benefits, subscriptions, orders, and usage meters.

The adapter verifies the authenticated user's Better Auth membership before calling Polar. Organization checkout requires a billing-capable role. Team portal and meter requests create a member-scoped customer session with `externalCustomerId = organization.id` and `externalMemberId = user.id`; usage events carry both IDs. Omitting `organizationId` preserves personal-customer behavior.

## Checkout Plugin

To support checkouts in your app, simply pass the Checkout plugin to the use-property.

```typescript
import { polar, checkout } from "@polar-sh/better-auth";

const auth = betterAuth({
    // ... Better Auth config
    plugins: [
        polar({
            ...
            use: [
                checkout({
                    // Optional field - will make it possible to pass a slug to checkout instead of Product ID
                    products: [ { productId: "123-456-789", slug: "pro" } ],
                    // Relative URL to return to when checkout is successfully completed
                    successUrl: "/success?checkout_id={CHECKOUT_ID}",
                    // Optional Return URL, which renders a Back-button in the Checkout
                    returnUrl: "https://myapp.com",
                    // Wheather you want to allow unauthenticated checkout sessions or not
                    authenticatedUsersOnly: true,
                    // Enforces the theme - System-preferred theme will be set if left omitted
                    theme: "dark"
                })
            ],
        })
    ]
});
```

When checkouts are enabled, you're able to initialize Checkout Sessions using the checkout-method on the BetterAuth Client. This will redirect the user to the Product Checkout.

```typescript
await authClient.checkout({
  // Any Polar Product ID can be passed here
  products: ["e651f46d-ac20-4f26-b769-ad088b123df2"],
  // Or, if you setup "products" in the Checkout Config, you can pass the slug
  slug: "pro",
});
```

Checkouts will automatically carry the authenticated User as the customer to the checkout. Email-address will be "locked-in".

If `authenticatedUsersOnly` is `false` - then it will be possible to trigger checkout sessions without any associated customer.


### Checkout Embed

You can use the `checkoutEmbed` method to instead open the Checkout as an Embed on your site. 

```typescript
const embed = await authClient.checkoutEmbed({
  products: ["e651f46d-ac20-4f26-b769-ad088b123df2"],
});

// Listen for successful completion
checkout.addEventListener("success", (event) => {
  console.log("Purchase successful!", event.detail);

  // Call event.preventDefault() if you want to prevent the standard behavior
  // event.preventDefault()
  // Note: For success event, this prevents automatic redirection if redirect is true

  // If redirect is false, you can show your own success message
  if (!event.detail.redirect) {
    showSuccessMessage();
  }
  // Otherwise, the user will be redirected to the success URL (unless prevented)
});
```

### Reference metadata

`referenceId` is generic metadata copied to the checkout and resulting billing objects. It does not select a Polar team customer, authorize Better Auth organization membership, or establish an organization relationship.

```typescript
await authClient.checkout({
  products: ["e651f46d-ac20-4f26-b769-ad088b123df2"],
  referenceId: "your-application-reference",
});
```

If an existing integration used a Better Auth organization ID as `referenceId`, treat it as legacy reporting metadata only. Enable `organization.enabled`, then migrate organization checkout to the explicit, membership-authorized field:

```typescript
await authClient.checkout({
  slug: "pro",
  organizationId,
});
```

Do not send both `organizationId` and `referenceId` when listing subscriptions; that combination is rejected.

## Portal Plugin

A plugin which enables customer management of their purchases, orders and subscriptions.

```typescript
import { polar, checkout, portal } from "@polar-sh/better-auth";

const auth = betterAuth({
    // ... Better Auth config
    plugins: [
        polar({
            ...
            use: [
                checkout(...),
                portal({
                   // Optional Return URL, which renders a Back-button in the Customer Portal
                  redirectUrl: "https://myapp.com"
                })
            ],
        })
    ]
});
```

The portal-plugin gives the BetterAuth Client a set of customer management methods, scoped under `authClient.customer`.

### Customer Portal Management

The following method will redirect the user to the Polar Customer Portal, where they can see orders, purchases, subscriptions, benefits, etc.

```typescript
await authClient.customer.portal();

// Explicit organization portal access (membership is checked server-side)
await authClient.customer.portal({
  query: { organizationId },
});
```

### Customer State

The portal plugin also adds a convenient state-method for retrieving the general Customer State.

```typescript
const { data: customerState } = await authClient.customer.state();

const { data: organizationState } = await authClient.customer.state({
  query: { organizationId },
});
```

The customer state object contains:

- All the data about the customer.
- The list of their active subscriptions
  - Note: This does not include subscriptions done by a parent organization. See the subscription list-method below for more information.
- The list of their granted benefits.
- The list of their active meters, with their current balance.

Thus, with that single object, you have all the required information to check if you should provision access to your service or not.

[You can learn more about the Polar Customer State in the Polar Docs](https://docs.polar.sh/integrate/customer-state).

### Benefits, Orders & Subscriptions

The portal plugin adds 3 convenient methods for listing benefits, orders & subscriptions relevant to the authenticated user/customer.

[All of these methods use the Polar CustomerPortal APIs](https://docs.polar.sh/api-reference/customer-portal)

#### Benefits

This method only lists granted benefits for the authenticated user/customer.

```typescript
const { data: benefits } = await authClient.customer.benefits.list({
  query: {
    page: 1,
    limit: 10,
  },
});
```

#### Orders

This method lists orders like purchases and subscription renewals for the authenticated user/customer.

```typescript
const { data: orders } = await authClient.customer.orders.list({
  query: {
    page: 1,
    limit: 10,
    productBillingType: "one_time", // or 'recurring'
  },
});
```

#### Subscriptions

This method lists the subscriptions associated with authenticated user/customer.

```typescript
const { data: subscriptions } = await authClient.customer.subscriptions.list({
  query: {
    page: 1,
    limit: 10,
    active: true,
  },
});
```

**Legacy `referenceId` filtering**

Passing `referenceId` switches this method to a Polar organization-level metadata query. It is not a Better Auth organization authorization boundary and must not be used to grant access based only on a caller-provided organization ID.

```typescript
const { data: subscriptions } = await authClient.customer.subscriptions.list({
  query: {
    page: 1,
    limit: 10,
    active: true,
    referenceId: "your-application-reference",
  },
});
```

For organization subscriptions, use `query.organizationId` instead. The adapter authorizes membership and uses a member-scoped Polar customer session:

```typescript
const { data: subscriptions } =
  await authClient.customer.subscriptions.list({
    query: {
      organizationId,
      page: 1,
      limit: 10,
      active: true,
    },
  });
```

## Usage Plugin

A simple plugin for Usage Based Billing.

```typescript
import { polar, checkout, portal, usage } from "@polar-sh/better-auth";

const auth = betterAuth({
    // ... Better Auth config
    plugins: [
        polar({
            ...
            use: [
                checkout(...),
                portal(),
                usage()
            ],
        })
    ]
});
```

### Event Ingestion

Polar's Usage Based Billing builds entirely on event ingestion. Ingest events from your application, create Meters to represent that usage, and add metered prices to Products to charge for it.

[Learn more about Usage Based Billing in the Polar Docs.](https://docs.polar.sh/features/usage-based-billing/introduction)

```typescript
const { data: ingested } = await authClient.usage.ingest({
  event: "file-uploads",
  metadata: {
    uploadedFiles: 12,
  },
  // Optional: attributes the event to the team customer and this member.
  organizationId,
});
```

The authenticated user is automatically associated with the ingested event.

### Customer Meters

A simple method for listing the authenticated user's Usage Meters, or as we call them, Customer Meters.

Customer Meter's contains all information about their consumtion on your defined meters.

- Customer Information
- Meter Information
- Customer Meter Information
  - Consumed Units
  - Credited Units
  - Balance

```typescript
const { data: customerMeters } = await authClient.usage.meters.list({
  query: {
    page: 1,
    limit: 10,
    // Optional: creates a member-scoped team customer session.
    organizationId,
  },
});
```

## Webhooks Plugin

The Webhooks plugin can be used to capture incoming events from your Polar organization.

```typescript
import { polar, webhooks } from "@polar-sh/better-auth";

const auth = betterAuth({
    // ... Better Auth config
    plugins: [
        polar({
            ...
            use: [
                webhooks({
                    secret: process.env.POLAR_WEBHOOK_SECRET,
                    onCustomerStateChanged: (payload) => // Triggered when anything regarding a customer changes
                    onOrderPaid: (payload) => // Triggered when an order was paid (purchase, subscription renewal, etc.)
                    ...  // Over 25 granular webhook handlers
                    onPayload: (payload) => // Catch-all for all events
                })
            ],
        })
    ]
});
```

Configure a Webhook endpoint in your Polar Organization Settings page. Webhook endpoint is configured at /polar/webhooks.

Add the secret to your environment.

```bash
# .env
POLAR_WEBHOOK_SECRET=...
```

The plugin supports handlers for all Polar webhook events:

- `onPayload` - Catch-all handler for any incoming Webhook event
- `onCheckoutCreated` - Triggered when a checkout is created
- `onCheckoutUpdated` - Triggered when a checkout is updated
- `onOrderCreated` - Triggered when an order is created
- `onOrderPaid` - Triggered when an order is paid
- `onOrderRefunded` - Triggered when an order is refunded
- `onRefundCreated` - Triggered when a refund is created
- `onRefundUpdated` - Triggered when a refund is updated
- `onSubscriptionCreated` - Triggered when a subscription is created
- `onSubscriptionUpdated` - Triggered when a subscription is updated
- `onSubscriptionActive` - Triggered when a subscription becomes active
- `onSubscriptionCanceled` - Triggered when a subscription is canceled
- `onSubscriptionRevoked` - Triggered when a subscription is revoked
- `onSubscriptionUncanceled` - Triggered when a subscription cancellation is reversed
- `onProductCreated` - Triggered when a product is created
- `onProductUpdated` - Triggered when a product is updated
- `onOrganizationUpdated` - Triggered when an organization is updated
- `onBenefitCreated` - Triggered when a benefit is created
- `onBenefitUpdated` - Triggered when a benefit is updated
- `onBenefitGrantCreated` - Triggered when a benefit grant is created
- `onBenefitGrantUpdated` - Triggered when a benefit grant is updated
- `onBenefitGrantRevoked` - Triggered when a benefit grant is revoked
- `onCustomerCreated` - Triggered when a customer is created
- `onCustomerUpdated` - Triggered when a customer is updated
- `onCustomerDeleted` - Triggered when a customer is deleted
- `onCustomerStateChanged` - Triggered when customer state changes
- `onMemberCreated` - Triggered when a Polar member is created
- `onMemberUpdated` - Triggered when a Polar member is updated
- `onMemberDeleted` - Triggered when a Polar member is deleted

Member webhook callbacks are notification-only. Better Auth is the organization roster source of truth: never create, update, or delete Better Auth memberships from these callbacks. Webhook delivery and ownership-related member events may be reordered or repeated, so handlers must be idempotent.
