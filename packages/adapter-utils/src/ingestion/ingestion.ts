import type { Polar } from "@polar-sh/sdk";

export type IngestionContext = Record<string, number | string | boolean> & {
	customerId: string;
};

type Transformer<TContext extends IngestionContext> = (
	ctx: TContext,
) => Promise<void>;

export class Ingestion<TContext extends IngestionContext> {
	private polarClient: Polar;
	private transformers: Transformer<TContext>[] = [];

	constructor(polar: Polar) {
		this.polarClient = polar;
	}

	private pipe(transformer: Transformer<TContext>) {
		this.transformers.push(transformer);

		return this;
	}

	public async execute(ctx: TContext) {
		await Promise.all(this.transformers.map((transformer) => transformer(ctx)));
	}

	public schedule(
		meter: string,
		transformer: (ctx: TContext) => Record<string, number | string | boolean>,
	) {
		return this.pipe(async (ctx) => {
			await this.polarClient.events.ingest({
				events: [
					{
						customerId: ctx.customerId,
						name: meter,
						metadata: transformer(ctx),
					},
				],
			});
		});
	}
}
