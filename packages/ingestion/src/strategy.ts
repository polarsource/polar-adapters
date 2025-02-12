import { Ingestion, type IngestionContext } from "./ingestion";

export type IngestionExecutionHandler<TUsageContext extends IngestionContext> =
  (ctx: TUsageContext) => Promise<void>;

export abstract class IngestionStrategy<
  TUsageContext extends IngestionContext,
  TStrategyClient,
> extends Ingestion<TUsageContext> {
  public createExecutionHandler(): IngestionExecutionHandler<TUsageContext> {
    return async (context: TUsageContext) => {
      await this.execute(context);
    };
  }

  public ingest(
    eventName: string,
    metadataResolver: (
      ctx: TUsageContext,
    ) => Record<string, number | string | boolean>,
  ) {
    this.schedule(eventName, metadataResolver);

    return this;
  }

  public abstract client(customerId: string): TStrategyClient;
}
