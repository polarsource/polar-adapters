import type { Polar } from "@polar-sh/sdk";
import {
	IngestionStrategy,
	type IngestionExecutionHandler,
} from "../../strategy";
import type { IngestionContext } from "../../ingestion";

type Fetch = typeof fetch;

const wrapFetch = (
	httpClient: Fetch,
	execute: IngestionExecutionHandler<FetchStrategyContext>,
	customerId: string,
): Fetch => {
	return async (input, init) => {
		const response = await httpClient(input, init);

		const url =
			typeof input === "string"
				? input
				: "url" in input
					? input.url
					: input.toString();

		execute({
			url,
			method: init?.method ?? "GET",
			customerId,
		});

		return response;
	};
};

type FetchStrategyContext = IngestionContext<{
	url: string;
	method: string;
}>;

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
		const executionHandler = this.createExecutionHandler();

		return wrapFetch(this.fetchClient, executionHandler, customerId);
	}
}
