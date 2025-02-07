import { UsageMeter, type UsageMeterContext } from "./meter";

type Handler<TRequest, TResponse> = (
	req: TRequest,
	res: TResponse,
) => Promise<TResponse>;

export interface PolarUsageConfig {
	accessToken?: string;
	server?: 'sandbox' | 'production';
}

type UsageStrategy<TRequest, TUsageContext, TStrategyClient> = (
	req: TRequest,
	meterHandler: (context: TUsageContext) => Promise<void>,
) => TStrategyClient;

export class PolarUsage<TRequest, TContext extends UsageMeterContext = UsageMeterContext, TStrategyClient = never> {
	private meter: UsageMeter;
	private getCustomerId?: (req: TRequest) => Promise<string> | string | undefined;
	private strategyHandler?: UsageStrategy<TRequest, TContext, TStrategyClient>;

	constructor(config?: PolarUsageConfig) {
		this.meter = new UsageMeter(config);
	}

	private createMeterHandler() {
		return async (context: TContext) => {
			await this.meter.run(context);
		};
	}

	public customer(callback: (req: TRequest) => Promise<string> | string) {
		this.getCustomerId = callback;

		return this;
	}

	public strategy<TStrategyContext extends UsageMeterContext, TNewStrategyClient>(
		handler: UsageStrategy<TRequest, TStrategyContext, TNewStrategyClient>,
	) {
		this.strategyHandler = handler as any;
		return this as unknown as PolarUsage<TRequest, TStrategyContext, TNewStrategyClient>;
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
				throw new Error('Strategy handler is not set');
			}

			const meterHandler = await this.createMeterHandler();
			const strategyClient = this.strategyHandler(req, meterHandler);

			return callback(req, res, strategyClient);
		};
	}
}

const Usage = <TRequest>() => {
	return new PolarUsage<TRequest>();
}





Usage<Request>()
	.customer((req) => req.headers.get('X-Polar-Customer-Id') ?? '')
	.strategy((req, meterHandler) => {
		console.log(req, meterHandler);

		return {haha: 123}
	})
	.handler((req, res, strategyClient) => {
		console.log(req, res, strategyClient);

		strategyClient.haha
		return new Response('ok')
	})
