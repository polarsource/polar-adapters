import type { S3Client } from "@aws-sdk/client-s3";
import {
  type IngestionContext,
  type IngestionExecutionHandler,
  IngestionStrategy,
} from "@polar-sh/adapter-utils";
import type { Polar } from "@polar-sh/sdk";

type S3StrategyContext = IngestionContext & {
  bucket: string;
  key: string;
  bytes: number;
};

export class S3Strategy extends IngestionStrategy<S3StrategyContext, S3Client> {
  private s3Client: S3Client;

  constructor(s3Client: S3Client, polar: Polar) {
    super(polar);

    this.s3Client = s3Client;
  }

  private wrapS3Client({
    s3Client,
    execute: _execute,
    customerId: _customerId,
  }: {
    s3Client: S3Client;
    execute: IngestionExecutionHandler<S3StrategyContext>;
    customerId: string;
  }) {
    const plugin: Parameters<S3Client["middlewareStack"]["use"]>[0] = {
      applyToStack: (stack) => {
        stack.add(
          (next, context) => async (args) => {
            const result = await next(args);

            console.log({ args, context, result });

            return result;
          },
          {
            step: "deserialize",
            priority: "high",
          },
        );
      },
    };

    s3Client.middlewareStack.use(plugin);

    return s3Client;
  }

  public client(customerId: string): S3Client {
    const execute = this.createExecutionHandler();

    return this.wrapS3Client({
      s3Client: this.s3Client,
      execute,
      customerId,
    });
  }
}
