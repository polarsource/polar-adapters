import { UsageMeter, UsageMeterConfig, type UsageMeterContext } from "./meter";

export * from "./meter";

type Handler<TRequest, TResponse> = (
  req: TRequest,
  res: TResponse,
) => Promise<TResponse>;

export type UsageStrategy<TRequest, TUsageContext, TStrategyClient> = (
  req: TRequest,
  meterHandler: (context: TUsageContext) => Promise<void>,
  getCustomerId: (req: TRequest) => Promise<string> | string | undefined,
) => TStrategyClient;

export class Usage<
  TRequest,
  TResponse,
  TContext extends UsageMeterContext = UsageMeterContext,
  TStrategyClient = never,
> {
  private usageMeter: UsageMeter<TContext>;
  private getCustomerId?: (
    req: TRequest,
  ) => Promise<string> | string | undefined;
  private strategyHandler?: UsageStrategy<TRequest, TContext, TStrategyClient>;

  constructor(config?: UsageMeterConfig) {
    this.usageMeter = new UsageMeter(config);
  }

  private createMeterHandler() {
    return async (context: TContext) => {
      await this.usageMeter.run(context);
    };
  }

  public customer(callback: (req: TRequest) => Promise<string> | string) {
    this.getCustomerId = callback;

    return this;
  }

  public strategy<
    TStrategyContext extends UsageMeterContext,
    TNewStrategyClient,
  >(handler: UsageStrategy<TRequest, TStrategyContext, TNewStrategyClient>) {
    this.strategyHandler = handler as any;
    return this as unknown as Usage<
      TRequest,
      TResponse,
      TStrategyContext,
      TNewStrategyClient
    >;
  }

  public meter(
    meter: string,
    transformer: (ctx: TContext) => Record<string, number>,
  ) {
    this.usageMeter.meter(meter, transformer);

    return this;
  }

  public handler<TResponse>(
    callback: (
      req: TRequest,
      res: TResponse,
      strategyClient: TStrategyClient,
    ) => Promise<TResponse> | TResponse,
  ): Handler<TRequest, TResponse> {
    return async (req: TRequest, res: TResponse) => {
      if (!this.strategyHandler) {
        throw new Error("Strategy handler is not set");
      }

      if (!this.getCustomerId) {
        throw new Error("Customer ID resolver is not set");
      }

      const meterHandler = this.createMeterHandler();
      const strategyClient = this.strategyHandler(
        req,
        meterHandler,
        this.getCustomerId,
      );

      return callback(req, res, strategyClient);
    };
  }
}
