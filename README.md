# polar-nextjs

Payments and Checkouts made dead simple with Next.js.

`pnpm install @polar-sh/nextjs`

## Checkout

Create a Checkout handler which takes care of redirections.

```typescript
// checkout/route.ts
import { Checkout } from "@polar-sh/nextjs";

export const GET = Checkout({
	accessToken: process.env.POLAR_ACCESS_TOKEN,
	successUrl: process.env.SUCCESS_URL,
	server: 'sandbox' // Use sandbox if you're testing Polar - omit the parameter or pass 'production' otherwise
});
```

### Query Params

Pass query params to this route.

- productId (required) `?productId=xxx`
- customerId (optional) `?productId=xxx&customerId=xxx`
- customerEmail (optional) `?productId=xxx&customerEmail=janedoe@gmail.com`
- customerName (optional) `?productId=xxx&customerName=Jane`

## Webhooks

A simple utility which resolves incoming webhook payloads by signing the webhook secret properly.

```typescript
// api/webhook/polar/route.ts
import { Webhooks } from "@polar-sh/nextjs";

export const POST = Webhooks({
	webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
	onPayload: async (payload) => {
		// Handle the payload
        	// No need to return an acknowledge response
	}
});
```
