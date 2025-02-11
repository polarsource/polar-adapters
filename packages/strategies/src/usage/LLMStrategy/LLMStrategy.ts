import type {
	LanguageModelV1,
	LanguageModelV1CallOptions,
	LanguageModelV1StreamPart,
} from "@ai-sdk/provider";
import {
	IngestionStrategy,
	type IngestionContext,
} from "@polar-sh/adapter-utils";
import { wrapLanguageModel, type LanguageModelV1Middleware } from "ai";
import type { Polar } from "@polar-sh/sdk";

type LLMStrategyContext = IngestionContext & {
	promptTokens: number;
	completionTokens: number;
};

export class LLMStrategy extends IngestionStrategy<
	LLMStrategyContext,
	LanguageModelV1
> {
	private model: LanguageModelV1;

	constructor(model: LanguageModelV1, polar: Polar) {
		super(polar);

		this.model = model;
	}

	private middleware(
		meter: (context: LLMStrategyContext) => Promise<void>,
		customerId: string,
	): LanguageModelV1Middleware {
		const wrapGenerate = async (options: {
			doGenerate: () => ReturnType<LanguageModelV1["doGenerate"]>;
			params: LanguageModelV1CallOptions;
			model: LanguageModelV1;
		}): Promise<Awaited<ReturnType<LanguageModelV1["doGenerate"]>>> => {
			const result = await options.doGenerate();

			await meter({
				...result.usage,
				customerId,
			});

			return result;
		};

		const wrapStream = async ({
			doStream,
		}: {
			doStream: () => ReturnType<LanguageModelV1["doStream"]>;
			params: LanguageModelV1CallOptions;
			model: LanguageModelV1;
		}) => {
			const { stream, ...rest } = await doStream();

			const transformStream = new TransformStream<
				LanguageModelV1StreamPart,
				LanguageModelV1StreamPart
			>({
				transform: async (chunk, controller) => {
					if (chunk.type === "finish") {
						await meter({
							...chunk.usage,
							customerId,
						});
					}

					controller.enqueue(chunk);
				},
			});

			return {
				stream: stream.pipeThrough(transformStream),
				...rest,
			};
		};

		return {
			wrapGenerate,
			wrapStream,
		};
	}

	override client(customerId: string): LanguageModelV1 {
		const meterHandler = this.createMeterHandler();

		return wrapLanguageModel({
			model: this.model,
			middleware: this.middleware(meterHandler, customerId),
		});
	}
}
