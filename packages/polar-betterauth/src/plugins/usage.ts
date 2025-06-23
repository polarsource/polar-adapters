import type { Polar } from "@polar-sh/sdk";
import {
  APIError,
  createAuthEndpoint,
  sessionMiddleware,
} from "better-auth/api";
import { z } from "zod";
import type { Product } from "../types";

export interface UsageOptions {
  /**
   * Products to use for topping up credits
   */
  creditProducts?: Product[] | (() => Promise<Product[]>);
}

export const usage = (_usageOptions?: UsageOptions) => (polar: Polar) => {
  return {
    meters: createAuthEndpoint(
      "/usage/meters/list",
      {
        method: "GET",
        use: [sessionMiddleware],
        query: z.object({
          page: z.coerce.number().optional(),
          limit: z.coerce.number().optional(),
        }),
      },
      async (ctx) => {
        if (!ctx.context.session.user.id) {
          throw new APIError("BAD_REQUEST", {
            message: "User not found",
          });
        }

        try {
          const customerSession = await polar.customerSessions.create({
            externalCustomerId: ctx.context.session.user.id,
          });

          const customerMeters = await polar.customerPortal.customerMeters.list(
            { customerSession: customerSession.token },
            {
              page: ctx.query?.page,
              limit: ctx.query?.limit,
            },
          );

          return ctx.json(customerMeters);
        } catch (e: unknown) {
          if (e instanceof Error) {
            ctx.context.logger.error(
              `Polar meters list failed. Error: ${e.message}`,
            );
          }

          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Meters list failed",
          });
        }
      },
    ),
    ingestion: createAuthEndpoint(
      "/usage/ingest",
      {
        method: "POST",
        body: z.object({
          event: z.string(),
          metadata: z.record(
            z.string(),
            z.union([z.string(), z.number(), z.boolean()]),
          ),
        }),
        use: [sessionMiddleware],
      },
      async (ctx) => {
        if (!ctx.context.session.user.id) {
          throw new APIError("BAD_REQUEST", {
            message: "User not found",
          });
        }

        try {
          const ingestion = await polar.events.ingest({
            events: [
              {
                name: ctx.body.event,
                metadata: ctx.body.metadata,
                externalCustomerId: ctx.context.session.user.id,
              },
            ],
          });

          return ctx.json(ingestion);
        } catch (e: unknown) {
          if (e instanceof Error) {
            ctx.context.logger.error(
              `Polar ingestion failed. Error: ${e.message}`,
            );
          }

          throw new APIError("INTERNAL_SERVER_ERROR", {
            message: "Ingestion failed",
          });
        }
      },
    ),
  };
};
