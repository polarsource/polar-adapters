> [!IMPORTANT]
> **This repository is closed and most adapters are deprecated.**
>
> We continue to support the following adapters in [our monorepo](https://github.com/polarsource/polar):
>
> - Next.js
> - Nuxt
> - TanStack Start
> - Better Auth
>
> For more information, see the [adapters documentation](https://polar.sh/docs/integrate/sdk/adapters/introduction).
>
> For other frameworks, we now recommend integrating the [Polar SDK](https://polar.sh/docs/integrate/sdk) directly, which your coding agent can set up for you.

# Polar Adapters

This repository hosts a wide array of Polar adapters for your TypeScript framework. Our Adapters are built to make it as easy as possible to integrate Polar in your application.

### Adapters

- [BetterAuth](./packages/polar-betterauth)
- [Supabase](./packages/polar-supabase/)
- [Deno](./packages//polar-deno/)
- [Astro](./packages/polar-astro)
- [Elysia](./packages/polar-elysia)
- [Express](./packages/polar-express)
- [Fastify](./packages/polar-fastify)
- [Hono](./packages/polar-hono)
- [Next.js](./packages/polar-nextjs)
- [Nuxt](./packages/polar-nuxt)
- [Remix](./packages/polar-remix)
- [Sveltekit](./packages/polar-sveltekit)
- [TanStack Start](./packages/polar-tanstack-start)


### Deploying Adapters

1. To deploy the adapters, you need to create a new changeset. You can do this by running and follow the instructions in the terminal:

```bash
npx @changesets/cli
```

2. After you have created the changeset, you should create a pull request to the main branch. 
3. Once the pull request is merged, a new pull request will be created that will bump the version of the adapters.
4. Merge it to the main branch and the adapters will be published to npm.


> [!WARNING]  
> Deno package is published to JSR registry, not npm. At the moment this is done manually.
