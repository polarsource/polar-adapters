# Polar Adapters (deprecated)

> [!IMPORTANT]
> **This repository has been deprecated**. No further releases will be
> made from it. Find your package in the table below.

Polar's actively maintained framework adapters now live in the
[main Polar monorepo](https://github.com/polarsource/polar) and ship as `1.x`
against the Polar SDK 1.0. The remaining adapters are sunset and no longer
maintained.

## Package status

| Package | Status | What to do |
| --- | --- | --- |
| `@polar-sh/nextjs` | ➡️ Moved to [polarsource/polar](https://github.com/polarsource/polar/tree/main/clients/packages/adapters) | [Upgrade to 1.x](#upgrading-a-kept-adapter) |
| `@polar-sh/better-auth` | ➡️ Moved to [polarsource/polar](https://github.com/polarsource/polar/tree/main/clients/packages/adapters) | [Upgrade to 1.x](#upgrading-a-kept-adapter) |
| `@polar-sh/tanstack-start` | ➡️ Moved to [polarsource/polar](https://github.com/polarsource/polar/tree/main/clients/packages/adapters) | [Upgrade to 1.x](#upgrading-a-kept-adapter) |
| `@polar-sh/nuxt` | ➡️ Moved to [polarsource/polar](https://github.com/polarsource/polar/tree/main/clients/packages/adapters) | [Upgrade to 1.x](#upgrading-a-kept-adapter) |
| `@polar-sh/adapter-utils` | ➡️ Moved to [polarsource/polar](https://github.com/polarsource/polar/tree/main/clients/packages/adapters) | [Upgrade to 1.x](#upgrading-a-kept-adapter) |
| `@polar-sh/hono` | 🪦 Sunset | [Migrate to the SDK](#migrating-off-a-sunset-adapter) |
| `@polar-sh/sveltekit` | 🪦 Sunset | [Migrate to the SDK](#migrating-off-a-sunset-adapter) |
| `@polar-sh/astro` | 🪦 Sunset | [Migrate to the SDK](#migrating-off-a-sunset-adapter) |
| `@polar-sh/remix` | 🪦 Sunset | [Migrate to the SDK](#migrating-off-a-sunset-adapter) |
| `@polar-sh/elysia` | 🪦 Sunset | [Migrate to the SDK](#migrating-off-a-sunset-adapter) |
| `@polar-sh/express` | 🪦 Sunset | [Migrate to the SDK](#migrating-off-a-sunset-adapter) |
| `@polar-sh/fastify` | 🪦 Sunset | [Migrate to the SDK](#migrating-off-a-sunset-adapter) |
| `@polar-sh/supabase` | 🪦 Sunset | [Migrate to the SDK](#migrating-off-a-sunset-adapter) |
| `@polar-sh/deno` (JSR) | 🪦 Sunset | [Migrate to the SDK](#migrating-off-a-sunset-adapter) |

`npm install` will show a deprecation notice pointing back here.

## Upgrading a non deprecated adapter

```bash
# Next.JS
npm install @polar-sh/nextjs@^1
# Better Auth
npm install @polar-sh/better-auth@^1
# TanStack
npm install @polar-sh/tanstack-start@^1
# Nuxt
npm install @polar-sh/nuxt@^1
# Adapter utils
npm install @polar-sh/adapter-utils@^1
```

## Migrating off a sunset adapter

The sunset adapters were thin wrappers around
[`@polar-sh/sdk`](https://www.npmjs.com/package/@polar-sh/sdk), which you keep.
Migrate with the
[**`polar-integration` skill**](https://github.com/polarsource/skills/tree/main/skills/polar-integration), it covers SDK-direct integration in any framework and includes a
[migration mapping](https://github.com/polarsource/skills/blob/main/skills/polar-integration/references/adapter-migration.md)
from the old adapter API.

### Agent skill

Our integration skill will handle the migration for you:

```bash
npx skills add https://github.com/polarsource/skills --skill polar-integration
```

### Agent prompt

You can also paste this prompt into the LLM of your choice:

> Read <https://raw.githubusercontent.com/polarsource/skills/main/skills/polar-integration/SKILL.md>
> and <https://raw.githubusercontent.com/polarsource/skills/main/skills/polar-integration/references/adapter-migration.md>.
> This project uses a deprecated `@polar-sh/*` adapter. Migrate it to the
> SDK-direct recipes, preserving current behavior.
