import { Polar } from "@polar-sh/sdk";
import type { FastifyReply, FastifyRequest, RouteHandler } from "fastify";
export interface CustomerPortalConfig {
  accessToken?: string;
  getCustomerId: (req: FastifyRequest) => Promise<string>;
  server?: "sandbox" | "production";
}

export const CustomerPortal = ({
  accessToken,
  server,
  getCustomerId,
}: CustomerPortalConfig): RouteHandler => {
  const polar = new Polar(
    /** biome-ignore lint/complexity/useLiteralKeys: fix ci */ {
      accessToken: accessToken ?? process.env["POLAR_ACCESS_TOKEN"],
      server,
    },
  );

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const customerId = await getCustomerId(request);

    if (!customerId) {
      return reply.status(400).send({ error: "customerId not defined" });
    }

    try {
      const result = await polar.customerSessions.create({
        customerId,
      });

      return reply.redirect(result.customerPortalUrl);
    } catch (error) {
      console.error(error);
      return reply.status(500).send({ error: "Internal server error" });
    }
  };
};
