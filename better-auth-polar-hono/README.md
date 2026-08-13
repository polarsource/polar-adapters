# Better Auth + Polar local playground

Throwaway Hono API for manually exercising the Better Auth organization integration against a locally running Polar API.

## Run

From this directory:

```bash
cp .env.example .env

pnpm install
pnpm migrate
pnpm dev
```

The API starts on <http://localhost:3002>. Open <http://localhost:3002/help> for the available operations and example request bodies.

The Polar SDK uses the token currently hardcoded in `auth.ts` and `POLAR_SERVER_URL` (default `http://127.0.0.1:8101`), so it does not call Polar Sandbox or production. This is the Docker-based local Polar API shown by `dev docker ports`; the separate process on port 8000 is not connected to its database.

## Calling it

Use a separate curl cookie jar for each user. For example:

```bash
curl -sS -c owner.cookies -b owner.cookies \
  -H 'content-type: application/json' \
  -d '{"name":"Owner","email":"owner@example.com","password":"password123"}' \
  http://localhost:3002/api/auth/sign-up/email | jq

curl -sS -c owner.cookies -b owner.cookies \
  -H 'content-type: application/json' \
  -d '{"name":"Acme","slug":"acme"}' \
  http://localhost:3002/api/auth/organization/create | jq
```

Copy the returned organization ID into requests shown by `/help`. Inspect the actual Polar customer/member mirror with:

```bash
curl -sS http://localhost:3002/debug/polar/organizations/ORG_ID | jq
```

For another user, use `member.cookies`. Invitations are not emailed; their IDs are printed in the server terminal.

Set `POLAR_PRODUCT_ID` if you want the `pro` checkout request from `/help` to work. Personal behavior can be compared by making the same Polar plugin requests without `organizationId`.

## Reset

Stop the server and remove the local files:

```bash
rm -f better-auth.sqlite *.cookies
pnpm migrate
```
