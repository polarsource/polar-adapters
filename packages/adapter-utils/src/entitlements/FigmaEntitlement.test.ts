import { it, describe, expect } from "vitest";
import {
	FigmaTeam,
	type FigmaTeamEntitlementProperties,
} from "./FigmaEntitlement";
import type { EntitlementContext } from "../entitlement/entitlement";
import type {
	Benefit,
	WebhookBenefitGrantCreatedPayload,
} from "@polar-sh/sdk/models/components";
import type { Customer } from "@polar-sh/sdk/models/components";

describe("FigmaTeam", () => {
	it("should grant access to a team", async () => {
		const payload = {
			type: "benefit_grant.created",
			data: {
				id: "123",
				createdAt: new Date(),
				modifiedAt: new Date(),
				isGranted: true,
				benefitId: "123",
				customerId: "123",
				subscriptionId: "123",
				orderId: "123",
				userId: "123",
				isRevoked: false,
				customer: {
					email: "test@test.com",
				} as Customer,
				properties: {
					figmaTeamId: "123",
				},
				benefit: {
					id: "123",
				} as Benefit,
			},
		} as WebhookBenefitGrantCreatedPayload;

		const entitlement = FigmaTeam(payload);

		expect(entitlement).toBeDefined();
	});
});
