import { describe, it, expect, vi } from "vitest";
import { LLMStrategy } from "./LLMStrategy";
import { Ingestion } from "@polar-sh/adapter-utils";

const mockEventsIngest = vi.fn();

// Mock the module before any imports
vi.mock("@polar-sh/sdk", async (importOriginal) => {
	class Polar {
		events = {
			ingest: mockEventsIngest,
		};
	}

	return {
		...(await importOriginal()),
		Polar,
	};
});

import { Polar } from "@polar-sh/sdk";

const mockLLMClient = {
	specificationVersion: "v1",
	provider: "test-provider",
	modelId: "test-model",
	defaultObjectGenerationMode: "json",
	doGenerate: vi.fn(),
	doStream: vi.fn(),
} as const;

describe("LLMStrategy", () => {
	const customerId = "test-customer-id";

	it("should call the meter handler with the correct context", async () => {
		const input = { prompt: "Hello, world!" };
		const response = { text: "Hello, user!" };

		const mockMeterResolver = vi.fn();
		const mockMeterHandler = vi.fn((context) => mockMeterResolver(context));

		mockLLMClient.doGenerate.mockResolvedValueOnce(response);

		const model = new LLMStrategy(mockLLMClient, new Polar())
			.ingest("prompt-tokens", ({ promptTokens, completionTokens }) => ({
				promptTokens,
				completionTokens,
			}))
			.client("test-customer-id");

		await model.doGenerate({
			prompt: [
				{
					role: "user",
					content: [{ type: "text", text: input.prompt }],
				},
			],
			inputFormat: "prompt",
			mode: { type: "regular" },
		});

		expect(mockMeterHandler).toHaveBeenCalledWith({
			usage: {
				promptTokens: 1,
				completionTokens: 1,
			},
			customerId,
		});
	});
});
