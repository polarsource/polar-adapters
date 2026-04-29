import { Polar } from "@polar-sh/sdk";
import type { RawRequest, RawResponse } from "encore.dev/api";

export interface CustomerPortalConfig {
  accessToken?: string;
  getCustomerId: (req: RawRequest) => Promise<string>;
  server?: "sandbox" | "production";
  returnUrl?: string;
}

export const CustomerPortal = ({
  accessToken,
  server,
  getCustomerId,
  returnUrl,
}: CustomerPortalConfig) => {
  const polar = new Polar({
    accessToken,
    server,
  });

  return async (req: RawRequest, resp: RawResponse) => {
    const retUrl = returnUrl ? new URL(returnUrl) : undefined;

    const customerId = await getCustomerId(req);

    if (!customerId) {
      resp.writeHead(400, { "Content-Type": "application/json" });
      resp.end(JSON.stringify({ error: "customerId not defined" }));
      return;
    }

    try {
      const result = await polar.customerSessions.create({
        customerId,
        returnUrl: retUrl ? decodeURI(retUrl.toString()) : undefined,
      });

      resp.writeHead(302, { Location: result.customerPortalUrl });
      resp.end();
    } catch (error) {
      console.error(error);
      resp.writeHead(500, { "Content-Type": "application/json" });
      resp.end(JSON.stringify({ error: "Internal server error" }));
    }
  };
};

