import { APIError, getSessionFromCtx } from "better-auth/api";
import { createAuthEndpoint } from "better-auth/plugins";
import { z } from "zod";
import type { PolarOptions } from "../types";

export const checkout = (options: PolarOptions) =>
	createAuthEndpoint(
		"/checkout",
		{
			method: "POST",
			body: z.object({
				products: z.union([z.array(z.string()), z.string()]).optional(),
				slug: z.string().optional(),
				referenceId: z.string().optional(),
			}),
		},
		async (ctx) => {
			if (!options.checkout?.enabled) {
				throw new APIError("BAD_REQUEST", {
					message: "Checkout is not enabled",
				});
			}

			const session = await getSessionFromCtx(ctx);

			let productIds: string[] = [];

			if (ctx.body.slug) {
				const resolvedProducts = await (typeof options.checkout.products ===
				"function"
					? options.checkout.products()
					: options.checkout.products);

				const productId = resolvedProducts.find(
					(product) => product.slug === ctx.body.slug,
				)?.productId;

				if (!productId) {
					throw new APIError("BAD_REQUEST", {
						message: "Product not found",
					});
				}

				productIds = [productId];
			} else {
				productIds = Array.isArray(ctx.body.products)
					? ctx.body.products.filter((id) => id !== undefined)
					: [ctx.body.products].filter((id) => id !== undefined);
			}

			if (options.checkout.authenticatedUsersOnly && !session?.user.id) {
				throw new APIError("UNAUTHORIZED", {
					message: "You must be logged in to checkout",
				});
			}

			try {
				const checkout = await options.client.checkouts.create({
					customerExternalId: session?.user.id,
					products: productIds,
					successUrl: options.checkout.successUrl
						? new URL(options.checkout.successUrl, ctx.request?.url).toString()
						: undefined,
					metadata: ctx.body.referenceId
						? {
								referenceId: ctx.body.referenceId,
							}
						: undefined,
				});

				return ctx.json({
					url: checkout.url,
					redirect: true,
				});
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
