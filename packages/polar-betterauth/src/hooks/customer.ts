import type { GenericEndpointContext, User } from "better-auth";
import { APIError } from "better-auth/api";
import type { PolarOptions } from "../types";

export const onUserCreate =
  (options: PolarOptions) =>
  async (user: User, ctx?: GenericEndpointContext) => {
    if (ctx && options.createCustomerOnSignUp) {
      try {
        const params =
          options.getCustomerCreateParams && ctx.context.session
            ? await options.getCustomerCreateParams({
                user,
                session: ctx.context.session.session,
              })
            : {};

        await options.client.customers.create({
          ...params,
          email: user.email,
          name: user.name,
          externalId: user.id,
        });
      } catch (e: unknown) {
        if (e instanceof Error) {
          ctx.context.logger.error(
            `Polar customer creation failed. Error: ${e.message}`,
          );
        } else {
          ctx.context.logger.error(
            `Polar customer creation failed. Error: ${e}`,
          );
        }

        throw new APIError("BAD_REQUEST", {
          message:
            "Polar customer creation failed. See server logs for more information.",
        });
      }
    }
  };

export const onUserUpdate =
  (options: PolarOptions) =>
  async (user: User, ctx?: GenericEndpointContext) => {
    if (ctx && options.createCustomerOnSignUp) {
      try {
        await options.client.customers.updateExternal({
          externalId: user.id,
          customerUpdate: {
            email: user.email,
            name: user.name,
          },
        });
      } catch (e: unknown) {
        if (e instanceof Error) {
          ctx.context.logger.error(
            `Polar customer update failed. Error: ${e.message}`,
          );
        } else {
          ctx.context.logger.error(`Polar customer update failed. Error: ${e}`);
        }
      }
    }
  };
