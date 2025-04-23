import { APIError, getSessionFromCtx } from "better-auth/api";
import { createAuthEndpoint } from "better-auth/plugins";
import { z } from "zod";
import type { PolarOptions } from "../types";

export const checkout = (options: PolarOptions) =>
	createAuthEndpoint(
		"/checkout",
		{
			method: "GET",
			query: z.object({
				products: z.union([z.array(z.string()), z.string()]),
			}),
		},
		async (ctx) => {
			if (!options.checkout?.enabled) {
				throw new APIError("BAD_REQUEST", {
					message: "Checkout is not enabled",
				});
			}

			const products = ctx.query.products;
			const session = await getSessionFromCtx(ctx);

			try {
				const checkout = await options.client.checkouts.create({
					customerExternalId: session?.user.id,
					products: Array.isArray(products) ? products : [products],
					successUrl: options.checkout.successUrl
						? new URL(options.checkout.successUrl, ctx.request?.url).toString()
						: undefined,
				});

				return ctx.redirect(checkout.url);
			} catch (e: unknown) {
				if (e instanceof Error) {
					ctx.context.logger.error(
						`Polar checkout creation failed. Error: ${e.message}`,
					);
				}

				throw new APIError("INTERNAL_SERVER_ERROR", {
					message: "Checkout creation failed",
				});
			}
		},
	);

export const checkoutWithSlug = (options: PolarOptions) =>
	createAuthEndpoint(
		"/checkout/:slug",
		{
			method: "GET",
			params: z.object({
				slug: z.string(),
			}),
		},
		async (ctx) => {
			if (!options.checkout?.enabled) {
				throw new APIError("BAD_REQUEST", {
					message: "Checkout is not enabled",
				});
			}

			const products = await (typeof options.checkout.products === "function"
				? options.checkout.products()
				: options.checkout.products);

			const productId = products.find(
				(product) => product.slug === ctx.params?.["slug"],
			)?.productId;

			if (!productId) {
				throw new APIError("BAD_REQUEST", {
					message: "Product Id not found",
				});
			}

			const session = await getSessionFromCtx(ctx);

			try {
				const checkout = await options.client.checkouts.create({
					customerExternalId: session?.user.id,
					products: [productId],
					successUrl: options.checkout.successUrl
						? new URL(options.checkout.successUrl, ctx.request?.url).toString()
						: undefined,
				});

				return ctx.redirect(checkout.url);
			} catch (e: unknown) {
				if (e instanceof Error) {
					ctx.context.logger.error(
						`Polar checkout creation failed. Error: ${e.message}`,
					);
				}

				throw new APIError("INTERNAL_SERVER_ERROR", {
					message: "Checkout creation failed",
				});
			}
		},
	);
