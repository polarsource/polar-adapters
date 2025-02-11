import { Ingestion, type IngestionContext } from "./ingestion";

export abstract class IngestionStrategy<
	TUsageContext extends IngestionContext,
	TStrategyClient,
> extends Ingestion<TUsageContext> {
	public createMeterHandler() {
		return async (context: TUsageContext) => {
			await this.execute(context);
		};
	}

	public ingest(
		eventName: string,
		metadataResolver: (ctx: TUsageContext) => Record<string, number>,
	) {
		this.schedule(eventName, metadataResolver);

		return this;
	}

	public abstract client(customerId: string): TStrategyClient;
}
