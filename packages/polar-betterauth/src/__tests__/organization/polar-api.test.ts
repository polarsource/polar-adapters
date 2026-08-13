import type { WebhookMemberCreatedPayload } from "@polar-sh/sdk/models/components/webhookmembercreatedpayload.js";
import type { WebhookMemberDeletedPayload } from "@polar-sh/sdk/models/components/webhookmemberdeletedpayload.js";
import type { WebhookMemberUpdatedPayload } from "@polar-sh/sdk/models/components/webhookmemberupdatedpayload.js";
import { describe, expect, it, vi } from "vitest";
import {
	type PolarOrganizationAPIClient,
	createPolarOrganizationAPI,
} from "../../organization/polar-api";

const createClient = () => {
	const createCustomer =
		vi.fn<PolarOrganizationAPIClient["customers"]["create"]>();
	const getCustomerExternal =
		vi.fn<PolarOrganizationAPIClient["customers"]["getExternal"]>();
	const updateCustomerExternal =
		vi.fn<PolarOrganizationAPIClient["customers"]["updateExternal"]>();
	const listMembers =
		vi.fn<PolarOrganizationAPIClient["members"]["listMembers"]>();
	const createMemberExternal =
		vi.fn<
			PolarOrganizationAPIClient["customers"]["members"]["createExternal"]
		>();
	const getMemberExternal =
		vi.fn<PolarOrganizationAPIClient["customers"]["members"]["getExternal"]>();
	const updateMemberExternal =
		vi.fn<
			PolarOrganizationAPIClient["customers"]["members"]["updateExternal"]
		>();
	const deleteMemberExternal =
		vi.fn<
			PolarOrganizationAPIClient["customers"]["members"]["deleteExternal"]
		>();
	const createCustomerSession =
		vi.fn<PolarOrganizationAPIClient["customerSessions"]["create"]>();

	const client: PolarOrganizationAPIClient = {
		customers: {
			create: createCustomer,
			getExternal: getCustomerExternal,
			updateExternal: updateCustomerExternal,
			members: {
				createExternal: createMemberExternal,
				getExternal: getMemberExternal,
				updateExternal: updateMemberExternal,
				deleteExternal: deleteMemberExternal,
			},
		},
		members: {
			listMembers,
		},
		customerSessions: {
			create: createCustomerSession,
		},
	};

	return {
		client,
		createCustomer,
		getCustomerExternal,
		updateCustomerExternal,
		listMembers,
		createMemberExternal,
		getMemberExternal,
		updateMemberExternal,
		deleteMemberExternal,
		createCustomerSession,
	};
};

describe("Polar organization API contract", () => {
	it("creates a team customer with an explicit owner", () => {
		const mocks = createClient();
		const api = createPolarOrganizationAPI(mocks.client);

		api.createTeamCustomer({
			externalId: "organization-123",
			name: "Acme",
			owner: {
				externalId: "user-123",
				email: "owner@example.com",
				name: "Owner",
			},
		});

		expect(mocks.createCustomer).toHaveBeenCalledWith({
			type: "team",
			externalId: "organization-123",
			name: "Acme",
			owner: {
				externalId: "user-123",
				email: "owner@example.com",
				name: "Owner",
			},
		});
	});

	it("gets and updates a customer by external ID", () => {
		const mocks = createClient();
		const api = createPolarOrganizationAPI(mocks.client);

		api.getCustomerByExternalId("organization-123");
		api.updateCustomerByExternalId("organization-123", { name: "Acme 2" });

		expect(mocks.getCustomerExternal).toHaveBeenCalledWith({
			externalId: "organization-123",
		});
		expect(mocks.updateCustomerExternal).toHaveBeenCalledWith({
			externalId: "organization-123",
			customerUpdateExternalID: { name: "Acme 2" },
		});
	});

	it("lists members using the customer external ID", () => {
		const mocks = createClient();
		const api = createPolarOrganizationAPI(mocks.client);

		api.listMembersByExternalCustomerId("organization-123", {
			role: "owner",
			limit: 100,
		});

		expect(mocks.listMembers).toHaveBeenCalledWith({
			externalCustomerId: "organization-123",
			role: "owner",
			limit: 100,
		});
	});

	it("creates and gets members through external IDs", () => {
		const mocks = createClient();
		const api = createPolarOrganizationAPI(mocks.client);

		api.createMemberByExternalCustomerId("organization-123", {
			externalId: "user-123",
			email: "member@example.com",
			name: "Member",
			role: "billing_manager",
		});
		api.getMemberByExternalIds("organization-123", "user-123");

		expect(mocks.createMemberExternal).toHaveBeenCalledWith({
			externalId: "organization-123",
			memberCreateFromCustomer: {
				externalId: "user-123",
				email: "member@example.com",
				name: "Member",
				role: "billing_manager",
			},
		});
		expect(mocks.getMemberExternal).toHaveBeenCalledWith({
			externalId: "organization-123",
			memberExternalId: "user-123",
		});
	});

	it("updates and deletes members through external IDs", () => {
		const mocks = createClient();
		const api = createPolarOrganizationAPI(mocks.client);

		api.updateMemberByExternalIds("organization-123", "user-123", {
			name: "Updated Member",
			role: "member",
		});
		api.deleteMemberByExternalIds("organization-123", "user-123");

		expect(mocks.updateMemberExternal).toHaveBeenCalledWith({
			externalId: "organization-123",
			memberExternalId: "user-123",
			memberUpdate: {
				name: "Updated Member",
				role: "member",
			},
		});
		expect(mocks.deleteMemberExternal).toHaveBeenCalledWith({
			externalId: "organization-123",
			memberExternalId: "user-123",
		});
	});

	it("creates a member-scoped customer session", () => {
		const mocks = createClient();
		const api = createPolarOrganizationAPI(mocks.client);

		api.createCustomerSession({
			externalCustomerId: "organization-123",
			externalMemberId: "user-123",
			returnUrl: "https://example.com/settings",
		});

		expect(mocks.createCustomerSession).toHaveBeenCalledWith({
			externalCustomerId: "organization-123",
			externalMemberId: "user-123",
			returnUrl: "https://example.com/settings",
		});
	});

	it("exposes member webhook payload types in the selected SDK", () => {
		const assertMemberWebhookPayload = (
			payload:
				| WebhookMemberCreatedPayload
				| WebhookMemberUpdatedPayload
				| WebhookMemberDeletedPayload,
		) => payload.type;

		const member = {
			id: "member-123",
			createdAt: new Date(),
			modifiedAt: null,
			customerId: "customer-123",
			email: "member@example.com",
			name: "Member",
			externalId: "user-123",
			role: "member" as const,
		};

		expect(
			assertMemberWebhookPayload({
				type: "member.created",
				timestamp: new Date(),
				data: member,
			}),
		).toBe("member.created");
		expect(
			assertMemberWebhookPayload({
				type: "member.updated",
				timestamp: new Date(),
				data: member,
			}),
		).toBe("member.updated");
		expect(
			assertMemberWebhookPayload({
				type: "member.deleted",
				timestamp: new Date(),
				data: member,
			}),
		).toBe("member.deleted");
	});
});
