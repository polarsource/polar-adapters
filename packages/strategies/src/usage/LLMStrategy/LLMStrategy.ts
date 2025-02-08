import type {
  LanguageModelV1,
  LanguageModelV1CallOptions,
  LanguageModelV1StreamPart,
} from "@ai-sdk/provider";
import type { UsageStrategy, UsageMeterContext } from "@polar-sh/adapter-utils";
import { wrapLanguageModel, type LanguageModelV1Middleware } from "ai";

type LLMStrategyContext = UsageMeterContext<{
  promptTokens: number;
  completionTokens: number;
}>;

export const LLMStrategy = <TRequest>(
  model: LanguageModelV1,
): UsageStrategy<TRequest, LLMStrategyContext, LanguageModelV1> => {
  const middleware = (
    req: TRequest,
    meter: (context: LLMStrategyContext) => Promise<void>,
    getCustomerId: (req: TRequest) => Promise<string> | string | undefined,
  ): LanguageModelV1Middleware => {
    const wrapGenerate = async (options: {
      doGenerate: () => ReturnType<LanguageModelV1["doGenerate"]>;
      params: LanguageModelV1CallOptions;
      model: LanguageModelV1;
    }): Promise<Awaited<ReturnType<LanguageModelV1["doGenerate"]>>> => {
      const result = await options.doGenerate();

      await meter({
        usage: result.usage,
        customerId: (await getCustomerId?.(req)) ?? "",
        req,
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
              usage: chunk.usage,
              customerId: (await getCustomerId?.(req)) ?? "",
              req,
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
  };

  return (req, meterHandler, getCustomerId) => {
    const wrappedModel = wrapLanguageModel({
      model,
      middleware: middleware(req, meterHandler, getCustomerId),
    });

    return wrappedModel;
  };
};
