import {
	type IngestionContext,
	IngestionStrategy,
} from "@polar-sh/adapter-utils";
import type { Polar } from "@polar-sh/sdk";

type Fetch = typeof fetch;

const wrapFetch = (
	httpClient: Fetch,
	meterHandler: (context: FetchStrategyContext) => Promise<void>,
	customerId: string,
): Fetch => {
	return async (input, init) => {
		const response = await httpClient(input, init);

		meterHandler({
			requests: 1,
			customerId,
		});

		return response;
	};
};

type FetchStrategyContext = IngestionContext & {
	requests: number;
};

export class FetchStrategy extends IngestionStrategy<
	FetchStrategyContext,
	Fetch
> {
	private fetchClient: Fetch;

	constructor(fetchClient: Fetch, polar: Polar) {
		super(polar);

		this.fetchClient = fetchClient;
	}

	override client(customerId: string): Fetch {
		const meterHandler = this.createMeterHandler();

		return wrapFetch(this.fetchClient, meterHandler, customerId);
	}
}
