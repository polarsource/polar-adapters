export type Transformer<T> = (ctx: T) => Promise<void>;

export class UsageEngine<T> {
  transformers: Transformer<T>[] = [];

  public pipe(transformer: Transformer<T>) {
    this.transformers.push(transformer);

    return this;
  }

  public async run(ctx: T) {
    await Promise.all(this.transformers.map((transformer) => transformer(ctx)));
  }
}
