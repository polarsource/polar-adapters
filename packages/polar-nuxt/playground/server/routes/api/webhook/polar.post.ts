export default defineEventHandler((event) => {
	const {
		private: { polarWebhookSecret },
	} = useRuntimeConfig();

	const webhooksHandler = Webhooks({
		webhookSecret: polarWebhookSecret,
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		onPayload: async (payload: any) => {
			// Handle the payload
			// No need to return an acknowledge response
			console.log("onWebhookPayload", payload);
		},
	});

	return webhooksHandler(event);
});
