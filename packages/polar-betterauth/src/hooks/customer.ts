import type { GenericEndpointContext, User } from "better-auth";
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

        const { result: existingCustomers } =
          await options.client.customers.list({ email: user.email });
        const existingCustomer = existingCustomers.items[0];

        if (existingCustomer) {
          if (existingCustomer.externalId !== user.id) {
            await options.client.customers.update({
              id: existingCustomer.id,
              customerUpdate: {
                externalId: user.id,
              },
            });
          }
        } else {
          await options.client.customers.create({
            ...params,
            email: user.email,
            name: user.name,
            externalId: user.id,
          });
        }
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
