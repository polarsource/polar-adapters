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

		const method = init?.method ?? "GET";

		const encoder = new TextEncoder();
		const bytes = encoder.encode(init?.body?.toString() ?? "").length;

		execute({
			url,
			method,
			bytes,
			customerId,
		});

		return response;
	};
};

type FetchStrategyContext = IngestionContext<{
	// Request URL
	url: string;
	// Request method
	method: string;
	// Bytes sent in the request
	bytes: number;
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
