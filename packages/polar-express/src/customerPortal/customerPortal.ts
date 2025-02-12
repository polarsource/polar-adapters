import { Polar } from "@polar-sh/sdk";
import type { Request, Response } from "express";

export interface CustomerPortalConfig {
  accessToken?: string;
  getCustomerId: (req: Request) => Promise<string>;
  server?: "sandbox" | "production";
}

export const CustomerPortal = ({
  accessToken,
  server,
  getCustomerId,
}: CustomerPortalConfig) => {
  const polar = new Polar(
    /** biome-ignore lint/complexity/useLiteralKeys: fix ci */ {
      accessToken: accessToken ?? process.env["POLAR_ACCESS_TOKEN"],
      server,
    },
  );

  return async (req: Request, res: Response) => {
    const customerId = await getCustomerId(req);

    if (!customerId) {
      res.status(400).json({ error: "customerId not defined" });
      return;
    }

    try {
      const result = await polar.customerSessions.create({
        customerId,
      });

      res.redirect(result.customerPortalUrl);
      return;
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Internal server error" });
      return;
    }
  };
};
