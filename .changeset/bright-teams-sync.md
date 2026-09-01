---
"@polar-sh/better-auth": minor
---

Add experimental support for mapping Better Auth organizations to Polar team billing, including automatic recurring product-seat checkout sizing, assignment, revocation, and subscription quantity synchronization.

Enable organization synchronization with Better Auth's `organization` plugin and `experimental_organizationSync.enabled`. Automatic seat management is separately opt-in with `experimental_organizationSync.syncSeats`; use `experimental_organizationSync.selectSeatProductsForMember` to configure dynamic per-member product allocation.

Do not enable this option if the application already synchronizes organization billing, because competing implementations can leave Better Auth and Polar in an inconsistent state.
