import type { Polar } from "@polar-sh/sdk";
import { APIError, getSessionFromCtx } from "better-auth/api";
import { createAuthEndpoint } from "better-auth/plugins";
import { CheckoutParams } from "../shared-types";
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
	 * Checkout Return URL
	 */
	returnUrl?: string;
	/**
	 * Only allow authenticated customers to checkout
	 */
	authenticatedUsersOnly?: boolean;
	/**
	 * Checkout theme
	 */
	theme?: "light" | "dark";
	/**
	 * Redirect to checkout page
	 */
	redirect?: boolean;
}

export const checkout =
	(checkoutOptions: CheckoutOptions = {}) =>
	(polar: Polar) => {
		return {
			checkout: createAuthEndpoint(
				"/checkout",
				{
					method: "POST",
					body: CheckoutParams,
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
								? new URL(
										checkoutOptions.successUrl,
										ctx.request?.url ?? ctx.context.baseURL,
									).toString()
								: undefined,
							metadata: ctx.body.referenceId
								? {
										referenceId: ctx.body.referenceId,
										...ctx.body.metadata,
									}
								: ctx.body.metadata,
							customFieldData: ctx.body.customFieldData,
							allowDiscountCodes: ctx.body.allowDiscountCodes ?? true,
							discountId: ctx.body.discountId,
							embedOrigin: ctx.body.embedOrigin,
							returnUrl: checkoutOptions.returnUrl
								? new URL(
										checkoutOptions.returnUrl,
										ctx.request?.url ?? ctx.context.baseURL,
									).toString()
								: undefined,
						});

						const redirectUrl = new URL(checkout.url);

						if (checkoutOptions.theme) {
							redirectUrl.searchParams.set("theme", checkoutOptions.theme);
						}

						return ctx.json({
							url: redirectUrl.toString(),
							redirect: ctx.body.redirect ?? true,
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
