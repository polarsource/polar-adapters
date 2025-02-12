import type { S3Client } from "@aws-sdk/client-s3";
import type { Polar } from "@polar-sh/sdk";
import type { IngestionContext } from "../../ingestion";
import {
  type IngestionExecutionHandler,
  IngestionStrategy,
} from "../../strategy";

type S3StrategyContext = IngestionContext & {
  bucket?: string;
  key?: string;
  contentType?: string;
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
    execute,
    customerId,
  }: {
    s3Client: S3Client;
    execute: IngestionExecutionHandler<S3StrategyContext>;
    customerId: string;
  }) {
    const plugin: Parameters<S3Client["middlewareStack"]["use"]>[0] = {
      applyToStack: (stack) => {
        stack.add(
          (next, _context) => async (args) => {
            const result = await next(args);

            if ("request" in args) {
              const payload: S3StrategyContext = {
                bytes: Number.parseInt(
                  // @ts-expect-error
                  args.request.headers["content-length"] ?? "0",
                ),
                customerId,
              };

              if ("Bucket" in args.input) {
                payload.bucket = args.input.Bucket;
              }

              if ("Key" in args.input) {
                payload.key = args.input.Key;
              }

              if ("ContentType" in args.input) {
                payload.contentType = args.input.ContentType;
              }

              execute(payload);
            }

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
