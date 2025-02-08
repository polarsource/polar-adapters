import { Polar } from "@polar-sh/sdk";
import { UsageEngine } from "./core";

export interface UsageMeterConfig {
  accessToken?: string;
  server?: "sandbox" | "production";
}

export interface UsageMeterContext<
  TUsage extends Record<string, number> = Record<string, number>,
  TRequest = unknown,
> {
  customerId: string;
  usage: TUsage;
  req: TRequest;
}

export class UsageMeter<
  TContext extends UsageMeterContext = UsageMeterContext,
> extends UsageEngine<TContext> {
  private polarClient: Polar;

  constructor(config?: UsageMeterConfig) {
    super();

    this.polarClient = new Polar({
      accessToken: config?.accessToken,
      server: config?.server,
    });
  }

  public async ingest({
    metadata,
    meter,
    customerId,
  }: {
    metadata: Record<string, number>;
    meter: string;
    customerId: string;
  }) {
    await this.polarClient.events.ingest({
      events: [
        {
          customerId,
          name: meter,
          metadata,
        },
      ],
    });
  }

  public meter(
    meter: string,
    transformer: (ctx: TContext) => Record<string, number>,
  ) {
    return this.pipe(async (ctx) => {
      await this.ingest({
        meter,
        metadata: transformer(ctx),
        customerId: ctx.customerId,
      });
    });
  }
}
