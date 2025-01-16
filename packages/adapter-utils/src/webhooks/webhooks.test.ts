import { handleWebhookPayload } from "./webhooks";
import { describe, expect, it, vi } from "vitest";

describe("webhooks", () => {
	it("should handle webhook payload", async () => {
		const onPayload = vi.fn();

		await handleWebhookPayload({ type: "checkout.created", data: {} } as any, {
			webhookSecret: "test",
			onPayload,
		});

		expect(onPayload).toHaveBeenCalledWith({
			type: "checkout.created",
			data: {},
		});
	});

	it("should handle webhook payload with checkout created", async () => {
		const onCheckoutCreated = vi.fn();

		await handleWebhookPayload({ type: "checkout.created", data: {} } as any, {
			webhookSecret: "test",
			onCheckoutCreated,
		});
		expect(onCheckoutCreated).toHaveBeenCalledWith({
			type: "checkout.created",
			data: {},
		});
	});

	it("should handle webhook payload with checkout updated", async () => {
		const onCheckoutUpdated = vi.fn();

		await handleWebhookPayload({ type: "checkout.updated", data: {} } as any, {
			webhookSecret: "test",
			onCheckoutUpdated,
		});
		expect(onCheckoutUpdated).toHaveBeenCalledWith({
			type: "checkout.updated",
			data: {},
		});
	});

	it("should handle webhook payload with order created", async () => {
		const onOrderCreated = vi.fn();

		await handleWebhookPayload({ type: "order.created", data: {} } as any, {
			webhookSecret: "test",
			onOrderCreated,
		});
		expect(onOrderCreated).toHaveBeenCalledWith({
			type: "order.created",
			data: {},
		});
	});

	it("should handle webhook payload with subscription created", async () => {
		const onSubscriptionCreated = vi.fn();

		await handleWebhookPayload(
			{ type: "subscription.created", data: {} } as any,
			{
				webhookSecret: "test",
				onSubscriptionCreated,
			},
		);
		expect(onSubscriptionCreated).toHaveBeenCalledWith({
			type: "subscription.created",
			data: {},
		});
	});

	it("should handle webhook payload with subscription updated", async () => {
		const onSubscriptionUpdated = vi.fn();

		await handleWebhookPayload(
			{ type: "subscription.updated", data: {} } as any,
			{
				webhookSecret: "test",
				onSubscriptionUpdated,
			},
		);
		expect(onSubscriptionUpdated).toHaveBeenCalledWith({
			type: "subscription.updated",
			data: {},
		});
	});

	it("should handle webhook payload with subscription active", async () => {
		const onSubscriptionActive = vi.fn();

		await handleWebhookPayload(
			{ type: "subscription.active", data: {} } as any,
			{
				webhookSecret: "test",
				onSubscriptionActive,
			},
		);
		expect(onSubscriptionActive).toHaveBeenCalledWith({
			type: "subscription.active",
			data: {},
		});
	});

	it("should handle webhook payload with subscription canceled", async () => {
		const onSubscriptionCanceled = vi.fn();

		await handleWebhookPayload(
			{ type: "subscription.canceled", data: {} } as any,
			{
				webhookSecret: "test",
				onSubscriptionCanceled,
			},
		);
		expect(onSubscriptionCanceled).toHaveBeenCalledWith({
			type: "subscription.canceled",
			data: {},
		});
	});

	it("should handle webhook payload with subscription revoked", async () => {
		const onSubscriptionRevoked = vi.fn();

		await handleWebhookPayload(
			{ type: "subscription.revoked", data: {} } as any,
			{
				webhookSecret: "test",
				onSubscriptionRevoked,
			},
		);
		expect(onSubscriptionRevoked).toHaveBeenCalledWith({
			type: "subscription.revoked",
			data: {},
		});
	});

	it("should handle webhook payload with product created", async () => {
		const onProductCreated = vi.fn();

		await handleWebhookPayload({ type: "product.created", data: {} } as any, {
			webhookSecret: "test",
			onProductCreated,
		});
		expect(onProductCreated).toHaveBeenCalledWith({
			type: "product.created",
			data: {},
		});
	});

	it("should handle webhook payload with product updated", async () => {
		const onProductUpdated = vi.fn();

		await handleWebhookPayload({ type: "product.updated", data: {} } as any, {
			webhookSecret: "test",
			onProductUpdated,
		});
		expect(onProductUpdated).toHaveBeenCalledWith({
			type: "product.updated",
			data: {},
		});
	});

	it("should handle webhook payload with organization updated", async () => {
		const onOrganizationUpdated = vi.fn();

		await handleWebhookPayload(
			{ type: "organization.updated", data: {} } as any,
			{
				webhookSecret: "test",
				onOrganizationUpdated,
			},
		);
		expect(onOrganizationUpdated).toHaveBeenCalledWith({
			type: "organization.updated",
			data: {},
		});
	});

	it("should handle webhook payload with benefit created", async () => {
		const onBenefitCreated = vi.fn();

		await handleWebhookPayload({ type: "benefit.created", data: {} } as any, {
			webhookSecret: "test",
			onBenefitCreated,
		});
		expect(onBenefitCreated).toHaveBeenCalledWith({
			type: "benefit.created",
			data: {},
		});
	});

	it("should handle webhook payload with benefit updated", async () => {
		const onBenefitUpdated = vi.fn();

		await handleWebhookPayload({ type: "benefit.updated", data: {} } as any, {
			webhookSecret: "test",
			onBenefitUpdated,
		});
		expect(onBenefitUpdated).toHaveBeenCalledWith({
			type: "benefit.updated",
			data: {},
		});
	});

	it("should handle webhook payload with benefit grant created", async () => {
		const onBenefitGrantCreated = vi.fn();

		await handleWebhookPayload(
			{ type: "benefit_grant.created", data: {} } as any,
			{
				webhookSecret: "test",
				onBenefitGrantCreated,
			},
		);
		expect(onBenefitGrantCreated).toHaveBeenCalledWith({
			type: "benefit_grant.created",
			data: {},
		});
	});

	it("should handle webhook payload with benefit grant updated", async () => {
		const onBenefitGrantUpdated = vi.fn();

		await handleWebhookPayload(
			{ type: "benefit_grant.updated", data: {} } as any,
			{
				webhookSecret: "test",
				onBenefitGrantUpdated,
			},
		);
		expect(onBenefitGrantUpdated).toHaveBeenCalledWith({
			type: "benefit_grant.updated",
			data: {},
		});
	});

	it("should handle webhook payload with benefit grant revoked", async () => {
		const onBenefitGrantRevoked = vi.fn();

		await handleWebhookPayload(
			{ type: "benefit_grant.revoked", data: {} } as any,
			{
				webhookSecret: "test",
				onBenefitGrantRevoked,
			},
		);
		expect(onBenefitGrantRevoked).toHaveBeenCalledWith({
			type: "benefit_grant.revoked",
			data: {},
		});
	});
});
