import sinon from 'https://cdn.skypack.dev/sinon@11.1.2?dts';

export const WebhookVerificationError = sinon.stub();
export const validateEvent = function(v: string, _headers: Record<string, string>, _secret: string) {
  return JSON.parse(v);
};
