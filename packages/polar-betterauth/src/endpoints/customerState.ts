import { APIError, sessionMiddleware } from "better-auth/api";
import { createAuthEndpoint } from "better-auth/plugins";
import type { PolarOptions } from "../types";

export const customerState = (options: PolarOptions) =>
