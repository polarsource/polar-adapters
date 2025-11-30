import { z } from "zod";

export const CheckoutParams = z.object({
	products: z.union([z.array(z.string()), z.string()]).optional(),
	slug: z.string().optional(),
	referenceId: z.string().optional(),
	customFieldData: z
		.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
		.optional(),
	metadata: z
		.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
		.optional(),
	allowDiscountCodes: z.coerce.boolean().optional(),
	discountId: z.string().optional(),
	redirect: z.coerce.boolean().optional(),
	embedOrigin: z.string().url().optional(),
});

export type CheckoutParams = z.infer<typeof CheckoutParams>;
