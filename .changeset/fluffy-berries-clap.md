---
"@polar-sh/better-auth": minor
"@polar-sh/sveltekit": minor
"@polar-sh/adapter-utils": minor
"@polar-sh/express": minor
"@polar-sh/fastify": minor
"@polar-sh/elysia": minor
"@polar-sh/nextjs": minor
"@polar-sh/astro": minor
"@polar-sh/remix": minor
"@polar-sh/hono": minor
"@polar-sh/nuxt": minor
---

## Breaking changes

Checkout endpoints no longer support `productId` and `productPriceId` parameter to pass the product. Use `products` instead.

## Added

Checkout endpoints now support the `products` parameter. You can repeat it to pass several products to the Checkout session.
