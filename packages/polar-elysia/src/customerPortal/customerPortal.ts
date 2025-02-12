import { Polar } from "@polar-sh/sdk";
import type { Context } from "elysia";
import type { InlineHandler } from "elysia/types";

export interface CustomerPortalConfig {
  accessToken?: string;
  getCustomerId: (req: Request) => Promise<string>;
  server?: "sandbox" | "production";
}

export const CustomerPortal = ({
  accessToken,
  server,
  getCustomerId,
}: CustomerPortalConfig): InlineHandler => {
  const polar = new Polar(
    /** biome-ignore lint/complexity/useLiteralKeys: fix ci */ {
      accessToken: accessToken ?? process.env["POLAR_ACCESS_TOKEN"],
      server,
    },
  );

  return async (ctx: Context) => {
    const customerId = await getCustomerId(ctx.request);

    if (!customerId) {
      return ctx.error(400, { error: "customerId not defined" });
    }

    try {
      const result = await polar.customerSessions.create({
        customerId,
      });

      return ctx.redirect(result.customerPortalUrl);
    } catch (error) {
      console.error(error);
      return ctx.error(500, { error: "Internal server error" });
    }
  };
};
