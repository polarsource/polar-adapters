import { APIError, sessionMiddleware } from "better-auth/api";
import { createAuthEndpoint } from "better-auth/plugins";
import type { PolarOptions } from "../types";
import { z } from "zod";

export const orders = (options: PolarOptions) =>
	