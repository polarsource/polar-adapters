import { describe, it, expect, vi, beforeEach } from "vitest";
import { CustomerPortal } from "./customerPortal.js";
import type { RawRequest, RawResponse } from "encore.dev/api";

vi.mock("@polar-sh/sdk", () => ({
  Polar: vi.fn().mockImplementation(() => ({
    customerSessions: {
      create: vi.fn().mockResolvedValue({
        customerPortalUrl: "https://portal.polar.sh/test",
      }),
    },
  })),
}));

describe("CustomerPortal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return 400 if getCustomerId returns empty string", async () => {
    const getCustomerId = vi.fn().mockResolvedValue("");

    const portal = CustomerPortal({
      accessToken: "test-token",
      getCustomerId,
      server: "sandbox",
    });

    const req = {
      headers: {
        host: "localhost",
      },
      url: "/portal",
    } as RawRequest;

    const resp = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as RawResponse;

    await portal(req, resp);

    expect(resp.writeHead).toHaveBeenCalledWith(400, {
      "Content-Type": "application/json",
    });
    expect(resp.end).toHaveBeenCalledWith(
      JSON.stringify({ error: "customerId not defined" }),
    );
  });

  it("should redirect to customer portal when customerId is valid", async () => {
    const getCustomerId = vi.fn().mockResolvedValue("cust-123");

    const portal = CustomerPortal({
      accessToken: "test-token",
      getCustomerId,
      server: "sandbox",
    });

    const req = {
      headers: {
        host: "localhost",
      },
      url: "/portal",
    } as RawRequest;

    const resp = {
      writeHead: vi.fn(),
      end: vi.fn(),
    } as unknown as RawResponse;

    await portal(req, resp);

    expect(getCustomerId).toHaveBeenCalledWith(req);
    expect(resp.writeHead).toHaveBeenCalledWith(302, {
      Location: expect.stringContaining("https://portal.polar.sh/test"),
    });
    expect(resp.end).toHaveBeenCalled();
  });

  it("should create portal handler with returnUrl", () => {
    const getCustomerId = vi.fn().mockResolvedValue("cust-123");

    const portal = CustomerPortal({
      accessToken: "test-token",
      getCustomerId,
      returnUrl: "https://example.com/dashboard",
      server: "sandbox",
    });

    expect(portal).toBeDefined();
    expect(typeof portal).toBe("function");
  });

  it("should create portal handler using environment variable for accessToken", () => {
    const getCustomerId = vi.fn().mockResolvedValue("cust-123");
    process.env.POLAR_ACCESS_TOKEN = "env-token";

    const portal = CustomerPortal({
      getCustomerId,
      server: "sandbox",
    });

    expect(portal).toBeDefined();
    expect(typeof portal).toBe("function");

    delete process.env.POLAR_ACCESS_TOKEN;
  });
});

