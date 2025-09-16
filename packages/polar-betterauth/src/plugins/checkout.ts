import type { Polar } from "@polar-sh/sdk";
import { APIError, getSessionFromCtx } from "better-auth/api";
import { createAuthEndpoint } from "better-auth/plugins";
import { z } from "zod";
import type { Product } from "../types";

export interface CheckoutOptions {
	/**
	 * Optional list of slug -> productId mappings for easy slug checkouts
	 */
	products?: Product[] | (() => Promise<Product[]>);
	/**
	 * Checkout Success URL
	 */
	successUrl?: string;
	/**
	 * Only allow authenticated customers to checkout
	 */
	authenticatedUsersOnly?: boolean;
	/**
	 * Checkout theme
	 */
	theme?: "light" | "dark";
	/**
	 * Allow discount codes
	 */
	allowDiscountCodes?: boolean;
	/**
	 * Discount ID
	 */
	discountId?: string;
}

export const checkout =
	(checkoutOptions: CheckoutOptions = {}) =>
	(polar: Polar) => {
		return {
			checkout: createAuthEndpoint(
				"/checkout",
				{
					method: "POST",
					body: z.object({
						products: z.union([z.array(z.string()), z.string()]).optional(),
						slug: z.string().optional(),
						referenceId: z.string().optional(),
						customFieldData: z
							.record(
								z.string(),
								z.union([z.string(), z.number(), z.boolean()]),
							)
							.optional(),
						metadata: z
							.record(
								z.string(),
								z.union([z.string(), z.number(), z.boolean()]),
							)
							.optional(),
						allowDiscountCodes: z.coerce.boolean().optional().default(true),
						discountId: z.string().optional(),
						redirect: z.coerce.boolean().optional().default(true),
						successQueryParams: z.record(z.string(), z.string()).optional(),
					}),
				},
				async (ctx) => {
					const session = await getSessionFromCtx(ctx);

					let productIds: string[] = [];

					if (ctx.body.slug) {
						const resolvedProducts = await (typeof checkoutOptions.products ===
						"function"
							? checkoutOptions.products()
							: checkoutOptions.products);

						const productId = resolvedProducts?.find(
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

					if (checkoutOptions.authenticatedUsersOnly && !session?.user.id) {
						throw new APIError("UNAUTHORIZED", {
							message: "You must be logged in to checkout",
						});
					}

					try {
						const checkout = await polar.checkouts.create({
							externalCustomerId: session?.user.id,
							products: productIds,
							successUrl: checkoutOptions.successUrl
							? (() => {
									const url = new URL(
										checkoutOptions.successUrl,
										ctx.request?.url
									);
									if (ctx.body.successQueryParams) {
										Object.entries(ctx.body.successQueryParams).forEach(([key, value]) => {
											url.searchParams.set(key, value);
										});
									}
									return url.toString();
								})()
							: undefined,
							metadata: ctx.body.referenceId
								? {
										referenceId: ctx.body.referenceId,
										...ctx.body.metadata,
									}
								: ctx.body.metadata,
							customFieldData: ctx.body.customFieldData,
							allowDiscountCodes: ctx.body.allowDiscountCodes ?? true,
							discountId: ctx.body.discountId
						});

						const redirectUrl = new URL(checkout.url);

						if (checkoutOptions.theme) {
							redirectUrl.searchParams.set("theme", checkoutOptions.theme);
						}

						return ctx.json({
							url: redirectUrl.toString(),
							redirect: ctx.body?.redirect ?? true,
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
			),
		};
	};
