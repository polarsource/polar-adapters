---
"@polar-sh/better-auth": patch
---

Fix circular dependency between `client.ts` and `index.ts` that caused type inference issues for `$InferServerPlugin`
