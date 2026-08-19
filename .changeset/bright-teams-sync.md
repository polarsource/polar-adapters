---
"@polar-sh/better-auth": minor
---

Add experimental support for mapping better-auth organizations with Polar team billing.

Enable it by using the better-auth `organization` plugin and setting `experimental_organizationSync.enabled` to true in on the polar adapter.

If you're already have a custom way to handle syncing organizations to Polar teams, do not enable as that can lead to undefined behaviour and leave better-auth and Polar in an inconsistent state.
