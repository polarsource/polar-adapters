---
name: polar-better-auth-organization-backfill
description: Create a safe, idempotent script that reads Better Auth organizations, users, and memberships from an application's database and reconciles them with Polar team customers and members while @polar-sh/better-auth organization synchronization may already be enabled. Use when backfilling a mixed set of existing unsynchronized, newly synchronized, and partially synchronized organizations.
license: MIT
metadata:
  author: polar
  version: "0.1.0"
---

# Polar Better Auth organization backfill

Create a one-off, application-specific backfill script. Do not assume a database engine, ORM, table name, Better Auth adapter, role configuration, Polar environment, or SDK version.

The script must be safe to preview, interrupt, and rerun. Assume `organization: { enabled: true }` may already be deployed and the database contains a mix of older unsynchronized organizations, newer fully synchronized organizations, and organizations left partially synchronized by an earlier failure. It must read Better Auth as the source of truth and write only the corresponding Polar team customers and members. A fully synchronized organization must be detected as unchanged and produce no writes. It must not migrate subscriptions, orders, benefits, seats, or legacy `referenceId` metadata.

## Talk to the user before writing the script

First inspect the application's Better Auth server configuration, package versions, database schema, environment conventions, and existing script patterns. Then ask the user for anything that cannot be determined locally.

At minimum, establish:

1. Which database and Better Auth adapter are used: PostgreSQL, MySQL, SQLite, MongoDB, Prisma, Drizzle, Kysely, or another adapter.
2. How a local script should connect. Ask for the environment-variable name, SSL requirements, and the project's preferred database client. Never ask the user to paste a credential into chat. Instruct them to set it locally, for example as `DATABASE_URL`, and prefer a read-only database credential.
3. The physical table or collection names and field mappings for Better Auth `user`, `organization`, and `member`. Better Auth model names and columns can be customized; do not assume defaults.
4. Whether data is tenant-partitioned, soft-deleted, or filtered by application-specific fields.
5. Better Auth's configured organization `creatorRole`, which defaults to `owner`.
6. Whether `mapBetterAuthRoleToPolarRole` is configured. Reuse the application's mapping logic when practical; otherwise ask the user to confirm an equivalent mapping.
7. The Polar environment: sandbox or production. Keep their tokens separate. Ask them to set `POLAR_ACCESS_TOKEN` locally and confirm that it is an organization access token for the intended Polar organization.
8. Whether Polar's customer member model is enabled and the token has `customers:read`, `customers:write`, `members:read`, and `members:write` scopes.
9. Desired batch size, concurrency, checkpoint location, organization filters, and expected live organization mutation volume while the script runs.

Explain the proposed query and mapping to the user before implementing writes. Provide a dry-run command and an apply command. Do not run production writes without explicit confirmation.

## Understand the entity relationships

Better Auth is the source of truth for organization identity, roster, profile, and role data.

| Better Auth | Relationship | Polar |
| --- | --- | --- |
| `organization.id` | Stable cross-system identifier | Team customer `external_id` |
| `organization.name` | Billing team display name | Team customer `name` |
| One `organization` | Has many membership rows | One team customer has many members |
| `member.organizationId` | Joins membership to organization | Selects the team customer |
| `member.userId` | Joins membership to user | Member `external_id` |
| `user.email` | Member contact identity | Member `email` |
| `user.name` | Member display name | Member `name` |
| `member.role` | Better Auth role source | Polar member role after mapping |
| `member.id` | Better Auth membership-row identity | No Polar mapping; never use as `external_id` |

A Better Auth user can belong to many organizations. Polar member external IDs are scoped to a team customer, so the same `user.id` can be used in every team customer to which that user belongs.

Only accepted memberships are mirrored. Do not create Polar members from pending invitations. Ignore Better Auth sessions, accounts, verifications, invitations, teams, and unrelated custom models unless the application demonstrates that they alter the organization roster.

The conceptual database join is:

```text
organization
  JOIN member ON member.organizationId = organization.id
  JOIN user   ON user.id = member.userId
```

Translate that join through the application's actual adapter and physical schema. Fetch organizations and memberships in deterministic batches. Avoid loading the entire database into memory.

## Map ownership and roles exactly like the adapter

Polar permits exactly one owner per team customer.

1. Parse Better Auth's potentially comma-separated role string by splitting on `,`, trimming each value, removing empty values, and keeping role names case-sensitive.
2. Find memberships containing Better Auth's configured `creatorRole`, defaulting to `owner`.
3. If no membership has the creator role, report an invariant failure for that organization and do not guess an owner.
4. If creating a new Polar team customer, choose the earliest creator-role membership by `member.createdAt`, breaking ties by `member.id` lexicographically.
5. If a Polar team customer already exists and its single current owner is still a Better Auth creator-role member, retain that owner. Otherwise choose the earliest eligible creator-role member.
6. The selected member maps to Polar `owner`.
7. Additional Better Auth creator-role members map to `billing_manager`.
8. By default, Better Auth `admin` maps to `billing_manager`; other roles map to `member`.
9. If the application configures `mapBetterAuthRoleToPolarRole`, use it for non-canonical members. It may return only `member` or `billing_manager`; ownership remains controlled by the script.

Never create an ordinary member with role `owner`. Polar's member-create endpoint accepts only `member` or `billing_manager`. Establish the initial owner in the team-customer create request. For an existing team customer, ensure the successor member exists and then transfer ownership with the member update endpoint. Promote the successor before updating the previous owner; Polar automatically demotes the previous owner to `billing_manager`, after which the script may apply a desired `member` role.

## Use these Polar API endpoints

Use an organization-scoped access token and send:

```http
Authorization: Bearer $POLAR_ACCESS_TOKEN
Content-Type: application/json
```

Production base URL: `https://api.polar.sh/v1`

Sandbox base URL: `https://sandbox-api.polar.sh/v1`

URL-encode every external ID inserted into a path.

### Team customers

| Purpose | Method and path |
| --- | --- |
| Find organization customer | `GET /customers/external/{organizationExternalId}` |
| Create team customer | `POST /customers/` |
| Update team customer | `PATCH /customers/external/{organizationExternalId}` |

Create a team customer with the canonical owner atomically:

```json
{
  "type": "team",
  "external_id": "<betterAuthOrganization.id>",
  "name": "<betterAuthOrganization.name>",
  "owner": {
    "external_id": "<ownerUser.id>",
    "email": "<ownerUser.email>",
    "name": "<ownerUser.name>"
  }
}
```

Do not set the team customer email from the owner. A team customer may have no email; the owner member carries the person's email. Preserve any application-approved customer metadata or billing fields, but never let custom data override `type`, `external_id`, `name`, or owner identity.

A `404` from the external lookup means the team customer can be created. If creation reports an external-ID race, fetch it again and validate it. If the existing customer has `type !== "team"`, stop that organization and report the collision. Never delete or convert an individual customer automatically.

### Members

| Purpose | Method and path |
| --- | --- |
| List all customer members | `GET /members/?external_customer_id={organizationExternalId}` |
| Find member by both external IDs | `GET /customers/external/{organizationExternalId}/members/{userExternalId}` |
| Create member under team customer | `POST /customers/external/{organizationExternalId}/members` |
| Update profile or role | `PATCH /customers/external/{organizationExternalId}/members/{userExternalId}` |

Paginate the member list until every page has been read. Do not assume the first page is the complete roster. Never delete Polar members during the backfill. Report members whose external IDs are absent from Better Auth so an operator can investigate them separately.

Create a non-owner member with:

```json
{
  "external_id": "<betterAuthUser.id>",
  "email": "<betterAuthUser.email>",
  "name": "<betterAuthUser.name>",
  "role": "member"
}
```

Use `billing_manager` instead when role mapping requires it. Update existing members with only the fields that differ:

```json
{
  "email": "<betterAuthUser.email>",
  "name": "<betterAuthUser.name>",
  "role": "billing_manager"
}
```

Use `PATCH` with `{ "role": "owner" }` to transfer ownership after ensuring the successor exists.

### Current `@polar-sh/sdk` service equivalents

Prefer the application's installed SDK when its generated signatures match. Inspect its types rather than guessing casing. The adapter's current SDK generation maps the endpoints as follows:

```text
GET    customer external ID  -> client.customers.getExternal(...)
POST   customer              -> client.customers.create(...)
PATCH  customer external ID  -> client.customers.updateExternal(...)
GET    members list          -> client.members.listMembers(...)
GET    external member       -> client.customers.members.getExternal(...)
POST   external member       -> client.customers.members.createExternal(...)
PATCH  external member       -> client.customers.members.updateExternal(...)
```

SDK versions differ in argument shape and snake_case versus camelCase conventions. The REST method, path, and JSON payloads above are the semantic source of truth; adapt them to the installed SDK's generated types.

## Build an idempotent reconciliation loop

For each Better Auth organization:

1. Read a consistent Better Auth snapshot for the organization, then validate the organization and joined user/member records. Report missing users, duplicate memberships for one user, invalid emails, or no creator-role member before writing.
2. Calculate the expected canonical owner and expected Polar role for every membership.
3. Fetch the Polar customer by `organization.id`.
4. If missing, create the team customer with the canonical owner. Handle a concurrent external-ID conflict by refetching.
5. If present, require `type === "team"`; update the team name if needed.
6. Fetch every Polar member page and require exactly one current owner for an existing team customer.
7. Retain a valid current owner. Otherwise ensure the desired successor exists and promote it before reconciling the previous owner.
8. For each Better Auth membership, create a missing member or update differing email, name, and non-owner role fields.
9. Report Polar members whose external IDs are absent from Better Auth without deleting them.
10. If the customer and complete member roster already match the Better Auth snapshot, mark the organization unchanged and issue no mutation requests.
11. After reconciliation, reread Better Auth and refetch Polar. If Better Auth changed while the organization was being processed, reconcile the fresh snapshot again with a small bounded retry count. Mark the organization unsuccessful rather than claiming convergence if it keeps changing.
12. Verify the final team customer and complete roster against the latest Better Auth snapshot before marking the organization successful.

A rerun must converge without creating duplicates or issuing unnecessary updates. Use stable external IDs, deterministic ordering, bounded concurrency, and a checkpoint containing the last completed organization ID. Treat a customer or member `404` as absence only where described; propagate authentication, authorization, validation, rate-limit, network, and server failures with enough context to resume safely. Handle create races by refetching and diffing the resulting resource. Handle update or ownership races by refetching the customer and roster before retrying.

## Script interface and safety requirements

Produce a script consistent with the application's language and tooling. It must have an explicit `--dry-run` flag. Dry-run mode must perform all database reads, Polar lookups, validation, ownership selection, role mapping, and diff calculation, but it must not call any Polar mutation endpoint. Make dry-run the default when neither `--dry-run` nor `--apply` is provided.

Keep dry-run output concise regardless of database size. Do not print one line per organization or member. Print one human-readable aggregate summary after the scan completes, with totals for records scanned, planned creates and updates, ownership transfers, unchanged records, extra Polar members, conflicts, and errors. For example:

```text
Polar organization backfill dry-run

Scanned
  Organizations: 348
  Better Auth memberships: 12,418

Planned Polar changes
  Team customers: 291 create, 12 update, 45 unchanged
  Members: 10,204 create, 317 update, 1,897 unchanged
  Ownership transfers: 4
  Extra Polar members: 6 reported for separate review

Unable to synchronize
  Customer type conflicts: 2
  Organizations without an owner: 1
  Other errors: 0

No Polar changes were made.
```

Errors still need enough organization and user identifiers in the script's error report or logs to be actionable, but routine successful records must not flood standard output.

The script should support at least:

```text
--dry-run                    preview a human-readable plan without Polar writes
--apply                      perform approved writes
--organization-id <id>       process one organization for testing or repair
--batch-size <n>             bound database reads
--concurrency <n>            keep Polar API concurrency conservative
--checkpoint <path>          resume after interruption
```

Also provide:

- An `.env.example` containing variable names only, never secrets.
- A command for sandbox dry-run, sandbox apply, production dry-run, and production apply.
- A concise final summary with scanned/created/updated/unchanged/conflict/error counts; detailed output should be limited to actionable errors or an optional report file.
- A non-zero exit code when any organization failed or remained unverifiable.
- Tests for role parsing, canonical-owner selection, role mapping, missing users, existing individual-customer collisions, mixed synchronized and unsynchronized organizations, fully synchronized no-op behavior, partial-state repair, concurrent create/update races, idempotent reruns, ownership transfer ordering, pagination, and dry-run behavior.

Assume synchronization is already enabled. Creating a missing team customer makes that organization visible to lifecycle synchronization immediately, so the script must tolerate hooks changing the same Polar customer or members while it runs. Do not require the user to disable synchronization or pause all organization mutations. Use per-organization snapshots, idempotent external-ID operations, refetch-after-conflict behavior, final verification, and bounded retries to converge safely. Organizations already synchronized by lifecycle hooks should be counted as unchanged.

## Do not migrate historical billing implicitly

Legacy checkouts that used the Better Auth organization ID as `referenceId` are attached to personal Polar customers. Creating a team customer and member roster does not transfer historical subscriptions, orders, benefits, or seats.

The script must leave those billing objects untouched and report this limitation. Existing historical subscriptions remain queryable through the legacy `referenceId` metadata path. Any billing-object migration requires a separate plan and explicit Polar-supported APIs or support-assisted migration.

## Finish with an operator runbook

Before presenting the script as complete:

1. Show the user the discovered Better Auth schema and exact mapping.
2. Show how database credentials and Polar credentials are supplied locally.
3. Explain dry-run output and how extra Polar members are reported without deletion.
4. Recommend a database backup and a sandbox test using representative organizations.
5. Have the user review conflicts, missing owners, and extra members before production apply.
6. Explain how to rerun from the checkpoint and verify final counts.
7. Explain that organization synchronization may remain enabled throughout the run and how the script handles concurrent lifecycle updates.
