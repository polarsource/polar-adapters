import type { Readable } from "node:stream";
import type { Polar } from "@polar-sh/sdk";
import type { IngestionContext } from "../../ingestion";
import {
  type IngestionExecutionHandler,
  IngestionStrategy,
} from "../../strategy";

type StreamStrategyContext = IngestionContext & {
  bytes: number;
};

export class StreamStrategy extends IngestionStrategy<
  StreamStrategyContext,
  Readable
> {
  private stream: Readable;

  constructor(stream: Readable, polar: Polar) {
    super(polar);
    this.stream = stream;
  }

  private wrapStream({
    stream,
    execute,
    customerId,
  }: {
    stream: Readable;
    execute: IngestionExecutionHandler<StreamStrategyContext>;
    customerId: string;
  }) {
    let bytes = 0;

    stream.on("data", (chunk) => {
      bytes += chunk.length;
    });

    stream.on("end", () => {
      const payload: StreamStrategyContext = {
        bytes,
        customerId,
      };

      execute(payload);
    });

    return stream;
  }

  public client(customerId: string): Readable {
    const execute = this.createExecutionHandler();

    return this.wrapStream({
      stream: this.stream,
      execute,
      customerId,
    });
  }
}
