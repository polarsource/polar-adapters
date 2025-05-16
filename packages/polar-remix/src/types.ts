type Params<Key extends string = string> = {
  readonly [key in Key]: string | undefined;
};

type DataFunctionArgs = {
  request: Request;
  context: unknown;
  params: Params;
};

export type LoaderFunction = (args: DataFunctionArgs) => Promise<Response>;
export type ActionFunction = (args: DataFunctionArgs) => Promise<Response>;
