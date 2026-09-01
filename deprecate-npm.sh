#!/usr/bin/env bash
set -euo pipefail

DRY_RUN="${DRY_RUN:-1}"

LANDING_URL="https://github.com/polarsource/polar-adapters#readme"

KEPT=(nextjs better-auth tanstack-start nuxt adapter-utils)
SUNSET=(astro elysia express fastify hono remix supabase sveltekit)

run() {
  if [ "$DRY_RUN" = "0" ]; then
    "$@"
  else
    printf 'DRY RUN: %q ' "$@"; printf '\n'
  fi
}

echo "== Sunset packages (all versions) =="
for p in "${SUNSET[@]}"; do
  run npm deprecate "@polar-sh/$p" \
    "@polar-sh/$p is deprecated and no longer maintained. Migration: $LANDING_URL"
done

echo
echo "== Kept packages (<1.0.0 range only) =="
for p in "${KEPT[@]}"; do
  if ! npm view "@polar-sh/$p" versions --json 2>/dev/null | grep -q '"1\.'; then
    echo "SKIP @polar-sh/$p: no 1.x on npm yet — run again after the monorepo publishes 1.x." >&2
    continue
  fi
  run npm deprecate "@polar-sh/$p@<1.0.0" \
    "@polar-sh/$p 0.x is deprecated — upgrade to 1.x (no breaking changes)"
done

echo
if [ "$DRY_RUN" != "0" ]; then
  echo "Dry run only. Review the commands above, then re-run with DRY_RUN=0."
fi
