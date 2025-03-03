import type { PolarOptions } from "./types";

export async function getPlans(options: PolarOptions) {
	return typeof options?.subscription?.plans === "function"
		? await options.subscription?.plans()
		: options.subscription?.plans;
}

export async function getPlanByPriceId(options: PolarOptions, priceId: string) {
	return await getPlans(options).then((res) =>
		res?.find((plan) => plan.priceId === priceId),
	);
}

export async function getPlanByName(options: PolarOptions, name: string) {
	return await getPlans(options).then((res) =>
		res?.find((plan) => plan.name.toLowerCase() === name.toLowerCase()),
	);
}
