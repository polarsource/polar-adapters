---
"@polar-sh/adapter-utils": minor
"@polar-sh/better-auth": minor
"@polar-sh/nextjs": minor
"@polar-sh/nuxt": minor
"@polar-sh/tanstack-start": minor
---

Forward the customer IP address on checkout creation so Polar can show the visitor's local currency. It's read from `x-forwarded-for`, `x-real-ip` or `cf-connecting-ip`; set `ipAddressHeaders` to change the headers, or `false` to disable. Better Auth uses `advanced.ipAddress` instead.
