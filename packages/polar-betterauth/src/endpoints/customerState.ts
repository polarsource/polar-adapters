import { APIError, sessionMiddleware } from "better-auth/api";
import { createAuthEndpoint } from "better-auth/plugins";
import type { PolarOptions } from "../types";

export const customerState = (options: PolarOptions) =>
  createAuthEndpoint(
    "/state",
    {
      method: "GET",
      use: [sessionMiddleware],
    },
    async (ctx) => {
      if (!ctx.context.session.user.id) {
        throw new APIError("BAD_REQUEST", {
          message: "User not found",
        });
      }

      try {
        const state = await options.client.customers.getStateExternal({
          externalId: ctx.context.session?.user.id,
        });

        return ctx.json(state);
      } catch (e: unknown) {
        if (e instanceof Error) {
          ctx.context.logger.error(
            `Polar subscriptions list failed. Error: ${e.message}`,
          );
        }

        throw new APIError("INTERNAL_SERVER_ERROR", {
          message: "Subscriptions list failed",
        });
      }
    },
  );
