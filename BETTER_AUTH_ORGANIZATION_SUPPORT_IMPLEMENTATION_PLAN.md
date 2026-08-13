# Better Auth Organization → Polar Customer/Member Support

## Status

This is an implementation and handoff plan. It intentionally describes the work as a sequence of small, independently reviewable chunks. An agent should implement **one chunk at a time**, run the chunk-specific tests, summarize the result, and stop for review before continuing.

The plan was derived from the upstream Better Auth organization plugin under `./better-auth`, the Polar server and SDK under `../polar-official`, and the `@polar-sh/better-auth` package as it existed on `origin/main`. It was not derived from the pre-existing feature-branch implementation.

### Current implementation status

- **Chunk 1 is implemented:** the workspace uses `@polar-sh/sdk` 0.49, the external-ID-first Polar gateway exists, and pure role mapping is tested.
- **Chunk 2 is implemented:** explicit organization configuration installs composed Better Auth organization hooks and synchronizes team-customer creation and organization-name updates.
- **Chunks 3–7 are implemented:** member/owner synchronization, billing-principal authorization, organization-aware endpoints, lifecycle reconciliation, member webhooks, documentation, examples, and release metadata are present.
- Organization synchronization errors are **always propagated**. There is deliberately no best-effort or log-only mode.
- The temporary organization-only TypeScript configuration proposed during Chunk 1 was removed. The organization code is imported by `src/server.ts` and compiled through the normal package build.

When this document says a completed chunk “should” do something, read it as documentation of the accepted implementation. Future agents should preserve that behavior unless a reviewer explicitly changes it.

The completed implementation intentionally keeps `reconcileOrganization` internal rather than exporting it from the package entry point. It is available to adapter lifecycle code and can be promoted to a public server helper in a future release if a concrete administration API is designed.

## Purpose

The `@polar-sh/better-auth` adapter currently models a Better Auth user as a Polar individual customer. It now has the foundation of an explicit organization mode where:

- A Better Auth organization is represented by a Polar **team customer**.
- A Better Auth user who belongs to that organization is represented by a Polar **member** of the team customer.
- Organization-scoped checkout, portal, customer-state, subscription, benefit, order, meter, and usage operations use the team customer instead of the user's personal customer.
- Better Auth remains the source of truth for identity, organization membership, and application roles.
- Polar remains the source of truth for billing data and billing-specific member roles.

This is not a simple ID substitution. Better Auth and Polar have different lifecycle ordering, role models, ownership constraints, and deletion semantics. The implementation must handle those differences explicitly.

---

# 1. Working agreement for implementation agents

## 1.1 Start from a clean baseline

Do not build on or copy the pre-existing `feat/betterauth-member-model` implementation. Create a clean branch or worktree from `origin/main`.

Example:

```bash
git fetch origin
git worktree add ../polar-adapters-org-support -b feat/better-auth-organization-support origin/main
cd ../polar-adapters-org-support
```

Do not disturb unrelated local modifications in the original worktree, especially `.gitignore`.

Once Chunk 1 has been merged or accepted, later agents should start from the branch containing the accepted previous chunks—not from `origin/main` again.

## 1.2 One chunk per commit

Each chunk below should produce one focused commit unless the reviewer asks otherwise. Do not mix future chunks into the current one just because a nearby file is open.

After each chunk, report:

1. The commit or diff scope.
2. Files changed.
3. Behavior added.
4. Design decisions made.
5. Tests and commands run.
6. Known limitations intentionally left for later chunks.
7. Any deviation from this plan and why.

Then stop for review.

## 1.3 Preserve backward compatibility

Organization support is explicitly enabled through `organization: { enabled: true }`. The presence of Better Auth's organization plugin alone does not change billing behavior. When organization support is omitted/disabled or no endpoint `organizationId` is supplied:

- Existing personal-customer creation must continue to work.
- Existing endpoint request and response shapes must continue to work.
- Existing authentication and anonymous-user behavior must remain unchanged.
- Existing `referenceId` metadata behavior must not silently change.

## 1.4 Keep the integration type-safe

Do not hide SDK mismatches with broad `any`, unchecked casts, or untyped wrappers. Chunk 1 exists specifically to settle the Polar SDK contract before lifecycle code is written.

## 1.5 Better Auth is the roster source of truth

Synchronization is one-way:

```text
Better Auth organization/user/member lifecycle → Polar customer/member mirror
```

Polar member webhooks are notifications. They must not create, update, or delete Better Auth memberships, because doing so would create synchronization loops and ambiguous conflict resolution.

---

# 2. Repository map

## Adapter package

Primary package:

```text
packages/polar-betterauth/
```

Important existing files on the baseline branch:

```text
packages/polar-betterauth/src/server.ts
packages/polar-betterauth/src/types.ts
packages/polar-betterauth/src/hooks/customer.ts
packages/polar-betterauth/src/plugins/checkout.ts
packages/polar-betterauth/src/plugins/portal.ts
packages/polar-betterauth/src/plugins/usage.ts
packages/polar-betterauth/src/plugins/webhooks.ts
packages/polar-betterauth/src/__tests__/
packages/polar-betterauth/README.md
packages/polar-betterauth/example/src/lib/auth.ts
```

Shared webhook handling:

```text
packages/adapter-utils/src/webhooks/webhooks.ts
packages/adapter-utils/src/webhooks/webhooks.test.ts
```

## Better Auth source

Organization plugin:

```text
better-auth/packages/better-auth/src/plugins/organization/types.ts
better-auth/packages/better-auth/src/plugins/organization/schema.ts
better-auth/packages/better-auth/src/plugins/organization/adapter.ts
better-auth/packages/better-auth/src/plugins/organization/organization.ts
better-auth/packages/better-auth/src/plugins/organization/routes/crud-org.ts
better-auth/packages/better-auth/src/plugins/organization/routes/crud-members.ts
better-auth/packages/better-auth/src/plugins/organization/routes/crud-invites.ts
```

Plugin initialization and database-hook composition:

```text
better-auth/packages/better-auth/src/context/helpers.ts
better-auth/packages/better-auth/src/db/with-hooks.ts
better-auth/packages/core/src/types/plugin.ts
better-auth/packages/core/src/types/init-options.ts
```

## Polar source

Customer model and API:

```text
../polar-official/server/polar/models/customer.py
../polar-official/server/polar/customer/schemas/customer.py
../polar-official/server/polar/customer/service.py
../polar-official/server/polar/customer/endpoints.py
```

Member model and API:

```text
../polar-official/server/polar/models/member.py
../polar-official/server/polar/member/schemas.py
../polar-official/server/polar/member/service.py
../polar-official/server/polar/member/endpoints.py
```

Customer/member sessions:

```text
../polar-official/server/polar/customer_session/schemas.py
../polar-official/server/polar/customer_session/service.py
```

Current generated TypeScript SDK source for nested member operations:

```text
../polar-official/sdk/typescript/src/2026-04/services/customers/members.ts
../polar-official/sdk/typescript/src/2026-04/services/customers/index.ts
../polar-official/sdk/typescript/src/2026-04/models.ts
```

The checked-in official SDK may be ahead of the latest published stable `@polar-sh/sdk`. Chunk 1 must verify the actual published package and method signatures used by this adapter.

---

# 3. Canonical data mapping

## 3.1 Identity mapping

Use this mapping throughout the implementation:

| Better Auth | Polar | Reason |
|---|---|---|
| `organization.id` | Team `Customer.external_id` | Stable, unique application-side organization identity |
| `organization.name` | Team `Customer.name` | Human-readable billing customer name |
| `user.id` | `Member.external_id` within the team customer | Stable actor identity, available from sessions, scoped by customer |
| `user.email` | `Member.email` | Member contact and portal identity |
| `user.name` | `Member.name` | Display name |

Treat all Better Auth IDs as opaque strings. Do not assume UUIDs.

### Why `user.id`, not Better Auth `member.id`

A Better Auth `member` row represents one membership lifecycle. If a user leaves and rejoins, Better Auth may create a new membership row and therefore a new `member.id`.

Polar describes `Member.external_id` as the ID of the member/actor in the integrating system and scopes uniqueness to the customer. Better Auth already guarantees that one user cannot have duplicate active memberships in the same organization. Therefore `user.id` is stable and unambiguous under a Polar team customer.

Using `user.id` also allows organization-scoped portal sessions and usage attribution to be created directly from the authenticated session without exposing or storing a Polar member ID.

## 3.2 Team customer creation payload

The conceptual payload is:

```ts
{
  type: "team",
  externalId: organization.id,
  name: organization.name,
  owner: {
    externalId: creator.id,
    email: creator.email,
    name: creator.name,
  },
}
```

Exact property casing and method signatures depend on the SDK version verified in Chunk 1.

Do not set the team customer's own email to the creator's email by default. Polar requires a customer email to be unique within the merchant organization. A creator can own multiple Better Auth organizations and may already have a personal Polar customer, so reusing that email on every team customer creates collisions.

A team customer may omit `email` when an explicit owner with an email is supplied. Polar can use the owner as the billing identity.

## 3.3 Never adopt by email

For organization customers:

- Lookup by `organization.id` as customer external ID.
- Never adopt a customer because its email matches the creator.
- Never update an unrelated customer to point at an organization ID.

For organization members:

- Lookup by the pair `(organization.id, user.id)` through the external customer/member API.
- Email can be used only as member data, not identity.

This prevents cross-organization account linking and avoids the ambiguity created when one person belongs to many organizations.

---

# 4. Source-model differences that drive the design

## 4.1 Polar customer constraints

From `customer.py` and `customer/service.py`:

- Customer type is `individual` or `team`.
- An individual customer can be upgraded to a team, but a team cannot be downgraded.
- `external_id` is unique within the Polar organization.
- Once set, `external_id` cannot be changed.
- Customer email is unique within the Polar organization when present.
- Deleting a customer is destructive from a billing perspective:
  - active subscriptions are cancelled;
  - benefits are revoked;
  - members are deleted;
  - the customer is soft-deleted;
  - the external ID is cleared for possible reuse.

Therefore Better Auth organization deletion must not automatically call Polar customer deletion by default.

## 4.2 Polar member constraints

From `member.py`, `member/schemas.py`, and `member/service.py`:

- Member email is unique per customer, case-insensitively.
- Member external ID is unique per customer when present.
- Polar roles are exactly:
  - `owner`
  - `billing_manager`
  - `member`
- A customer has at most one active owner.
- A new non-owner member may be created as `member` or `billing_manager`.
- Ownership is established during customer creation or transferred through member update.
- Promoting a member to owner automatically demotes the old owner to `billing_manager`.
- The last owner cannot be demoted or deleted without first transferring ownership.
- Member creation is email-idempotent in some service paths. Finding an existing member by email does not necessarily reconcile its external ID, role, or name.
- Member management requires Polar's member-model or seat-based feature to be enabled.

The adapter must perform explicit reconciliation after an idempotent create and must transfer ownership before deleting or demoting the current owner.

## 4.3 Better Auth role differences

Better Auth organization roles are arbitrary strings. A member may have comma-separated multiple roles. The default organization plugin commonly uses `owner`, `admin`, and `member`, but custom roles are valid.

Recommended default billing-role mapping:

```text
canonical Better Auth owner → Polar owner
admin or additional Better Auth owner → Polar billing_manager
anything else → Polar member
```

A configurable role mapper may refine `admin` and custom roles, but the adapter must retain control of the single-owner invariant.

## 4.4 Better Auth organization-creation ordering

From `routes/crud-org.ts`, organization creation runs in this order:

1. Resolve the creator.
2. Validate creation permission, limits, and slug uniqueness.
3. Call `beforeCreateOrganization`.
4. Insert the organization.
5. Call `beforeAddMember` for the creator.
6. Insert the creator membership.
7. Call `afterAddMember` for the creator.
8. Optionally create a default team.
9. Call `afterCreateOrganization`.
10. Set the active organization/team.

The creator's `afterAddMember` runs **before** `afterCreateOrganization`. If the Polar customer is created only in `afterCreateOrganization`, member synchronization must recognize and defer the creator path.

Recommended behavior:

- `afterCreateOrganization` creates or reconciles the team customer and explicit owner together.
- `afterAddMember` first looks up the team customer.
- If the customer is genuinely missing, `afterAddMember` returns without creating a member because this is the normal creator ordering.
- Only a typed/not-found response should trigger deferral. Network, authorization, and validation failures must not be mistaken for absence.

## 4.5 Better Auth lifecycle gaps

Do not assume one member hook covers every way a member appears or disappears.

### Invitation acceptance

`acceptInvitation` inserts a membership but does not call `afterAddMember`. It calls `afterAcceptInvitation` after the invitation transaction completes.

Both paths must synchronize members:

- `afterAddMember`
- `afterAcceptInvitation`

The helper must be idempotent in case Better Auth changes this behavior or an application invokes both paths itself.

### Self-leave

`leaveOrganization` deletes the membership but does not call `beforeRemoveMember` or `afterRemoveMember`.

The adapter needs a Better Auth endpoint-level `hooks.after` matcher for the leave endpoint, or an upstream Better Auth change that makes leave invoke the member-removal hooks. The adapter should not rely on an unreleased upstream fix.

### Organization deletion

Better Auth organization deletion removes all local members directly. It does not invoke member-removal hooks for each member.

Because Polar customer deletion is destructive, the default adapter policy is to retain the Polar team customer and its member/billing snapshot. Once the Better Auth organization is gone, adapter endpoints can no longer authorize new access to it.

### User deletion

Better Auth user deletion can cascade membership rows without invoking organization member-removal hooks. Team-member cleanup needs to run while memberships are still queryable, normally in the user database delete `before` hook.

## 4.6 No distributed transaction

Better Auth and Polar cannot commit atomically. Organization hooks are awaited, but the organization routes are not one transaction spanning local writes and remote API calls.

Any implementation that promises perfect immediate consistency is incorrect. The design must instead provide:

- deterministic external IDs;
- idempotent create/update/delete operations;
- useful structured logging where it adds context;
- propagated synchronization failures—never a log-only success mode;
- a reconciliation path.

Throwing does not create a distributed transaction: a Better Auth or Polar write may already have committed before a later step fails. It does, however, prevent the adapter from deliberately reporting success after observing that synchronization failed.

---

# 5. Target internal architecture

The exact names may be adjusted during implementation, but responsibilities should remain separated.

Suggested new files:

```text
packages/polar-betterauth/src/organization/types.ts
packages/polar-betterauth/src/organization/roles.ts
packages/polar-betterauth/src/organization/polar-api.ts
packages/polar-betterauth/src/organization/sync.ts
packages/polar-betterauth/src/organization/hooks.ts
packages/polar-betterauth/src/principal.ts
```

## `organization/types.ts`

Contains public and internal organization-integration types:

- `PolarOrganizationOptions`
- `PolarOrganizationCustomerCreateParams`
- `PolarMemberRole`
- callback argument types

There is no synchronization-error policy type. Remote synchronization failures always propagate.

## `organization/roles.ts`

Pure role parsing and mapping:

- split and trim comma-separated roles;
- identify Better Auth creator role;
- calculate default Polar role;
- rank roles;
- never assign multiple Polar owners.

This file should have no SDK or Better Auth context dependencies and should be exhaustively unit tested.

## `organization/polar-api.ts`

A small, typed gateway around the exact installed Polar SDK. It should centralize SDK-version-specific method names and payload casing.

Conceptual operations:

```ts
getCustomerByExternalId(externalCustomerId)
createTeamCustomer(input)
updateCustomerByExternalId(externalCustomerId, input)
listMembers(externalCustomerId, filters?)
getMemberByExternalIds(externalCustomerId, externalMemberId)
createMemberByExternalCustomerId(externalCustomerId, input)
updateMemberByExternalIds(externalCustomerId, externalMemberId, input)
deleteMemberByExternalIds(externalCustomerId, externalMemberId)
createCustomerSession({ externalCustomerId, externalMemberId?, returnUrl? })
```

Do not make this an abstraction over unrelated Polar functionality. Its purpose is to isolate customer/member API differences and make sync logic straightforward to test.

## `organization/sync.ts`

Contains idempotent business operations:

- `ensureTeamCustomer`
- `updateTeamCustomer`
- `ensureMemberMirror`
- `updateMemberMirror`
- `removeMemberMirror`
- `reconcileOwner`
- `reconcileOrganization`

It should not know about endpoint schemas.

## `organization/hooks.ts`

Contains Better Auth organization hook composition and endpoint lifecycle bridging.

It should:

- find the Better Auth organization plugin during `polar().init(ctx)`;
- preserve application-defined hooks;
- invoke each original hook exactly once;
- invoke Polar synchronization in a documented order;
- attach leave handling where organization hooks are insufficient.

## `principal.ts`

Resolves personal versus team billing identities for adapter endpoints and performs Better Auth membership authorization.

Conceptual result:

```ts
type BillingPrincipal =
  | {
      kind: "individual";
      externalCustomerId: string;
      isAnonymous: boolean;
    }
  | {
      kind: "team";
      externalCustomerId: string;
      externalMemberId: string;
      betterAuthRole: string;
      isAnonymous: false;
    };
```

---

# 6. Public configuration design

Organization support is configured on the Polar plugin, not by requiring the user to manually paste Polar callbacks into Better Auth's organization hooks.

Accepted API after Chunk 2:

```ts
polar({
  client: polarClient,
  createCustomerOnSignUp: true,
  organization: {
    enabled: true,
    getCustomerCreateParams: async ({ organization, owner }) => ({
      metadata: {
        source: "better-auth",
      },
    }),
  },
  use: [checkout(), portal(), usage(), webhooks(...)],
});
```

Current behavior and constraints:

- `enabled` is explicit. Merely installing Better Auth's organization plugin does not opt the application into team billing.
- Omitting `organization`, or setting `{ enabled: false }`, leaves organization synchronization disabled.
- `getCustomerCreateParams` is optional and applies only to Polar team-customer creation. The existing top-level callback remains specific to personal customers and receives `{ user }`.
- The organization callback receives `{ organization, owner }` and may add fields such as metadata, locale, billing address, tax ID, or Polar organization ID.
- Its return type omits `type`, `externalId`, `name`, and `owner`. Runtime object-spread ordering also applies integration-controlled identity fields last.
- Chunk 3 added public `organization.mapMemberRole`, restricted to `member` or `billing_manager`; canonical ownership remains integration-controlled.
- Existing Better Auth organization hooks are automatically composed.
- Enabling organization support without the Better Auth organization plugin is a startup/configuration error.

## Synchronization failure policy

There is no `syncErrors` option. All observed Polar synchronization failures propagate from the awaited Better Auth lifecycle hook.

This is intentional: the adapter must not offer a mode that knowingly reports success after customer/member synchronization fails. Implementations should still:

- preserve the original SDK error;
- add context only when doing so does not replace or obscure the original error;
- never log customer-session tokens, access tokens, or full sensitive payloads.

Propagation cannot roll back writes that already committed in either system. Idempotent retries and reconciliation remain required.

---

# 7. Chunk dependency graph

```text
Chunk 1: SDK contract + pure mapping
        ↓
Chunk 2: Organization customer sync
        ↓
Chunk 3: Member roster + ownership sync
        ↓
Chunk 4: Billing principal and authorization
        ↓
Chunk 5: Organization-aware endpoints
        ↓
Chunk 6: Lifecycle gaps + reconciliation
        ↓
Chunk 7: Webhooks + docs + release work
```

Do not start endpoint changes before the principal resolver exists. Do not start roster hook wiring before the SDK member contract and role mapping are tested.

---

# 8. Chunk 1 — Polar SDK contract and pure mapping foundation

## Goal

Prove the exact Polar API surface and establish pure mapping rules without changing runtime behavior.

## Prerequisites

- Clean branch/worktree from `origin/main`.
- `pnpm install` has completed.
- Read the current `packages/polar-betterauth/package.json` and installed SDK package, rather than assuming the method names shown in `../polar-official` are already published.

## Work

### 8.1 Verify the SDK release

Determine the minimum published `@polar-sh/sdk` version that supports:

- creating `type: "team"` customers with an explicit owner;
- getting customers by external ID;
- customer-scoped member create/get/update/delete;
- member lookup by external customer ID and external member ID;
- customer-session creation with `externalMemberId`;
- member webhook payload types.

Compare:

- the installed package under `packages/polar-betterauth/node_modules/@polar-sh/sdk`;
- `../polar-official/sdk/typescript`;
- the package registry/release notes if needed.

If no suitable published release exists, stop and report the blocker. Do not silently import unpublished source from `../polar-official` and do not implement a large untyped HTTP client without approval.

### 8.2 Update package dependency ranges

The minimum published release is `@polar-sh/sdk@0.49.0`. Update the Better Auth package's development and peer dependency ranges consistently. Do not bump `@polar-sh/adapter-utils` or the other adapters: they remain on SDK 0.47. The Better Auth package can consume `@polar-sh/adapter-utils` built against 0.47 while using its own 0.49 SDK types. Regenerate `pnpm-lock.yaml` through pnpm; never hand-edit it.

### 8.3 Add the typed Polar customer/member gateway

Add `organization/polar-api.ts` or an equivalently focused module that expresses the conceptual operations listed in Section 5.

This gateway was initially used only by tests in Chunk 1. Chunk 2 imports it through `organization/hooks.ts` → `server.ts`, so it is now part of the normal runtime/build graph.

### 8.4 Add pure role mapping

Implement:

- comma-separated Better Auth role parsing;
- default mapping:
  - canonical owner → `owner`;
  - `admin` or additional owner → `billing_manager`;
  - any other role → `member`;
- deterministic role ranking;
- custom mapper type definitions, if the API can be defined without premature hook wiring.

Do not implement ownership transfer in this chunk. Only define the pure decisions ownership reconciliation will consume.

### 8.5 Add contract tests

Tests should compile and exercise the exact SDK input shapes for:

1. Team customer creation with owner external ID.
2. Customer lookup by external ID.
3. Member creation by customer external ID.
4. Member lookup/update/delete by the two external IDs.
5. Member-scoped customer-session creation.

Prefer a mocked transport or SDK client when available. A live Polar contract test may be added behind explicit environment variables and skipped by default.

## Expected files

Likely:

```text
packages/polar-betterauth/package.json
pnpm-lock.yaml
packages/polar-betterauth/src/organization/types.ts
packages/polar-betterauth/src/organization/roles.ts
packages/polar-betterauth/src/organization/polar-api.ts
packages/polar-betterauth/src/__tests__/organization/roles.test.ts
packages/polar-betterauth/src/__tests__/contract/polar-member-api.test.ts
```

Do not modify `server.ts`, endpoint plugins, or user database hooks in this chunk.

## Acceptance criteria

- The package builds against `@polar-sh/sdk` 0.49, the first published version with the required customer-scoped external member API.
- Only `@polar-sh/better-auth` requires SDK 0.49; `@polar-sh/adapter-utils` and the other adapters remain on SDK 0.47.
- No runtime organization behavior is enabled by Chunk 1 alone.
- Role parsing handles whitespace, duplicate roles, and comma-separated roles.
- SDK method and payload shapes are covered by tests rather than casts.
- Existing package tests still pass.
- No feature-specific tsconfig remains; once Chunk 2 imports these modules through `server.ts`, the normal package build type-checks them.

## Suggested verification

```bash
pnpm --filter @polar-sh/better-auth exec vitest run
pnpm --filter @polar-sh/better-auth build
```

Run the repository-wide checks only if practical; record any pre-existing failures separately.

## Stop point

Chunk 1 stopped after the SDK contract and pure mapping were reviewable. Hook wiring began in Chunk 2.

---

# 9. Chunk 2 — Organization customer creation and update synchronization

## Goal

Add explicitly enabled synchronization for Better Auth organization creation and update, but not general member-roster synchronization yet.

**Status: implemented.** The details below describe the accepted Chunk 2 behavior.

## Prerequisites

- Chunk 1 accepted.
- SDK gateway and role mapping available.

## Work

### 9.1 Add public options

Extend `PolarOptions` in `src/types.ts` with organization configuration. Export public types through the package's normal entry point.

The feature remains disabled by default and is enabled with `organization: { enabled: true }`.

### 9.2 Detect the Better Auth organization plugin

Update `polar().init(ctx)` in `src/server.ts`:

- accept the Better Auth `AuthContext` argument;
- when `organization.enabled` is true, call `ctx.getPlugin("organization")`;
- throw `Error("Polar organization support requires Better Auth's organization plugin")` if missing;
- retrieve its mutable `options.organizationHooks` object;
- compose, rather than replace, relevant hooks.

Better Auth's plugin initializer iterates configured plugins but `getPlugin` sees the configured plugin list. Avoid imposing an undocumented plugin-order requirement unless source/testing proves one is necessary.

### 9.3 Implement `ensureTeamCustomer`

Required behavior:

1. Get the customer by external ID `organization.id`.
2. If found:
   - verify it is a team customer;
   - reconcile its name if required;
   - return it without attempting roster/owner reconciliation in Chunk 2.
3. If genuinely not found:
   - resolve optional organization-specific `getCustomerCreateParams({ organization, owner })`;
   - create `type: "team"`;
   - omit customer email by default;
   - supply explicit owner with `externalId: user.id`;
   - apply identity fields after custom params so callbacks cannot override them.
4. If create races and reports an external-ID conflict:
   - refetch by external ID;
   - validate the result;
   - do not broadly swallow validation errors.

Do not search by creator email.

### 9.4 Compose `afterCreateOrganization`

Run application hooks and Polar synchronization in a documented order. Recommended order for an after hook:

1. Invoke the existing application hook.
2. If it succeeds, invoke Polar synchronization.

Rationale: if application policy fails, avoid creating a remote billing object for an operation the application considers unsuccessful. This still cannot provide atomicity, so errors must remain observable and idempotent.

`afterCreateOrganization` receives:

```ts
{
  organization,
  member,
  user,
}
```

Use `organization.id` and `user.id`; do not derive identity from slug or email.

### 9.5 Compose `afterUpdateOrganization`

When the updated organization is non-null:

- update the Polar customer by organization external ID;
- synchronize its name;
- never attempt to change the Polar customer external ID or type.

The create-params callback is not reused for updates. When Better Auth returns `organization: null`, warn and skip the invalid Polar update.

### 9.6 Handle creator `afterAddMember` ordering

Chunk 2 does not yet synchronize general members. However, if the hook-composition utility touches `afterAddMember`, it must preserve the existing application hook and must not try to create the creator in Polar before `afterCreateOrganization` creates the customer.

Prefer leaving member hook wiring for Chunk 3 unless shared composition requires it.

## Tests

Add tests for:

- organization support omitted/disabled;
- explicitly enabled without Better Auth organization plugin;
- existing organization hooks preserved and invoked once;
- new team customer payload, including explicit owner and omitted customer email;
- custom create params cannot override IDs/type/owner identity;
- retry when the customer already exists;
- reject an existing individual customer with the same external ID;
- organization rename;
- null adapter update result;
- non-404 errors are not treated as missing customers.

The accepted Chunk 2 tests instantiate Better Auth's real `organization()` plugin object and verify that its mutable `organizationHooks` are composed. They do not run a database-backed end-to-end organization lifecycle because the local Better Auth test utility requires an unavailable `better-sqlite3` native binding in this environment. Chunk 3 should add a full lifecycle integration test when a viable test adapter/native binding is available, because creator `afterAddMember` ordering becomes directly relevant there.

## Expected files

Likely:

```text
packages/polar-betterauth/src/types.ts
packages/polar-betterauth/src/server.ts
packages/polar-betterauth/src/organization/sync.ts
packages/polar-betterauth/src/organization/hooks.ts
packages/polar-betterauth/src/index.ts
packages/polar-betterauth/src/__tests__/organization/customer-sync.test.ts
packages/polar-betterauth/src/__tests__/organization/hooks.test.ts
```

## Acceptance criteria

- Organization support is explicitly enabled with `organization.enabled`.
- Enabling it without Better Auth's organization plugin fails clearly.
- Organization creation sends one team-customer create request with an explicit owner.
- Existing customer lookup and external-ID race refetches make retried creation idempotent.
- Existing-customer owner reconciliation remains deferred to Chunk 3.
- Existing application hooks still run exactly once.
- Personal-customer behavior is unchanged.

## Stop point

Chunk 2 stops before syncing non-creator members or modifying Polar-backed endpoints. Continue with Chunk 3.

---

# 10. Chunk 3 — Member roster and ownership synchronization

## Goal

Mirror Better Auth organization membership and roles into Polar while respecting Polar's single-owner invariant.

## Prerequisites

- Chunks 1–2 accepted.
- Team customer creation is stable and idempotent.

## Work

### 10.1 Implement `ensureMemberMirror`

Input should contain at least:

```ts
{
  organizationId: string;
  user: { id: string; email: string; name?: string | null };
  betterAuthRole: string;
}
```

Behavior:

1. Get the team customer by organization external ID.
2. If it is genuinely missing during the creator's `afterAddMember`, defer to `afterCreateOrganization`.
3. Get the member by organization external ID and user external ID.
4. If missing, create it with:
   - `externalId: user.id`;
   - current email/name;
   - mapped non-owner role unless ownership reconciliation selects it as owner.
5. If found, reconcile email, name, and role.
6. If Polar's create returns an existing member by email, update/reconcile it explicitly and verify its external ID relationship.

### 10.2 Wire both creation paths

Compose:

- `afterAddMember`
- `afterAcceptInvitation`

Invitation acceptance does not call `afterAddMember` in the researched Better Auth source. Both must call the same idempotent helper.

### 10.3 Define canonical-owner reconciliation

Polar allows one owner; Better Auth can have several.

Recommended algorithm:

1. Read Better Auth members for the organization.
2. Identify members whose comma-separated roles contain the configured Better Auth creator role (`creatorRole`, default `owner`).
3. Read the current Polar owner.
4. If the current Polar owner's external user ID still belongs to the organization and still has the Better Auth creator role, retain them.
5. Otherwise, choose a deterministic successor from eligible Better Auth owners:
   - earliest `createdAt`;
   - tie-break by opaque ID string.
6. Ensure the successor exists in Polar.
7. Promote the successor to Polar owner. Polar will demote the previous owner to `billing_manager`.
8. Reconcile all other Polar members to their non-canonical mapped roles.
9. If Better Auth has no owner candidate, return an explicit invariant error instead of trying to demote/delete the last Polar owner.

For additional Better Auth owners, map to `billing_manager` by default.

Do not transfer ownership merely because a second Better Auth owner was added. Preserve the current valid canonical owner.

### 10.4 Wire role updates

Compose `afterUpdateMemberRole`:

- use `data.member` as the updated membership;
- reconcile canonical ownership first;
- then reconcile the affected member's final Polar role;
- account for Polar's automatic demotion of the previous owner by reconciling both members.

### 10.5 Wire member removal

Compose `afterRemoveMember`:

1. Query remaining Better Auth members.
2. If the departing user is the Polar owner, promote a valid successor first.
3. Delete the Polar member by external organization ID and external user ID.
4. Treat an already-missing Polar member as idempotent success only when the SDK error is a confirmed not-found.

Chunk 6 will handle self-leave and user deletion, which bypass this hook.

### 10.6 Custom role mapper

Expose a callback with enough information to map custom Better Auth roles, but do not allow it to violate ownership invariants.

For example, a custom callback may select `billing_manager` versus `member`; canonical-owner selection remains integration-controlled.

## Tests

Cover:

- creator `afterAddMember` occurring before customer creation;
- direct member addition;
- invitation acceptance;
- duplicate/add retry;
- user in multiple organizations using the same external member ID safely;
- admin → billing manager;
- custom role → member by default;
- comma-separated roles;
- second Better Auth owner does not steal Polar ownership;
- canonical owner demotion transfers ownership;
- owner removal promotes successor before deletion;
- removal of non-owner;
- refusal to remove/demote the last owner;
- application hook composition and call ordering;
- Polar ownership transfer automatically demoting the previous owner, followed by reconciliation.

Use both isolated sync-helper tests and at least one real Better Auth lifecycle integration test.

## Acceptance criteria

- Direct and invited memberships are mirrored.
- Member IDs use Better Auth `user.id` externally.
- No operation leaves Polar without exactly one owner when Better Auth remains valid.
- Multiple Better Auth owners are represented without violating Polar constraints.
- Removal is idempotent but does not swallow unrelated SDK errors.

## Stop point

Stop before modifying checkout, portal, or usage endpoints.

---

# 11. Chunk 4 — Billing-principal resolution and authorization

## Goal

Create one well-tested authorization boundary that resolves personal versus organization billing identities.

## Prerequisites

- Chunks 1–3 accepted.
- Member mirror uses organization ID and user ID externally.

## Work

### 11.1 Add `BillingPrincipal`

Conceptual type:

```ts
type BillingPrincipal =
  | {
      kind: "individual";
      externalCustomerId: string;
      isAnonymous: boolean;
    }
  | {
      kind: "team";
      externalCustomerId: string;
      externalMemberId: string;
      betterAuthRole: string;
      isAnonymous: false;
    };
```

### 11.2 Implement `resolveBillingPrincipal`

Inputs should include:

- endpoint context or authenticated session;
- optional explicit `organizationId`;
- optional authorization level, such as `member` or `billing`.

Behavior without `organizationId`:

- preserve current individual behavior;
- use `session.user.id` as customer external ID when authenticated;
- preserve existing anonymous rules and endpoint-specific checks.

Behavior with `organizationId`:

1. Require a valid authenticated session.
2. Reject anonymous users.
3. Query Better Auth's logical `member` model using both:
   - `userId = session.user.id`
   - `organizationId = requested organizationId`
4. Reject if no matching membership exists.
5. Return:
   - `externalCustomerId = organizationId`
   - `externalMemberId = session.user.id`
   - Better Auth role from the matched membership.
6. If billing authorization is required, allow only roles whose mapping is `owner` or `billing_manager`, unless a configurable authorization callback says otherwise.

Do not authorize merely because `session.session.activeOrganizationId` equals the input. Always verify membership.

### 11.3 Explicit organization selection

Do not automatically use `activeOrganizationId` when the request omits `organizationId`.

Reason: a user setting an active organization for navigation should not silently redirect an otherwise personal checkout or portal call to the organization's billing account.

### 11.4 Optional lazy reconciliation

Decide and test whether team-principal resolution should call a lightweight `ensureTeamCustomer`/`ensureMemberMirror` before returning. This can repair failed creation hooks but adds remote API calls to every organization endpoint.

Recommended split:

- principal resolution performs local authorization only;
- the endpoint's Polar call may use an explicit `ensure` step when a missing mirror needs to be repaired;
- do not hide authorization and reconciliation in one untestable function.

## Tests

Cover:

- unauthenticated individual behavior as currently supported;
- authenticated individual principal;
- valid team member;
- non-member requesting another organization;
- anonymous team request;
- spoofed organization ID;
- matching active organization but absent membership;
- owner/admin billing authorization;
- ordinary member denied billing authorization;
- custom/multi-role authorization;
- custom Better Auth schema/model mapping where practical.

## Expected files

Likely:

```text
packages/polar-betterauth/src/principal.ts
packages/polar-betterauth/src/__tests__/principal.test.ts
```

Endpoint schemas should not be changed in this chunk.

## Acceptance criteria

- One shared resolver defines organization authorization.
- No Polar call is made for unauthorized organization access.
- Personal behavior remains unchanged.
- Billing-capable and ordinary-member policies are explicit and testable.

## Stop point

Stop before wiring the resolver into endpoint plugins.

---

# 12. Chunk 5 — Organization-aware Polar endpoints

## Goal

Allow existing adapter endpoints to act for an explicitly selected organization using the shared billing principal.

## Prerequisites

- Chunks 1–4 accepted.
- Principal resolver is thoroughly tested.

## General endpoint rule

Every endpoint that accepts `organizationId` must:

1. Parse it through its Zod request schema.
2. Resolve and authorize the Better Auth principal.
3. Avoid forwarding `organizationId` as arbitrary Polar metadata.
4. Call Polar using the resolved external customer/member IDs.
5. Preserve existing behavior when `organizationId` is absent.

## 12.1 Checkout

File:

```text
packages/polar-betterauth/src/plugins/checkout.ts
```

Add optional `organizationId` to the request body.

For organization checkout:

- require an authenticated non-anonymous user;
- require billing-capable Better Auth membership by default;
- use `organization.id` as `externalCustomerId`;
- do not use the user's personal customer ID;
- do not put `organizationId` into `referenceId` metadata automatically.

The researched Polar checkout create model associates a checkout with the external customer but does not expose external member attribution in the same way event ingestion does. Authorization therefore belongs in the Better Auth adapter.

Keep `referenceId` as generic metadata for backward compatibility. Document that it is no longer the way to represent organization ownership.

## 12.2 Portal and customer state

File:

```text
packages/polar-betterauth/src/plugins/portal.ts
```

For team principals, customer-session creation must include:

```ts
{
  externalCustomerId: organization.id,
  externalMemberId: user.id,
}
```

Polar requires a member identifier for team customer sessions when the member model is enabled.

Add organization selection consistently to:

- portal URL/session;
- customer state;
- benefits;
- subscriptions;
- orders.

For GET endpoints, use an optional query field. For POST portal requests, define whether `organizationId` is in the body or query and keep client/server schemas consistent. Avoid silently supporting different locations without tests.

Direct state lookup uses the customer external ID after Better Auth membership authorization. Portal-backed resources should use the member-scoped customer-session token so Polar can enforce member permissions.

## 12.3 Usage and meters

File:

```text
packages/polar-betterauth/src/plugins/usage.ts
```

For organization meter listing:

- create a member-scoped customer session;
- use team customer and member external IDs.

For organization event ingestion:

- `externalCustomerId = organization.id`;
- `externalMemberId = user.id`;
- preserve caller metadata without allowing it to override those identities.

## 12.4 Subscription `referenceId` path

The existing subscription endpoint may support listing by arbitrary `referenceId` metadata. Do not reinterpret that field as organization authorization.

At minimum:

- reject or clearly define requests that contain both `organizationId` and an incompatible `referenceId` path;
- never let `referenceId` bypass organization membership checks;
- keep legacy behavior unchanged for requests without `organizationId` unless a separate security fix is approved.

## Tests

For each endpoint family, cover:

- unchanged personal request;
- valid organization request;
- organization external customer ID sent to Polar;
- member external ID sent where supported/required;
- non-member rejected before Polar call;
- anonymous team request rejected;
- ordinary member checkout denied by default;
- owner/admin checkout allowed;
- request schema strips `organizationId` from downstream metadata;
- explicit organization selection does not depend on active organization;
- portal return URL/theme behavior remains unchanged;
- `referenceId` compatibility and conflicting-input behavior.

## Acceptance criteria

- All listed endpoints can act for a team customer.
- All organization operations are authorized locally first.
- Portal operations use Polar member sessions.
- Usage events include member attribution.
- Existing personal endpoint tests remain green.

## Stop point

Stop before user-deletion/leave reconciliation and webhook expansion.

---

# 13. Chunk 6 — Lifecycle gaps, profile synchronization, and reconciliation

## Goal

Cover the paths Better Auth's organization hooks do not cover and provide a repair strategy for partial failures.

## Prerequisites

- Chunks 1–5 accepted.

## 13.1 Self-leave

Better Auth's `leaveOrganization` does not invoke member-removal hooks in the researched source.

Add a Better Auth plugin-level after hook whose matcher targets the exact leave endpoint path. Confirm the path value from Better Auth hook tests/source rather than guessing.

After a successful leave:

1. Read the returned deleted membership.
2. Identify `organizationId` and `userId`.
3. Reconcile/transfer Polar ownership if necessary.
4. Delete the Polar member by external IDs.
5. Propagate any Polar synchronization failure.

Test that admin removal still uses `afterRemoveMember` and self-leave uses only the endpoint hook, with no duplicate deletion.

## 13.2 User profile update

Extend the existing user database update hook:

1. Preserve current personal-customer synchronization.
2. Query all Better Auth memberships for the updated user.
3. For every organization membership, update the Polar member's email and name by:
   - customer external ID = membership organization ID;
   - member external ID = user ID.
4. Treat an absent team mirror as a reconciliation problem and propagate failures.

Be aware that one user can belong to many organizations. Avoid unbounded accidental concurrency; use a small bounded concurrency strategy or sequential calls initially.

## 13.3 User deletion

Use the Better Auth user database delete `before` hook because membership rows may no longer be queryable in `after`.

For every membership:

1. Determine whether the user is the canonical Polar owner.
2. Select and promote a successor when Better Auth has another valid owner.
3. Delete the Polar member.
4. If the user is the sole owner and Better Auth would orphan the organization, fail with an actionable error rather than leaving Polar in an impossible owner state.

Then preserve the existing personal Polar customer deletion behavior in the appropriate existing hook.

Do not store per-request deletion state in a process-global map keyed only by user ID; concurrent operations and serverless execution make that unsafe.

## 13.4 Organization deletion policy

Default: retain the Polar customer and billing data.

Do not call Polar customer delete from `afterDeleteOrganization` because that would immediately cancel subscriptions and revoke benefits.

Optionally log a structured retention event or update harmless metadata if product requirements call for it. Do not add destructive opt-in deletion in this chunk unless explicitly approved and tested.

## 13.5 Reconciliation helper

Add an internal or deliberately exported server-side helper that can rebuild one organization mirror from Better Auth state.

Conceptual operation:

```ts
await reconcileOrganization({
  authContext,
  polarClient,
  organizationId,
});
```

It should:

1. Load the Better Auth organization.
2. Load all Better Auth memberships and associated users.
3. Ensure the Polar team customer exists.
4. Ensure all current members exist with current name/email/roles.
5. Reconcile the canonical owner.
6. Optionally list Polar members and delete stale non-owner members.
7. Never delete the Polar customer.
8. Report a structured summary:
   - customer created/updated;
   - members created/updated/deleted;
   - owner transferred;
   - warnings/errors.

If stale-member deletion cannot be safely implemented with the selected SDK, ship create/update reconciliation first and clearly report that deletion reconciliation remains incomplete.

Do not expose an unauthenticated HTTP endpoint automatically. The helper may be invoked from trusted application/admin code or future tooling.

## 13.6 Logging

Use Better Auth's logger/context where available. Include:

- operation name;
- organization ID;
- user ID;
- result category;
- Polar resource ID when safe/useful;
- error message/cause.

Never log:

- Polar access tokens;
- customer/member session tokens;
- webhook secrets;
- full billing addresses or sensitive request payloads.

## Tests

Cover:

- self-leave cleanup;
- no duplicate cleanup on admin removal;
- owner self-leave with valid successor;
- sole-owner user deletion blocked;
- user name/email update across multiple organizations;
- reconciliation creates missing customer/member records;
- reconciliation corrects stale roles and names;
- reconciliation transfers owner;
- reconciliation handles already-correct state without writes;
- organization deletion does not call Polar customer deletion;
- partial SDK failure produces useful error/log output.

## Acceptance criteria

- All known Better Auth membership-removal paths are covered.
- User updates synchronize all mirrored member profiles.
- Sole-owner deletion cannot silently corrupt Polar ownership.
- A failed/partial sync has a documented repair mechanism.
- Better Auth organization deletion does not destroy billing data.

## Stop point

Stop before webhook/documentation/release changes.

---

# 14. Chunk 7 — Member webhooks, documentation, examples, and release work

## Goal

Complete the public surface and release documentation after runtime behavior is stable.

## Prerequisites

- Chunks 1–6 accepted.
- SDK member webhook payload types verified.

## 14.1 Shared webhook support

Extend:

```text
packages/adapter-utils/src/webhooks/webhooks.ts
packages/adapter-utils/src/webhooks/webhooks.test.ts
```

Support:

- `member.created`
- `member.updated`
- `member.deleted`

Use SDK-generated payload types from the selected SDK version. Add dispatch tests for all three events.

Do not assume event ordering:

- Polar owner creation can produce `member.created` around customer creation.
- Customer lifecycle webhooks may be queued asynchronously.
- Ownership transfer may update/demote more than one record while only some changes emit member webhooks.

Consumers must handle events idempotently.

## 14.2 Better Auth webhook plugin options

Extend:

```text
packages/polar-betterauth/src/plugins/webhooks.ts
```

with optional callbacks:

```ts
onMemberCreated
onMemberUpdated
onMemberDeleted
```

These callbacks are notification-only. Add explicit documentation warning consumers not to mutate Better Auth membership from these callbacks.

## 14.3 README

Document:

- feature overview;
- required Polar member-model feature;
- configuration example;
- canonical ID mapping;
- role mapping and single-owner behavior;
- explicit `organizationId` on endpoints;
- portal member sessions;
- retained-customer behavior on Better Auth organization deletion;
- cross-system consistency and reconciliation;
- migration away from using `referenceId` as the organization relationship;
- required Polar token scopes, including member read/write as applicable.

## 14.4 Example application

Update:

```text
packages/polar-betterauth/example/src/lib/auth.ts
packages/polar-betterauth/example/src/lib/auth-client.ts
```

Show:

- Better Auth organization plugin enabled;
- Polar organization integration enabled;
- checkout with explicit `organizationId`;
- organization portal access;
- optional member webhook callbacks.

Keep secrets/environment values out of source.

## 14.5 Release metadata

Inspect repository release conventions. Because this adds public options and endpoint request fields without intentionally breaking existing behavior, it will likely require a minor changeset for:

- `@polar-sh/better-auth`
- `@polar-sh/adapter-utils` if its public webhook types/options change.

Do not manually change package versions when the repository uses Changesets.

## Tests and verification

Run at least:

```bash
pnpm --filter @polar-sh/adapter-utils test -- --run
pnpm --filter @polar-sh/better-auth exec vitest run
pnpm --filter @polar-sh/better-auth build
pnpm build
pnpm check
pnpm test
```

Adjust the first command if the package's script does not accept `--run`; report exact commands used.

## Acceptance criteria

- Member webhook payloads dispatch correctly.
- Public types are exported.
- README and example match actual endpoint schemas and configuration names.
- Migration and deletion semantics are explicit.
- Changesets/release metadata are present where required.
- Full repository checks pass or any unrelated baseline failures are documented.

---

# 15. Testing strategy across all chunks

## 15.1 Pure unit tests

Use for:

- role parsing/mapping;
- owner selection;
- payload construction;
- SDK error classification;
- principal authorization decisions.

These should be fast and not require Better Auth or Polar servers.

## 15.2 Better Auth integration tests

Use Better Auth's test utilities or the adapter package's existing test setup to exercise real plugin wiring:

- organization creation ordering;
- direct add;
- invitation acceptance;
- role update;
- admin removal;
- self-leave;
- existing-hook composition;
- user update/delete database hooks.

Mock only the Polar client/gateway. Do not mock the Better Auth lifecycle that the test is intended to verify.

## 15.3 Polar API contract tests

Use for confirming actual SDK/server behavior:

- team customer creation with explicit owner;
- external-ID customer lookup;
- external-ID member CRUD;
- ownership transfer;
- owner deletion guard;
- member-scoped customer session;
- member-model-disabled error.

Live tests must be opt-in through environment variables and skipped by default. Cleanup must be deliberate because Polar customer deletion cancels subscriptions and revokes benefits.

## 15.4 Endpoint tests

Every organization-aware endpoint should assert both authorization and exact Polar input. A non-member test must verify that the Polar mock was not called.

## 15.5 Regression tests

Always retain tests for:

- personal signup/customer creation;
- personal checkout;
- personal portal;
- anonymous restrictions;
- existing webhook events;
- existing `referenceId` behavior where not intentionally changed.

---

# 16. Security checklist

An implementation chunk is incomplete if it violates any of these:

- Never trust `organizationId` without checking Better Auth membership.
- Never authorize from `activeOrganizationId` alone.
- Never use creator email to identify an organization customer.
- Never let custom create params override customer/member external IDs.
- Never issue a team customer session without the authenticated member external ID.
- Never allow an ordinary member to create organization checkout by default.
- Never silently treat authorization/network/validation SDK errors as not-found.
- Never delete a Polar team customer merely because the Better Auth organization was deleted.
- Never synchronize Polar member webhooks back into Better Auth memberships.
- Never log access tokens, customer-session tokens, or webhook secrets.

---

# 17. Performance and reliability checklist

- Avoid one Polar list call per member when a batch/list endpoint is available.
- Bound concurrency when a user belongs to many organizations.
- Keep all synchronization operations idempotent.
- Classify typed SDK errors centrally.
- Preserve original errors as causes.
- Reconciliation should produce a structured result, not only logs.
- Do not add a permanent local mapping table unless deterministic external IDs prove insufficient.
- Do not cache membership authorization across requests without a clear invalidation strategy.

---

# 18. Explicit non-goals for the first release

Unless separately approved, do not add:

- Better Auth team → Polar customer/member mapping. The scope is Better Auth organizations, not organization-plugin teams.
- Polar webhook → Better Auth roster mutation.
- Automatic destructive Polar customer deletion.
- Implicit billing against the session's active organization.
- A public unauthenticated reconciliation endpoint.
- A new database table solely for Polar IDs.
- Perfect distributed transaction guarantees.
- Automatic seat assignment or seat-quantity purchasing beyond what existing checkout APIs already support.

---

# 19. Implementation decisions

## SDK release availability

What is the first published `@polar-sh/sdk` version containing the required external customer/member methods? This is a hard Chunk 1 gate.

## Reconciliation export — resolved

`reconcileOrganization` remains an internal server helper in the first release. No HTTP endpoint is installed and it is not exported from the package entry point.

## Synchronization failure policy — resolved

All Polar synchronization failures propagate. Do not add a best-effort/log-only option. The non-atomicity caveat still applies because throwing cannot undo a Better Auth or Polar write that has already committed.

## Billing-role customization — resolved

Checkout uses the default role mapping: Better Auth owner/admin roles are billing-capable and ordinary members are denied. The internal principal resolver supports a custom authorization callback, but no additional public root option is exposed in this release. `organization.mapMemberRole` customizes non-owner Polar roles.

---

# 20. Definition of done

The full feature is complete when all of the following are true:

1. Organization support is explicitly enabled through `organization.enabled` and startup-validated.
2. Better Auth organization IDs map to Polar team customer external IDs.
3. Better Auth user IDs map to Polar member external IDs within each team customer.
4. Organization creation produces a team customer and explicit owner without email collisions.
5. Organization updates synchronize customer names.
6. Direct and invited members synchronize.
7. Role changes and multiple Better Auth owners respect Polar's single-owner invariant.
8. Admin removal, self-leave, and user deletion are covered.
9. Personal behavior remains backward compatible.
10. Organization-aware endpoints authorize membership before Polar calls.
11. Portal resources use member-scoped Polar sessions.
12. Usage events carry both team customer and member attribution.
13. Better Auth organization deletion retains Polar billing data by default.
14. Member webhook callbacks are supported and notification-only.
15. Reconciliation can repair missing/stale mirrors.
16. Unit, integration, contract, endpoint, and regression tests pass.
17. README, example, and release metadata match the implementation.

---

# 21. Handoff template for each implementing agent

Use this at the end of a chunk:

```md
## Chunk N handoff

### Summary

### Commit/diff

### Files changed

### Public API changes

### Important implementation decisions

### Tests run

- `command`: result

### Deferred work

### Risks or follow-up questions

### Recommended starting point for the next agent
```

The next agent should read:

1. This plan.
2. The previous chunk's handoff.
3. The accepted diff/commit.
4. The relevant upstream source paths listed for their chunk.

They should not reimplement or redesign accepted earlier chunks without first reporting a concrete correctness problem.
